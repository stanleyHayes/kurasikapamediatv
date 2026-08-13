package testing

import (
	"context"
	"sort"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
)

// CategoryStore is an in-memory CategoryRepository.
type CategoryStore struct {
	items []editorial.Category

	// FailList injects a read failure, like ArticleStore's Fail* fields.
	FailList error
}

// NewCategoryStore seeds a store.
func NewCategoryStore(seed ...editorial.Category) *CategoryStore {
	return &CategoryStore{items: append([]editorial.Category{}, seed...)}
}

// FindBySlug returns the section reachable at a slug in a locale.
func (s *CategoryStore) FindBySlug(_ context.Context, slug, locale string) (editorial.Category, error) {
	for _, c := range s.items {
		got, err := c.SlugIn(locale)
		if err != nil {
			continue
		}
		if got.String() == slug {
			return c, nil
		}
	}

	return editorial.Category{}, ports.ErrNotFound
}

// ListForLocale returns navigation for a locale, in editorial order.
func (s *CategoryStore) ListForLocale(_ context.Context, locale string) ([]editorial.Category, error) {
	if s.FailList != nil {
		return nil, s.FailList
	}

	out := []editorial.Category{}
	for _, c := range s.items {
		if c.CoversLocale(locale) {
			out = append(out, c)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Order() < out[j].Order() })

	return out, nil
}

// Save upserts the category.
func (s *CategoryStore) Save(_ context.Context, category editorial.Category) error {
	for i, c := range s.items {
		if c.ID() == category.ID() {
			s.items[i] = category

			return nil
		}
	}
	s.items = append(s.items, category)

	return nil
}
