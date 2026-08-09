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
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/shared"
)

// Limits bound what a caller may ask for. A page size arriving from a query
// string is untrusted input, and `limit=1000000` is a denial of service with a
// polite name.
const (
	defaultLimit = 20
	maxLimit     = 100
)

// ArticleRepository is the MongoDB implementation of ports.ArticleRepository.
type ArticleRepository struct {
	articles *mongo.Collection
	clock    ports.Clock
}

// NewArticleRepository wires the repository.
func NewArticleRepository(db *mongo.Database, clock ports.Clock) *ArticleRepository {
	return &ArticleRepository{articles: db.Collection(CollArticles), clock: clock}
}

// FindByID loads one article.
func (r *ArticleRepository) FindByID(ctx context.Context, id shared.ArticleID) (editorial.Article, error) {
	return r.one(ctx, bson.M{"_id": id.String()})
}

// FindBySlug loads the article at a slug within a locale.
//
// Slug alone is not unique — "locale is data", so the English and French
// versions of a story legitimately share a word. The pair is the key.
func (r *ArticleRepository) FindBySlug(ctx context.Context, slug, locale string) (editorial.Article, error) {
	return r.one(ctx, bson.M{"slug": slug, "locale": locale})
}

// FindManyByIDs loads a set of articles in one round trip.
func (r *ArticleRepository) FindManyByIDs(ctx context.Context, ids []shared.ArticleID) ([]editorial.Article, error) {
	if len(ids) == 0 {
		// `$in: []` is a round trip that can only return nothing. Saved-article
		// lists hit this on every empty reading list.
		return []editorial.Article{}, nil
	}

	return r.many(ctx, bson.M{"_id": bson.M{"$in": rawIDs(ids)}}, nil, 0)
}

// SlugTaken reports whether a slug is already used in a locale.
//
// A count with a limit of one, not a full document read: the caller wants a
// yes/no on every draft save, and loading an aggregate to answer it is waste.
func (r *ArticleRepository) SlugTaken(ctx context.Context, slug, locale string) (bool, error) {
	n, err := r.articles.CountDocuments(
		ctx,
		bson.M{"slug": slug, "locale": locale},
		options.Count().SetLimit(1),
	)
	if err != nil {
		return false, fmt.Errorf("counting slug %q (%s): %w", slug, locale, err)
	}

	return n > 0, nil
}

// ListPublished returns articles a reader may see, newest first.
func (r *ArticleRepository) ListPublished(ctx context.Context, q ports.PublishedQuery) (ports.Page[editorial.Article], error) {
	filter := bson.M{
		"locale": q.Locale,
		"status": string(editorial.StatusPublished),
	}
	if q.CategoryID != "" {
		filter["categoryId"] = q.CategoryID.String()
	}

	// Keyset on publishedAt descending: the cursor is the last row's timestamp,
	// and the next page is everything strictly older. Never skip/offset — an
	// offset re-scans everything it passes, and on a feed that grows at the top
	// it silently repeats and drops rows as the reader pages.
	if err := applyTimeCursor(filter, q.Cursor.After, "publishedAt", "$lt"); err != nil {
		return ports.Page[editorial.Article]{}, err
	}

	return r.page(ctx, filter, bson.D{{Key: "publishedAt", Value: -1}}, q.Cursor.Limit, publishedCursor)
}

// ListAuthoredBy returns one author's own work, most recently touched first.
func (r *ArticleRepository) ListAuthoredBy(ctx context.Context, q ports.AuthoredQuery) (ports.Page[editorial.Article], error) {
	filter := bson.M{"authorId": q.AuthorID.String()}

	if err := applyTimeCursor(filter, q.Cursor.After, "updatedAt", "$lt"); err != nil {
		return ports.Page[editorial.Article]{}, err
	}

	return r.page(ctx, filter, bson.D{{Key: "updatedAt", Value: -1}}, q.Cursor.Limit, updatedCursor)
}

// ListAwaitingReview returns the editorial queue, oldest first.
//
// Oldest first, unlike every other listing here. A review queue sorted newest
// first buries the submission that has been waiting longest, which is exactly
// the one someone needs to look at.
func (r *ArticleRepository) ListAwaitingReview(ctx context.Context, cursor ports.Cursor) (ports.Page[editorial.Article], error) {
	filter := bson.M{"status": string(editorial.StatusInReview)}

	// $gt, not $lt: this list runs oldest-first, so "the next page" is newer.
	if err := applyTimeCursor(filter, cursor.After, "updatedAt", "$gt"); err != nil {
		return ports.Page[editorial.Article]{}, err
	}

	return r.page(ctx, filter, bson.D{{Key: "updatedAt", Value: 1}}, cursor.Limit, updatedCursor)
}

