package http_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func liveArt(id, slug string) editorial.Article {
	revID := shared.RevisionID("rev_" + id)
	at := now

	return editorial.Reconstitute(editorial.ArticleState{
		ID: shared.ArticleID(id), Locale: "en", Slug: shared.SlugFrom(slug),
		Title: "Budget 2026", AuthorID: "usr_author", CategoryID: "cat_business",
		Status: editorial.StatusPublished, ApprovedRevisionID: &revID, PublishedAt: &at,
	})
}

func publicServer(t *testing.T, articles []editorial.Article, cats ...editorial.Category) http.Handler {
	t.Helper()
	rev := editorial.NewRevision(
		"rev_art_1", "art_1", nil, "Budget 2026", "Approved body.",
		"usr_author", now,
	)
	deps := appeditorial.Deps{
		Articles:   faketesting.NewArticleStore(articles...),
		Revisions:  faketesting.NewRevisionStore(rev),
		Categories: faketesting.NewCategoryStore(cats...),
		Clock:      faketesting.FixedClock{At: now},
		IDs:        &faketesting.SequentialIDs{},
		Events:     &faketesting.RecordingEventBus{},
	}

	return routed(deps, nil)
}

func businessCat() editorial.Category {
	return editorial.ReconstituteCategory(editorial.CategoryState{
		ID:    "cat_business",
		Slugs: map[string]string{"en": "business", "fr": "economie"},
		Names: map[string]string{"en": "Business", "fr": "Économie"},
		Order: 1,
	})
}

func TestGetPublishedEndpoint(t *testing.T) {
	t.Parallel()

	handler := publicServer(t, []editorial.Article{liveArt("art_1", "budget-2026")})
	req := httptest.NewRequest(http.MethodGet, "/public/en/articles/budget-2026", nil)
	rec := do(handler, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
	var body map[string]json.RawMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if _, ok := body["article"]; !ok {
		t.Errorf("missing article in %s", rec.Body.String())
	}
}

func TestGetPublishedHidesDraft(t *testing.T) {
	t.Parallel()

	handler := publicServer(t, []editorial.Article{draftArt("art_1")})
	req := httptest.NewRequest(http.MethodGet, "/public/en/articles/budget-2026", nil)
	if rec := do(handler, req); rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestListPublishedEndpoint(t *testing.T) {
	t.Parallel()

	handler := publicServer(t, []editorial.Article{
		liveArt("art_1", "budget-2026"),
		draftArt("art_2"),
	})
	req := httptest.NewRequest(http.MethodGet, "/public/en/articles?limit=12", nil)
	if rec := do(handler, req); rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
}

func TestBrowseAndSectionsEndpoints(t *testing.T) {
	t.Parallel()

	handler := publicServer(t, []editorial.Article{liveArt("art_1", "budget-2026")}, businessCat())

	section := do(handler, httptest.NewRequest(http.MethodGet, "/public/en/sections/business", nil))
	if section.Code != http.StatusOK {
		t.Fatalf("browse status = %d body = %s", section.Code, section.Body.String())
	}

	missing := do(handler, httptest.NewRequest(http.MethodGet, "/public/en/sections/astrology", nil))
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing status = %d, want 404", missing.Code)
	}

	nav := do(handler, httptest.NewRequest(http.MethodGet, "/public/en/sections", nil))
	if nav.Code != http.StatusOK {
		t.Fatalf("nav status = %d body = %s", nav.Code, nav.Body.String())
	}
}
