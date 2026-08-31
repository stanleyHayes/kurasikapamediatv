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
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

const CollNarrationJobs = "narration_jobs"

type narrationJobDoc struct {
	ID             string                `bson:"_id"`
	ArticleID      string                `bson:"articleId"`
	RevisionID     string                `bson:"revisionId"`
	AssetID        *string               `bson:"assetId,omitempty"`
	Locale         string                `bson:"locale"`
	Voice          string                `bson:"voice"`
	ProviderTaskID string                `bson:"providerTaskId,omitempty"`
	Status         media.NarrationStatus `bson:"status"`
	FailureReason  string                `bson:"failureReason,omitempty"`
	RequestedBy    string                `bson:"requestedBy"`
	CreatedAt      time.Time             `bson:"createdAt"`
	UpdatedAt      time.Time             `bson:"updatedAt"`
}

type NarrationJobRepository struct{ jobs *mongo.Collection }

func NewNarrationJobRepository(db *mongo.Database) *NarrationJobRepository {
	return &NarrationJobRepository{jobs: db.Collection(CollNarrationJobs)}
}

func (r *NarrationJobRepository) FindByID(ctx context.Context, id shared.NarrationJobID) (media.NarrationJob, error) {
	return r.one(ctx, bson.M{"_id": id.String()}, nil)
}

func (r *NarrationJobRepository) FindLatestForArticle(ctx context.Context, id shared.ArticleID) (media.NarrationJob, error) {
	return r.one(ctx, bson.M{"articleId": id.String()}, options.FindOne().SetSort(bson.D{{Key: "createdAt", Value: -1}}))
}

func (r *NarrationJobRepository) ListProcessing(ctx context.Context, limit int) ([]media.NarrationJob, error) {
	cursor, err := r.jobs.Find(ctx, bson.M{"status": media.NarrationProcessing}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, fmt.Errorf("listing narration jobs: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []narrationJobDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decoding narration jobs: %w", err)
	}
	jobs := make([]media.NarrationJob, len(docs))
	for i, doc := range docs {
		jobs[i] = narrationJobToDomain(doc)
	}
	return jobs, nil
}

func (r *NarrationJobRepository) Save(ctx context.Context, job media.NarrationJob) error {
	doc := narrationJobToDoc(job)
	_, err := r.jobs.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return wrapSave("narration job", err)
}

func (r *NarrationJobRepository) EnsureIndexes(ctx context.Context) error {
	models := []mongo.IndexModel{
		{Keys: bson.D{{Key: "articleId", Value: 1}, {Key: "createdAt", Value: -1}}, Options: options.Index().SetName("article_narrations")},
		{Keys: bson.D{{Key: "status", Value: 1}, {Key: "createdAt", Value: 1}}, Options: options.Index().SetName("processing_narrations")},
	}
	if _, err := r.jobs.Indexes().CreateMany(ctx, models); err != nil {
		return fmt.Errorf("creating narration indexes: %w", err)
	}
	return nil
}

func (r *NarrationJobRepository) one(ctx context.Context, filter bson.M, opts *options.FindOneOptionsBuilder) (media.NarrationJob, error) {
	var doc narrationJobDoc
	result := r.jobs.FindOne(ctx, filter)
	if opts != nil {
		result = r.jobs.FindOne(ctx, filter, opts)
	}
	if err := result.Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return media.NarrationJob{}, ports.ErrNotFound
		}
		return media.NarrationJob{}, fmt.Errorf("finding narration job: %w", err)
	}
	return narrationJobToDomain(doc), nil
}
