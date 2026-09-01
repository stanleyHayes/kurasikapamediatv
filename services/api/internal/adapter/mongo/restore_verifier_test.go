package mongo_test

import (
	"context"
	"slices"
	"testing"

	adapter "github.com/kurasikapa/api/internal/adapter/mongo"
	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestRestoreVerifierAcceptsUsableSnapshot(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	seedRestoredCore(t, h)

	report, err := adapter.NewRestoreVerifier(h.DB).Verify(context.Background())
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if !report.Healthy {
		t.Fatalf("healthy = false; issues = %v", report.Issues)
	}
	if report.Counts[adapter.CollArticles] != 1 || report.Counts["user"] != 1 {
		t.Fatalf("counts = %v", report.Counts)
	}
}

func TestRestoreVerifierReportsStructuralAndReferenceDamage(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	ctx := context.Background()
	if _, err := h.DB.Collection(adapter.CollArticles).InsertOne(ctx, bson.M{
		"_id": "damaged", "categoryId": "missing", "approvedRevisionId": "missing",
		"status": "published",
	}); err != nil {
		t.Fatalf("insert damaged article: %v", err)
	}
	if _, err := h.DB.Collection(adapter.CollCategories).InsertOne(ctx, bson.M{"_id": "other"}); err != nil {
		t.Fatalf("insert category: %v", err)
	}
	if _, err := h.DB.Collection(adapter.CollRevisions).InsertOne(ctx, bson.M{"_id": "other"}); err != nil {
		t.Fatalf("insert revision: %v", err)
	}

	report, err := adapter.NewRestoreVerifier(h.DB).Verify(ctx)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if report.Healthy {
		t.Fatal("damaged restore reported healthy")
	}
	for _, issue := range []string{
		"approved articles reference missing approved revisions: 1",
		"articles reference missing categories: 1",
		"missing collection: role_assignments",
		"missing collection: user",
		"missing index: articles.locale_slug_unique",
	} {
		if !slices.Contains(report.Issues, issue) {
			t.Errorf("issue %q missing from %v", issue, report.Issues)
		}
	}
}

func seedRestoredCore(t *testing.T, h harness) {
	t.Helper()
	ctx := context.Background()
	articles := adapter.NewArticleRepository(h.DB, fixedClock{at: testNow})
	revisions := adapter.NewRevisionRepository(h.DB)
	categories := adapter.NewCategoryRepository(h.DB)
	for name, ensure := range map[string]func(context.Context) error{
		"articles": articles.EnsureIndexes, "revisions": revisions.EnsureIndexes,
		"categories": categories.EnsureIndexes,
	} {
		if err := ensure(ctx); err != nil {
			t.Fatalf("ensure %s indexes: %v", name, err)
		}
	}

	documents := map[string]any{
		adapter.CollCategories: bson.M{
			"_id": "cat_news", "slugs": bson.M{"en": "news", "fr": "actualites"},
			"names": bson.M{"en": "News", "fr": "Actualites"}, "order": 1,
		},
		adapter.CollRevisions: bson.M{
			"_id": "rev_1", "articleId": "art_1", "seq": 1, "title": "Restored",
			"body": "Verified body", "authorId": "usr_1", "createdAt": testNow,
		},
		adapter.CollArticles: bson.M{
			"_id": "art_1", "familyId": "fam_1", "locale": "en", "slug": "restored",
			"title": "Restored", "authorId": "usr_1", "categoryId": "cat_news",
			"tagIds": bson.A{}, "status": "published", "approvedRevisionId": "rev_1",
			"publishedAt": testNow, "updatedAt": testNow,
		},
		adapter.CollRoleAssignments: bson.M{"_id": "usr_1", "roles": bson.A{"editor"}},
		"user":                      bson.M{"_id": "usr_1", "email": "editor@example.test"},
	}

	for collection, document := range documents {
		if _, err := h.DB.Collection(collection).InsertOne(ctx, document); err != nil {
			t.Fatalf("insert %s: %v", collection, err)
		}
	}
}
