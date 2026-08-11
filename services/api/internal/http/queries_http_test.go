package http_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func authorRoles() map[shared.UserID][]identity.Role {
	return map[shared.UserID][]identity.Role{"usr_author": {identity.RoleAuthor}}
}

func seededDraft(t *testing.T) http.Handler {
	t.Helper()
	rev := editorial.NewRevision(
		"rev_1", "art_1", nil, "Budget 2026", "Opening text.",
		shared.UserID("usr_author"), now,
	)

	return serverWith(t, authorRoles(), []editorial.Article{draftArt("art_1")}, rev)
}

func TestGetDraftEndpoint(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/articles/art_1", nil)
	req.Header.Set("X-Kurasikapa-User", "usr_author")
	rec := do(seededDraft(t), req)
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

func TestListRevisionsEndpoint(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/articles/art_1/revisions", nil)
	req.Header.Set("X-Kurasikapa-User", "usr_author")
	if rec := do(seededDraft(t), req); rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
}

func TestRestoreEndpoint(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodPost, "/articles/art_1/revisions/rev_1/restore", nil)
	req.Header.Set("X-Kurasikapa-User", "usr_author")
	if rec := do(seededDraft(t), req); rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
}

func TestAuthoredListEndpoint(t *testing.T) {
	t.Parallel()

	handler := serverWith(t, authorRoles(), []editorial.Article{draftArt("art_1")})
	req := httptest.NewRequest(http.MethodGet, "/me/articles", nil)
	req.Header.Set("X-Kurasikapa-User", "usr_author")
	if rec := do(handler, req); rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
}

func TestReviewQueueEndpoint(t *testing.T) {
	t.Parallel()

	rolesGranted := map[shared.UserID][]identity.Role{
		"usr_author": {identity.RoleAuthor},
		"usr_editor": {identity.RoleEditor},
	}
	handler := serverWith(t, rolesGranted, []editorial.Article{inReviewArt("art_2")})

	ok := httptest.NewRequest(http.MethodGet, "/review", nil)
	ok.Header.Set("X-Kurasikapa-User", "usr_editor")
	if rec := do(handler, ok); rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}

	denied := httptest.NewRequest(http.MethodGet, "/review", nil)
	denied.Header.Set("X-Kurasikapa-User", "usr_author")
	if rec := do(handler, denied); rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", rec.Code)
	}
}
