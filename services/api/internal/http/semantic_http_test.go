package http_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/app/ports"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/editorial"
)

func semanticServer(t *testing.T) (http.Handler, *faketesting.SemanticStore) {
	t.Helper()
	live := liveArt("art_1", "budget-2026")
	related := liveArt("art_2", "market-outlook")
	revision := editorial.NewRevision("rev_art_1", "art_1", nil, "Budget", "Approved body", "usr_author", now)
	relatedRevision := editorial.NewRevision("rev_art_2", "art_2", nil, "Market", "Related body", "usr_author", now)
	semantic := faketesting.NewSemanticStore(
		ports.SemanticRecord{ArticleID: live.ID(), RevisionID: revision.ID(), Locale: "en", Active: true, Embedding: []float32{.1}},
		ports.SemanticRecord{ArticleID: related.ID(), RevisionID: relatedRevision.ID(), Locale: "en", Active: true, Embedding: []float32{.2}},
	)
	semantic.Hits = []ports.SemanticHit{{ArticleID: live.ID(), Score: .95}, {ArticleID: related.ID(), Score: .9}}
	deps := appeditorial.Deps{
		Articles: faketesting.NewArticleStore(live, related), Revisions: faketesting.NewRevisionStore(revision, relatedRevision),
		Categories: faketesting.NewCategoryStore(), Clock: faketesting.FixedClock{At: now},
		IDs: &faketesting.SequentialIDs{}, Events: &faketesting.RecordingEventBus{}, Semantic: semantic,
	}
	return routed(deps, nil), semantic
}

func TestSemanticSearchAndRelatedEndpoints(t *testing.T) {
	handler, _ := semanticServer(t)
	for path, expected := range map[string]string{"/public/en/search?q=fiscal+policy": `"art_1"`, "/public/en/articles/art_1/related": `"art_2"`} {
		rec := do(handler, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), expected) {
			t.Fatalf("path=%s status=%d body=%s", path, rec.Code, rec.Body.String())
		}
	}
}

func TestSemanticIndexEndpointIsProtectedAndProcessesBackfill(t *testing.T) {
	handler, semantic := semanticServer(t)
	path := "/internal/process-semantic-index"
	if rec := do(handler, httptest.NewRequest(http.MethodPost, path, nil)); rec.Code != http.StatusNotFound {
		t.Fatalf("anonymous status=%d", rec.Code)
	}
	delete(semantic.Records, "art_1")
	req := httptest.NewRequest(http.MethodPost, path, nil)
	req.Header.Set("Authorization", "Bearer s3cret-value-of-known-length-0000")
	rec := do(handler, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"indexed":1`) {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if _, err := semantic.ReadyVector(context.Background(), "art_1"); err != nil {
		t.Fatal(err)
	}
}
