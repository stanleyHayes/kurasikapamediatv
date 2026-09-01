package mongo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/shared"
)

const (
	CollSemanticArticles = "article_semantic_documents"
	SemanticVectorIndex  = "article_semantic_vector"
)

type semanticDoc struct {
	ID          string    `bson:"_id"`
	RevisionID  string    `bson:"revisionId"`
	Locale      string    `bson:"locale"`
	Title       string    `bson:"title"`
	Slug        string    `bson:"slug"`
	Text        string    `bson:"text"`
	PublishedAt time.Time `bson:"publishedAt,omitempty"`
	Embedding   []float32 `bson:"embedding,omitempty"`
	Model       string    `bson:"model,omitempty"`
	Attempts    int       `bson:"attempts"`
	LastError   string    `bson:"lastError,omitempty"`
	Active      bool      `bson:"active"`
}

type SemanticRepository struct{ documents *mongo.Collection }

func NewSemanticRepository(db *mongo.Database) *SemanticRepository {
	return &SemanticRepository{documents: db.Collection(CollSemanticArticles)}
}

func (r *SemanticRepository) Queue(ctx context.Context, record ports.SemanticRecord) error {
	set := bson.M{"revisionId": record.RevisionID.String(), "locale": record.Locale, "title": record.Title,
		"slug": record.Slug, "text": record.Text, "publishedAt": record.PublishedAt,
		"attempts": 0, "active": true}
	update := bson.M{"$set": set, "$unset": bson.M{"embedding": "", "model": "", "lastError": ""}}
	_, err := r.documents.UpdateOne(ctx, bson.M{"_id": record.ArticleID.String()}, update, options.UpdateOne().SetUpsert(true))
	if err != nil {
		return fmt.Errorf("queueing semantic article: %w", err)
	}
	return nil
}

func (r *SemanticRepository) IsCurrent(ctx context.Context, id shared.ArticleID, revision shared.RevisionID) (bool, error) {
	count, err := r.documents.CountDocuments(ctx, bson.M{"_id": id.String(), "revisionId": revision.String(), "active": true}, options.Count().SetLimit(1))
	if err != nil {
		return false, fmt.Errorf("checking semantic revision: %w", err)
	}
	return count == 1, nil
}

func (r *SemanticRepository) Deactivate(ctx context.Context, id shared.ArticleID) error {
	_, err := r.documents.UpdateOne(ctx, bson.M{"_id": id.String()}, bson.M{"$set": bson.M{"active": false}})
	if err != nil {
		return fmt.Errorf("deactivating semantic article: %w", err)
	}
	return nil
}

func (r *SemanticRepository) ListPending(ctx context.Context, limit int) ([]ports.SemanticRecord, error) {
	filter := bson.M{"active": true, "embedding": bson.M{"$exists": false}, "attempts": bson.M{"$lt": 5}}
	cursor, err := r.documents.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "publishedAt", Value: 1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, fmt.Errorf("listing semantic jobs: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []semanticDoc
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decoding semantic jobs: %w", err)
	}
	out := make([]ports.SemanticRecord, 0, len(docs))
	for _, doc := range docs {
		out = append(out, semanticRecord(doc))
	}
	return out, nil
}

func (r *SemanticRepository) MarkReady(ctx context.Context, id shared.ArticleID, revision shared.RevisionID, vector []float32, model string) error {
	update := bson.M{"$set": bson.M{"embedding": vector, "model": model}, "$unset": bson.M{"lastError": ""}}
	result, err := r.documents.UpdateOne(ctx, bson.M{"_id": id.String(), "revisionId": revision.String(), "active": true}, update)
	if err != nil {
		return fmt.Errorf("completing semantic job: %w", err)
	}
	if result.MatchedCount == 0 {
		return ports.ErrNotFound
	}
	return nil
}

func (r *SemanticRepository) MarkFailed(ctx context.Context, id shared.ArticleID, revision shared.RevisionID, reason string) error {
	update := bson.M{"$inc": bson.M{"attempts": 1}, "$set": bson.M{"lastError": reason}}
	_, err := r.documents.UpdateOne(ctx, bson.M{"_id": id.String(), "revisionId": revision.String()}, update)
	if err != nil {
		return fmt.Errorf("recording semantic failure: %w", err)
	}
	return nil
}

func (r *SemanticRepository) ReadyVector(ctx context.Context, id shared.ArticleID) ([]float32, error) {
	var doc semanticDoc
	err := r.documents.FindOne(ctx, bson.M{"_id": id.String(), "active": true, "embedding": bson.M{"$exists": true}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ports.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("finding semantic vector: %w", err)
	}
	return doc.Embedding, nil
}

func (r *SemanticRepository) Similar(ctx context.Context, vector []float32, locale string, exclude shared.ArticleID, limit int) ([]ports.SemanticHit, error) {
	candidates := limit * 20
	if candidates < 100 {
		candidates = 100
	}
	pipeline := mongo.Pipeline{
		{{Key: "$vectorSearch", Value: bson.M{"index": SemanticVectorIndex, "path": "embedding", "queryVector": vector,
			"numCandidates": candidates, "limit": limit + 1, "filter": bson.M{"locale": locale, "active": true}}}},
		{{Key: "$match", Value: bson.M{"_id": bson.M{"$ne": exclude.String()}}}},
		{{Key: "$limit", Value: limit}},
		{{Key: "$project", Value: bson.M{"_id": 1, "score": bson.M{"$meta": "vectorSearchScore"}}}},
	}
	cursor, err := r.documents.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("running semantic search: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []struct {
		ID    string  `bson:"_id"`
		Score float64 `bson:"score"`
	}
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decoding semantic hits: %w", err)
	}
	hits := make([]ports.SemanticHit, 0, len(docs))
	for _, doc := range docs {
		hits = append(hits, ports.SemanticHit{ArticleID: shared.ArticleID(doc.ID), Score: doc.Score})
	}
	return hits, nil
}

func (r *SemanticRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.documents.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "active", Value: 1}, {Key: "attempts", Value: 1}, {Key: "publishedAt", Value: 1}}, Options: options.Index().SetName("semantic_pending")},
		{Keys: bson.D{{Key: "revisionId", Value: 1}}, Options: options.Index().SetName("semantic_revision")},
	})
	if err != nil {
		return fmt.Errorf("creating semantic indexes: %w", err)
	}
	return nil
}

func semanticRecord(doc semanticDoc) ports.SemanticRecord {
	return ports.SemanticRecord{ArticleID: shared.ArticleID(doc.ID), RevisionID: shared.RevisionID(doc.RevisionID),
		Locale: doc.Locale, Title: doc.Title, Slug: doc.Slug, Text: doc.Text,
		PublishedAt: doc.PublishedAt,
		Embedding:   doc.Embedding, Model: doc.Model, Attempts: doc.Attempts, LastError: doc.LastError, Active: doc.Active}
}
