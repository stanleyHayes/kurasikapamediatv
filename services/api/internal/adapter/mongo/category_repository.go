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
)

// CategoryRepository is the MongoDB implementation of ports.CategoryRepository.
type CategoryRepository struct {
	categories *mongo.Collection
}

// NewCategoryRepository wires the repository.
func NewCategoryRepository(db *mongo.Database) *CategoryRepository {
	return &CategoryRepository{categories: db.Collection(CollCategories)}
}

// FindBySlug loads the section reachable at a slug in a locale.
//
// A dotted path — `slugs.en` — so this is a single indexed probe rather than a
// scan across every category's slug map.
func (r *CategoryRepository) FindBySlug(ctx context.Context, slug, locale string) (editorial.Category, error) {
	var doc categoryDoc

	filter := bson.M{"slugs." + locale: slug}
	if err := r.categories.FindOne(ctx, filter).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return editorial.Category{}, ports.ErrNotFound
		}

		return editorial.Category{}, fmt.Errorf("finding category %q (%s): %w", slug, locale, err)
	}

	return categoryToDomain(doc), nil
}

// ListForLocale returns the navigation tree for a locale, in editorial order.
//
// Filtered on the existence of a slug in that locale, not on all categories:
// a section with no slug in a locale is not reachable there, and listing it in
// the nav would produce a link to nowhere.
func (r *CategoryRepository) ListForLocale(ctx context.Context, locale string) ([]editorial.Category, error) {
	filter := bson.M{"slugs." + locale: bson.M{"$exists": true}}

	cursor, err := r.categories.Find(
		ctx, filter,
		options.Find().SetSort(bson.D{{Key: "order", Value: 1}}),
	)
	if err != nil {
		return nil, fmt.Errorf("listing categories for %s: %w", locale, err)
	}
	defer func() { _ = cursor.Close(ctx) }()

	var docs []categoryDoc
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decoding categories: %w", err)
	}

	out := make([]editorial.Category, 0, len(docs))
	for _, doc := range docs {
		out = append(out, categoryToDomain(doc))
	}

	return out, nil
}

// Save upserts the category.
func (r *CategoryRepository) Save(ctx context.Context, category editorial.Category) error {
	doc := categoryToDoc(category)

	_, err := r.categories.ReplaceOne(
		ctx, bson.M{"_id": doc.ID}, doc,
		options.Replace().SetUpsert(true),
	)
	if err != nil {
		return fmt.Errorf("saving category %s: %w", doc.ID, err)
	}

	return nil
}