// ListDueForPublication returns scheduled articles whose moment has arrived.
func (r *ArticleRepository) ListDueForPublication(ctx context.Context, now time.Time) ([]editorial.Article, error) {
	filter := bson.M{
		"status":      string(editorial.StatusScheduled),
		"scheduledAt": bson.M{"$lte": now},
	}

	// Unpaginated on purpose. This is the cron's whole worklist, and a page
	// boundary here would mean articles silently waiting for the next tick.
	return r.many(ctx, filter, bson.D{{Key: "scheduledAt", Value: 1}}, 0)
}

// Save upserts the article and stamps updatedAt.
func (r *ArticleRepository) Save(ctx context.Context, article editorial.Article) error {
	doc := articleToDoc(article, r.clock.Now())

	_, err := r.articles.ReplaceOne(
		ctx,
		bson.M{"_id": doc.ID},
		doc,
		options.Replace().SetUpsert(true),
	)
	if err != nil {
		return fmt.Errorf("saving article %s: %w", doc.ID, err)
	}

	return nil
}

func (r *ArticleRepository) one(ctx context.Context, filter bson.M) (editorial.Article, error) {
	var doc articleDoc

	if err := r.articles.FindOne(ctx, filter).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return editorial.Article{}, ports.ErrNotFound
		}

		return editorial.Article{}, fmt.Errorf("finding article: %w", err)
	}

	return articleToDomain(doc), nil
}

func (r *ArticleRepository) many(
	ctx context.Context, filter bson.M, sort bson.D, limit int64,
) ([]editorial.Article, error) {
	opts := options.Find()
	if sort != nil {
		opts = opts.SetSort(sort)
	}
	if limit > 0 {
		opts = opts.SetLimit(limit)
	}

	cursor, err := r.articles.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("listing articles: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var docs []articleDoc
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decoding articles: %w", err)
	}

	out := make([]editorial.Article, 0, len(docs))
	for _, doc := range docs {
		out = append(out, articleToDomain(doc))
	}

	return out, nil
}

// cursorOf extracts the keyset cursor from the last row of a page.
type cursorOf func(editorial.Article) string

func publishedCursor(a editorial.Article) string {
	at, ok := a.PublishedAt()
	if !ok {
		return ""
	}

	return at.UTC().Format(time.RFC3339Nano)
}

// updatedCursor keys on the article's own workflow times.
//
// updatedAt is persistence metadata the domain deliberately does not model, so
// it is not reachable from the aggregate. Falling back through the times the
// domain does own keeps the cursor monotonic for the orderings that use it.
func updatedCursor(a editorial.Article) string {
	if at, ok := a.PublishedAt(); ok {
		return at.UTC().Format(time.RFC3339Nano)
	}
	if at, ok := a.ScheduledAt(); ok {
		return at.UTC().Format(time.RFC3339Nano)
	}

	return ""
}

func (r *ArticleRepository) page(
	ctx context.Context, filter bson.M, sort bson.D, limit int, key cursorOf,
) (ports.Page[editorial.Article], error) {
	size := clampLimit(limit)

	// Fetch one more than asked. Its presence is what tells us another page
	// exists, without a second count query that could disagree with this one.
	docs, err := r.many(ctx, filter, sort, int64(size+1))
	if err != nil {
		return ports.Page[editorial.Article]{}, err
	}

	hasMore := len(docs) > size
	if hasMore {
		docs = docs[:size]
	}

	next := ""
	if hasMore && len(docs) > 0 {
		next = key(docs[len(docs)-1])
	}

	return ports.Page[editorial.Article]{Items: docs, NextCursor: next}, nil
}

// applyTimeCursor narrows a filter to one side of a keyset cursor.
//
// The comparison operator is a parameter because the direction depends on the
// sort: descending lists page with $lt, and the review queue — which runs
// oldest-first so the longest wait surfaces — pages with $gt. Hard-coding one
// would silently return the same page forever for the other.
func applyTimeCursor(filter bson.M, after, field, op string) error {
	if after == "" {
		return nil
	}

	at, err := time.Parse(time.RFC3339Nano, after)
	if err != nil {
		return fmt.Errorf("parsing cursor %q: %w", after, err)
	}

	filter[field] = bson.M{op: at}

	return nil
}

func clampLimit(requested int) int {
	if requested <= 0 {
		return defaultLimit
	}
	if requested > maxLimit {
		return maxLimit
	}

	return requested
}
