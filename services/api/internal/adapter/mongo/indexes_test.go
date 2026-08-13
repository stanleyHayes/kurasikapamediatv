package mongo_test

import (
	"context"
	"strings"
	"testing"
	"time"

	adapter "github.com/kurasikapa/api/internal/adapter/mongo"
	"github.com/kurasikapa/api/internal/domain/editorial"
)

// indexNames returns the names of every index on a collection, keyed for lookup.
func indexNames(t *testing.T, harness harness, collection string) map[string]bool {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	specs, err := harness.DB.Collection(collection).Indexes().ListSpecifications(ctx)
	if err != nil {
		t.Fatalf("listing %s indexes: %v", collection, err)
	}

	names := make(map[string]bool, len(specs))
	for _, spec := range specs {
		names[spec.Name] = true
	}

	return names
}

func TestArticleEnsureIndexesCreatesTheNamedIndexes(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	repo := adapter.NewArticleRepository(h.DB, fixedClock{at: testNow})

	if err := repo.EnsureIndexes(context.Background()); err != nil {
		t.Fatalf("ensureIndexes: %v", err)
	}

	names := indexNames(t, h, adapter.CollArticles)

	for _, want := range []string{
		"locale_slug_unique",
		"family_locale_unique",
		"published_recent",
		"category_published",
		"tag_published",
		"awaiting_review",
		"author_recent",
		"article_text",
		"due_for_publication",
	} {
		if !names[want] {
			t.Errorf("index %q missing; got %v", want, names)
		}
	}
}

func TestCategoryEnsureIndexesCreatesTheNamedIndexes(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	repo := adapter.NewCategoryRepository(h.DB)

	if err := repo.EnsureIndexes(context.Background()); err != nil {
		t.Fatalf("ensureIndexes: %v", err)
	}

	names := indexNames(t, h, adapter.CollCategories)

	for _, want := range []string{"slug_en_unique", "slug_fr_unique", "nav_order"} {
		if !names[want] {
			t.Errorf("index %q missing; got %v", want, names)
		}
	}
}

func TestDuplicateSlugInOneLocaleIsRefusedByTheDatabase(t *testing.T) {
	t.Parallel()

	// SlugTaken is a pre-flight check; locale_slug_unique is the rule. Two
	// racing writers both pass the check, and only the index makes the loser
	// an error instead of a second live article at the same address.
	h := newHarness(t)
	repo := adapter.NewArticleRepository(h.DB, fixedClock{at: testNow})
	ctx := context.Background()

	if err := repo.EnsureIndexes(ctx); err != nil {
		t.Fatalf("ensureIndexes: %v", err)
	}

	if err := repo.Save(ctx, article("art_first", "budget-2026", "en", editorial.StatusDraft, nil)); err != nil {
		t.Fatalf("save first: %v", err)
	}

	err := repo.Save(ctx, article("art_second", "budget-2026", "en", editorial.StatusDraft, nil))
	if err == nil {
		t.Fatal("a duplicate (slug, locale) was accepted")
	}
	if !strings.Contains(err.Error(), "duplicate key") {
		t.Errorf("got %v, want a duplicate key error", err)
	}

	// The same slug in another locale must still be fine — locale is data.
	if err := repo.Save(ctx, article("art_french", "budget-2026", "fr", editorial.StatusDraft, nil)); err != nil {
		t.Errorf("same slug in fr rejected: %v", err)
	}
}
