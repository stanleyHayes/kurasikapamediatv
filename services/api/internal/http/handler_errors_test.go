package http_test

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
	kurahttp "github.com/kurasikapa/api/internal/http"
)

func depsWithStores(articles *faketesting.ArticleStore, cats *faketesting.CategoryStore) appeditorial.Deps {
	return appeditorial.Deps{
		Articles:   articles,
		Revisions:  faketesting.NewRevisionStore(),
		Categories: cats,
		Clock:      faketesting.FixedClock{At: now},
		IDs:        &faketesting.SequentialIDs{},
		Events:     &faketesting.RecordingEventBus{},
	}
}

func TestPublishRequiresAnIdentifiedCaller(t *testing.T) {
	t.Parallel()

	// The header is the only identity this service sees, so publish must
	// refuse before the use case is ever asked.
	handler := newServer(t, authorRoles(), approved("art_1"))

	req := httptest.NewRequest(http.MethodPost, "/articles/art_1/publish", nil)
	if rec := do(handler, req); rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", rec.Code)
	}
}

func TestQueryEndpointsRefuseAnonymousAndMissing(t *testing.T) {
	t.Parallel()

	t.Run("draft is not readable without identity", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodGet, "/articles/art_1", nil)
		if rec := do(seededDraft(t), req); rec.Code != http.StatusForbidden {
			t.Errorf("status = %d, want 403", rec.Code)
		}
	})

	t.Run("missing draft is a 404", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodGet, "/articles/art_nope", nil)
		req.Header.Set("X-Kurasikapa-User", "usr_author")
		if rec := do(seededDraft(t), req); rec.Code != http.StatusNotFound {
			t.Errorf("status = %d, want 404", rec.Code)
		}
	})

	t.Run("history of a missing article is a 404", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodGet, "/articles/art_nope/revisions", nil)
		req.Header.Set("X-Kurasikapa-User", "usr_author")
		if rec := do(seededDraft(t), req); rec.Code != http.StatusNotFound {
			t.Errorf("status = %d, want 404", rec.Code)
		}
	})

	t.Run("restoring an unknown revision is a 404", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodPost, "/articles/art_1/revisions/rev_nope/restore", nil)
		req.Header.Set("X-Kurasikapa-User", "usr_author")
		if rec := do(seededDraft(t), req); rec.Code != http.StatusNotFound {
			t.Errorf("status = %d, want 404", rec.Code)
		}
	})
}

func TestListEndpointsSurfaceStoreFailures(t *testing.T) {
	t.Parallel()

	// A failed read must reach the caller as a 500; the only worse outcome is
	// an empty 200 that looks like "nothing there".
	t.Run("authored list", func(t *testing.T) {
		t.Parallel()
		articles := faketesting.NewArticleStore()
		articles.FailListAuthored = errBoom{}
		handler := routed(depsWithStores(articles, faketesting.NewCategoryStore()), authorRoles())

		req := httptest.NewRequest(http.MethodGet, "/me/articles", nil)
		req.Header.Set("X-Kurasikapa-User", "usr_author")
		if rec := do(handler, req); rec.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want 500", rec.Code)
		}
	})

	t.Run("published list", func(t *testing.T) {
		t.Parallel()
		articles := faketesting.NewArticleStore()
		articles.FailListPublished = errBoom{}
		handler := routed(depsWithStores(articles, faketesting.NewCategoryStore()), nil)

		req := httptest.NewRequest(http.MethodGet, "/public/en/articles", nil)
		if rec := do(handler, req); rec.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want 500", rec.Code)
		}
	})

	t.Run("sections", func(t *testing.T) {
		t.Parallel()
		cats := faketesting.NewCategoryStore()
		cats.FailList = errBoom{}
		handler := routed(depsWithStores(faketesting.NewArticleStore(), cats), nil)

		req := httptest.NewRequest(http.MethodGet, "/public/en/sections", nil)
		if rec := do(handler, req); rec.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want 500", rec.Code)
		}
	})
}

// brokenWriter fails on Write, after the status has already gone out.
type brokenWriter struct{ header http.Header }

func (w brokenWriter) Header() http.Header     { return w.header }
func (brokenWriter) WriteHeader(int)           {}
func (brokenWriter) Write([]byte) (int, error) { return 0, errBoom{} }

func TestWriteJSONLogsAnEncodeFailure(t *testing.T) {
	t.Parallel()

	// Once WriteHeader has run nothing can be done for the caller — but a
	// response nobody can parse must not be invisible in the log either.
	var buf bytes.Buffer
	handler := kurahttp.NewRouter(kurahttp.Deps{
		Log: slog.New(slog.NewTextHandler(&buf, nil)),
	})

	handler.ServeHTTP(brokenWriter{header: http.Header{}},
		httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if !bytes.Contains(buf.Bytes(), []byte("encoding response")) {
		t.Errorf("encode failure was not logged, got %q", buf.String())
	}
}
