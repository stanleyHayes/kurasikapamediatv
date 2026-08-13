package mongo

import (
	"context"
	"fmt"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/kurasikapa/api/internal/domain/editorial"
)

// EnsureIndexes creates the article indexes the queries in this package rely on.
//
// Ported index-for-index from the TypeScript adapter's ensureIndexes so the Go
// service cannot deploy against a database the TS deployment alone used to
// prepare. The definitions live in their own file because the repository file
// is at the size limit, and because they are deployment shape rather than
// query behaviour.
func (r *ArticleRepository) EnsureIndexes(ctx context.Context) error {
	models := []mongo.IndexModel{
		// One slug per locale. This is the uniqueness rule the domain cannot
		// enforce — SlugTaken is a check, this index is the guarantee when two
		// writers race.
		{
			Keys:    bson.D{{Key: "locale", Value: 1}, {Key: "slug", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("locale_slug_unique"),
		},
		// One document per (family, locale) — a family cannot have two French
		// versions.
		{
			Keys:    bson.D{{Key: "familyId", Value: 1}, {Key: "locale", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("family_locale_unique"),
		},
		// Homepage rails and category listings, both keyset-paginated on
		// (publishedAt, _id).
		{
			Keys: bson.D{
				{Key: "status", Value: 1},
				{Key: "publishedAt", Value: -1},
				{Key: "_id", Value: -1},
			},
			Options: options.Index().SetName("published_recent"),
		},
		{
			Keys: bson.D{
				{Key: "categoryId", Value: 1},
				{Key: "status", Value: 1},
				{Key: "publishedAt", Value: -1},
				{Key: "_id", Value: -1},
			},
			Options: options.Index().SetName("category_published"),
		},
		{
			Keys: bson.D{
				{Key: "tagIds", Value: 1},
				{Key: "status", Value: 1},
				{Key: "publishedAt", Value: -1},
			},
			Options: options.Index().SetName("tag_published"),
		},
		// The review queue: one status, oldest first.
		{
			Keys: bson.D{
				{Key: "status", Value: 1},
				{Key: "updatedAt", Value: 1},
				{Key: "_id", Value: 1},
			},
			Options: options.Index().SetName("awaiting_review"),
		},
		// "My drafts" in the CMS.
		{
			Keys: bson.D{
				{Key: "authorId", Value: 1},
				{Key: "status", Value: 1},
				{Key: "updatedAt", Value: -1},
			},
			Options: options.Index().SetName("author_recent"),
		},
		// Lexical search. Weighted so a term in the headline outranks the same
		// term buried in the body — which is what a reader means by relevance.
		{
			Keys: bson.D{{Key: "title", Value: "text"}, {Key: "slug", Value: "text"}},
			Options: options.Index().
				SetName("article_text").
				SetWeights(bson.D{{Key: "title", Value: 10}, {Key: "slug", Value: 2}}).
				SetDefaultLanguage("english"),
		},
		// The publishing cron scans only scheduled articles, so the index is
		// partial: published and draft rows never enter it.
		{
			Keys: bson.D{{Key: "scheduledAt", Value: 1}},
			Options: options.Index().
				SetName("due_for_publication").
				SetPartialFilterExpression(bson.M{"status": string(editorial.StatusScheduled)}),
		},
	}

	if _, err := r.articles.Indexes().CreateMany(ctx, models); err != nil {
		return fmt.Errorf("creating article indexes: %w", err)
	}

	return nil
}
