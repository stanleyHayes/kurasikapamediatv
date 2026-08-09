package mongo

import (
	"context"
	"errors"
	"fmt"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/shared"
)

// RevisionRepository is the MongoDB implementation of ports.RevisionRepository.
//
// Append-only, enforced here and not merely intended: there is no update path
// and no delete path in this file. The unique (articleId, seq) index turns a
// concurrent double-append into a duplicate key error rather than a silently
// lost revision.
type RevisionRepository struct {
	revisions *mongo.Collection
}

// NewRevisionRepository wires the repository.
func NewRevisionRepository(db *mongo.Database) *RevisionRepository {
	return &RevisionRepository{revisions: db.Collection(CollRevisions)}
}

// FindByID loads one revision.
func (r *RevisionRepository) FindByID(ctx context.Context, id shared.RevisionID) (editorial.Revision, error) {
	var doc revisionDoc

	if err := r.revisions.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return editorial.Revision{}, ports.ErrNotFound
		}

		return editorial.Revision{}, fmt.Errorf("finding revision %s: %w", id, err)
	}

	return revisionToDomain(doc), nil
}

// FindLatest returns the newest revision of an article.
func (r *RevisionRepository) FindLatest(ctx context.Context, articleID shared.ArticleID) (editorial.Revision, error) {
	var doc revisionDoc

	err := r.revisions.FindOne(
		ctx,
		bson.M{"articleId": articleID.String()},
		options.FindOne().SetSort(bson.D{{Key: "seq", Value: -1}}),
	).Decode(&doc)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return editorial.Revision{}, ports.ErrNotFound
		}

		return editorial.Revision{}, fmt.Errorf("finding latest revision of %s: %w", articleID, err)
	}

	return revisionToDomain(doc), nil
}

// FindManyByIDs loads a set of revisions in one round trip.
func (r *RevisionRepository) FindManyByIDs(ctx context.Context, ids []shared.RevisionID) ([]editorial.Revision, error) {
	if len(ids) == 0 {
		return []editorial.Revision{}, nil
	}

	return r.decodeAll(ctx, bson.M{"_id": bson.M{"$in": rawIDs(ids)}}, nil)
}

// FindLatestForArticles returns the newest revision of each given article.
//
// One aggregation rather than one query per row: a 20-item studio pipeline
// would otherwise be 21 round trips. Sorting descending before grouping is
// what makes $first mean "newest" — $group's $first is defined by the incoming
// order, so without the sort this quietly returns arbitrary revisions.
func (r *RevisionRepository) FindLatestForArticles(ctx context.Context, ids []shared.ArticleID) ([]editorial.Revision, error) {
	if len(ids) == 0 {
		return []editorial.Revision{}, nil
	}

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"articleId": bson.M{"$in": rawIDs(ids)}}}},
		{{Key: "$sort", Value: bson.D{{Key: "articleId", Value: 1}, {Key: "seq", Value: -1}}}},
		{{Key: "$group", Value: bson.M{"_id": "$articleId", "doc": bson.M{"$first": "$$ROOT"}}}},
		{{Key: "$replaceRoot", Value: bson.M{"newRoot": "$doc"}}},
	}

	cursor, err := r.revisions.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("aggregating latest revisions: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var docs []revisionDoc
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decoding latest revisions: %w", err)
	}

	return toDomainSlice(docs), nil
}

// ListFor returns an article's full history, oldest first.
func (r *RevisionRepository) ListFor(ctx context.Context, articleID shared.ArticleID) ([]editorial.Revision, error) {
	return r.decodeAll(
		ctx,
		bson.M{"articleId": articleID.String()},
		bson.D{{Key: "seq", Value: 1}},
	)
}

// Append adds a revision.
//
// InsertOne, never upsert. History is append-only, and an upsert here would
// silently overwrite the revision it was meant to follow.
func (r *RevisionRepository) Append(ctx context.Context, revision editorial.Revision) error {
	if _, err := r.revisions.InsertOne(ctx, revisionToDoc(revision)); err != nil {
		return fmt.Errorf("appending revision %s: %w", revision.ID(), err)
	}

	return nil
}

// EnsureIndexes creates the indexes this repository depends on.
//
// The unique (articleId, seq) pair is not an optimisation — it is the
// enforcement of monotonic history. Without it, two concurrent saves both
// compute the same next seq and one silently wins.
func (r *RevisionRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.revisions.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "articleId", Value: 1}, {Key: "seq", Value: -1}},
		Options: options.Index().SetUnique(true).SetName("article_seq_unique"),
	})
	if err != nil {
		return fmt.Errorf("creating revision index: %w", err)
	}

	return nil
}

func (r *RevisionRepository) decodeAll(ctx context.Context, filter bson.M, sort bson.D) ([]editorial.Revision, error) {
	opts := options.Find()
	if sort != nil {
		opts = opts.SetSort(sort)
	}

	cursor, err := r.revisions.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("listing revisions: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var docs []revisionDoc
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decoding revisions: %w", err)
	}

	return toDomainSlice(docs), nil
}

// rawIDs unwraps branded ids for a $in clause.
//
// Generic over the id types rather than one function each: the branding exists
// to stop them being mixed at call sites, not to make marshalling three
// identical loops.
func rawIDs[T ~string](ids []T) []string {
	raw := make([]string, 0, len(ids))
	for _, id := range ids {
		raw = append(raw, string(id))
	}

	return raw
}

func toDomainSlice(docs []revisionDoc) []editorial.Revision {
	out := make([]editorial.Revision, 0, len(docs))
	for _, doc := range docs {
		out = append(out, revisionToDomain(doc))
	}

	return out
}
