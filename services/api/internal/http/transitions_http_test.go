package http_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func serverWith(
	t *testing.T,
	granted map[shared.UserID][]identity.Role,
	articles []editorial.Article,
	revisions ...editorial.Revision,
) http.Handler {
	t.Helper()

	revStore := faketesting.NewRevisionStore()
	for _, rev := range revisions {
		_ = revStore.Append(t.Context(), rev)
	}

	deps := appeditorial.Deps{
		Articles:   faketesting.NewArticleStore(articles...),
		Revisions:  revStore,
		Categories: faketesting.NewCategoryStore(),
		Clock:      faketesting.FixedClock{At: now},
		IDs:        &faketesting.SequentialIDs{},
		Events:     &faketesting.RecordingEventBus{},
	}

	return routed(deps, granted)
}

func draftArt(id string) editorial.Article {
	return editorial.Reconstitute(editorial.ArticleState{
		ID: shared.ArticleID(id), Locale: "en", Slug: shared.SlugFrom("budget-2026"),
		Title: "Budget 2026", AuthorID: shared.UserID("usr_author"),
		Status: editorial.StatusDraft,
	})
}

func inReviewArt(id string) editorial.Article {
	return editorial.Reconstitute(editorial.ArticleState{
		ID: shared.ArticleID(id), Locale: "en", Slug: shared.SlugFrom("budget-2026"),
		Title: "Budget 2026", AuthorID: shared.UserID("usr_author"),
		Status: editorial.StatusInReview,
	})
}

func TestUpdateDraftEndpoint(t *testing.T) {
	t.Parallel()

	handler := serverWith(t, map[shared.UserID][]identity.Role{
		"usr_author": {identity.RoleAuthor},
	}, []editorial.Article{draftArt("art_1")}, editorial.NewRevision(
		"rev_1", "art_1", nil, "Budget 2026", "Old.", shared.UserID("usr_author"), now,
	))

	req := httptest.NewRequest(http.MethodPatch, "/articles/art_1",
		strings.NewReader(`{"title":"Budget Updated","body":"New text."}`))
	req.Header.Set("X-Kurasikapa-User", "usr_author")
	req.Header.Set("Content-Type", "application/json")

	if rec := do(handler, req); rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
}

func TestSubmitEndpoint(t *testing.T) {
	t.Parallel()

	handler := serverWith(t, map[shared.UserID][]identity.Role{
		"usr_author": {identity.RoleAuthor},
	}, []editorial.Article{draftArt("art_1")})

	req := httptest.NewRequest(http.MethodPost, "/articles/art_1/submit", nil)
	req.Header.Set("X-Kurasikapa-User", "usr_author")

	if rec := do(handler, req); rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
}

func TestApproveRejectScheduleUnpublishEndpoints(t *testing.T) {
	t.Parallel()

	revID := shared.RevisionID("rev_1")
	inReview := inReviewArt("art_1")
	approvedArt := editorial.Reconstitute(editorial.ArticleState{
		ID: "art_2", Locale: "en", Slug: shared.SlugFrom("markets"),
		Title: "Markets", AuthorID: "usr_author",
		Status: editorial.StatusApproved, ApprovedRevisionID: &revID,
	})
	publishedAt := now
	live := editorial.Reconstitute(editorial.ArticleState{
		ID: "art_3", Locale: "en", Slug: shared.SlugFrom("live-story"),
		Title: "Live", AuthorID: "usr_author",
		Status: editorial.StatusPublished, ApprovedRevisionID: &revID,
		PublishedAt: &publishedAt,
	})

	rolesGranted := map[shared.UserID][]identity.Role{
		"usr_editor": {identity.RoleEditor},
		"usr_admin":  {identity.RoleAdministrator},
	}

	t.Run("approve", func(t *testing.T) {
		t.Parallel()
		handler := serverWith(t, rolesGranted, []editorial.Article{inReview},
			editorial.NewRevision("rev_1", "art_1", nil, "Budget 2026", "Body.",
				shared.UserID("usr_author"), now))

		req := httptest.NewRequest(http.MethodPost, "/articles/art_1/approve",
			strings.NewReader(`{"revisionId":"rev_1"}`))
		req.Header.Set("X-Kurasikapa-User", "usr_editor")
		req.Header.Set("Content-Type", "application/json")

		if rec := do(handler, req); rec.Code != http.StatusOK {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("reject", func(t *testing.T) {
		t.Parallel()
		handler := serverWith(t, rolesGranted, []editorial.Article{inReview})

		req := httptest.NewRequest(http.MethodPost, "/articles/art_1/reject",
			strings.NewReader(`{"note":"Needs sources"}`))
		req.Header.Set("X-Kurasikapa-User", "usr_editor")
		req.Header.Set("Content-Type", "application/json")

		if rec := do(handler, req); rec.Code != http.StatusOK {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("schedule", func(t *testing.T) {
		t.Parallel()
		handler := serverWith(t, rolesGranted, []editorial.Article{approvedArt})
		at := now.Add(2 * time.Hour).UTC().Format(time.RFC3339)

		req := httptest.NewRequest(http.MethodPost, "/articles/art_2/schedule",
			strings.NewReader(`{"at":"`+at+`"}`))
		req.Header.Set("X-Kurasikapa-User", "usr_editor")
		req.Header.Set("Content-Type", "application/json")

		if rec := do(handler, req); rec.Code != http.StatusOK {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("unpublish", func(t *testing.T) {
		t.Parallel()
		handler := serverWith(t, rolesGranted, []editorial.Article{live})

		req := httptest.NewRequest(http.MethodPost, "/articles/art_3/unpublish",
			strings.NewReader(`{"reason":"Correction"}`))
		req.Header.Set("X-Kurasikapa-User", "usr_admin")
		req.Header.Set("Content-Type", "application/json")

		if rec := do(handler, req); rec.Code != http.StatusOK {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
	})
}

func TestRejectScheduleUnpublishErrorPaths(t *testing.T) {
	t.Parallel()

	inReview := editorial.Reconstitute(editorial.ArticleState{
		ID: "art_1", Locale: "en", Slug: shared.SlugFrom("budget-2026"),
		Title: "Budget 2026", AuthorID: "usr_author", Status: editorial.StatusInReview,
	})
	draft := draftArt("art_2")
	rolesGranted := map[shared.UserID][]identity.Role{
		"usr_editor": {identity.RoleEditor},
		"usr_admin":  {identity.RoleAdministrator},
	}

	t.Run("reject bad json", func(t *testing.T) {
		t.Parallel()
		handler := serverWith(t, rolesGranted, []editorial.Article{inReview})
		req := httptest.NewRequest(http.MethodPost, "/articles/art_1/reject",
			strings.NewReader(`{`))
		req.Header.Set("X-Kurasikapa-User", "usr_editor")
		if rec := do(handler, req); rec.Code == http.StatusOK {
			t.Error("accepted malformed JSON")
		}
	})

	t.Run("reject wrong state", func(t *testing.T) {
		t.Parallel()
		handler := serverWith(t, rolesGranted, []editorial.Article{draft})
		req := httptest.NewRequest(http.MethodPost, "/articles/art_2/reject",
			strings.NewReader(`{"note":"x"}`))
		req.Header.Set("X-Kurasikapa-User", "usr_editor")
		req.Header.Set("Content-Type", "application/json")
		if rec := do(handler, req); rec.Code != http.StatusConflict {
			t.Errorf("status = %d, want 409", rec.Code)
		}
	})

	t.Run("schedule bad json", func(t *testing.T) {
		t.Parallel()
		handler := serverWith(t, rolesGranted, []editorial.Article{inReview})
		req := httptest.NewRequest(http.MethodPost, "/articles/art_1/schedule",
			strings.NewReader(`{`))
		req.Header.Set("X-Kurasikapa-User", "usr_editor")
		if rec := do(handler, req); rec.Code == http.StatusOK {
			t.Error("accepted malformed JSON")
		}
	})

	t.Run("schedule wrong state", func(t *testing.T) {
		t.Parallel()
		handler := serverWith(t, rolesGranted, []editorial.Article{draft})
		at := now.Add(2 * time.Hour).UTC().Format(time.RFC3339)
		req := httptest.NewRequest(http.MethodPost, "/articles/art_2/schedule",
			strings.NewReader(`{"at":"`+at+`"}`))
		req.Header.Set("X-Kurasikapa-User", "usr_editor")
		req.Header.Set("Content-Type", "application/json")
		if rec := do(handler, req); rec.Code != http.StatusConflict {
			t.Errorf("status = %d, want 409", rec.Code)
		}
	})

	t.Run("unpublish bad json", func(t *testing.T) {
		t.Parallel()
		handler := serverWith(t, rolesGranted, []editorial.Article{draft})
		req := httptest.NewRequest(http.MethodPost, "/articles/art_2/unpublish",
			strings.NewReader(`{`))
		req.Header.Set("X-Kurasikapa-User", "usr_admin")
		if rec := do(handler, req); rec.Code == http.StatusOK {
			t.Error("accepted malformed JSON")
		}
	})

	t.Run("unpublish wrong state", func(t *testing.T) {
		t.Parallel()
		handler := serverWith(t, rolesGranted, []editorial.Article{draft})
		req := httptest.NewRequest(http.MethodPost, "/articles/art_2/unpublish",
			strings.NewReader(`{"reason":"x"}`))
		req.Header.Set("X-Kurasikapa-User", "usr_admin")
		req.Header.Set("Content-Type", "application/json")
		if rec := do(handler, req); rec.Code != http.StatusConflict {
			t.Errorf("status = %d, want 409", rec.Code)
		}
	})

	t.Run("update draft use-case failure", func(t *testing.T) {
		t.Parallel()
		handler := serverWith(t, map[shared.UserID][]identity.Role{
			"usr_author": {identity.RoleAuthor},
		}, []editorial.Article{inReview})
		req := httptest.NewRequest(http.MethodPatch, "/articles/art_1",
			strings.NewReader(`{"title":"Nope","body":"x"}`))
		req.Header.Set("X-Kurasikapa-User", "usr_author")
		req.Header.Set("Content-Type", "application/json")
		if rec := do(handler, req); rec.Code != http.StatusConflict {
			t.Errorf("status = %d, want 409", rec.Code)
		}
	})

	t.Run("approve execute failure", func(t *testing.T) {
		t.Parallel()
		handler := serverWith(t, rolesGranted, []editorial.Article{draft})
		req := httptest.NewRequest(http.MethodPost, "/articles/art_2/approve",
			strings.NewReader(`{"revisionId":"rev_1"}`))
		req.Header.Set("X-Kurasikapa-User", "usr_editor")
		req.Header.Set("Content-Type", "application/json")
		if rec := do(handler, req); rec.Code != http.StatusNotFound && rec.Code != http.StatusConflict {
			t.Errorf("status = %d, want 404 or 409", rec.Code)
		}
	})
}

func TestCronReturns207WhenSomeFail(t *testing.T) {
	t.Parallel()

	// A scheduled article without an approved revision will fail to publish;
	// the cron must report 207 rather than pretend the run was clean.
	scheduledAt := now.Add(-time.Hour)
	broken := editorial.Reconstitute(editorial.ArticleState{
		ID: "art_due", Locale: "en", Slug: shared.SlugFrom("due"),
		Title: "Due", AuthorID: "usr_author",
		Status: editorial.StatusScheduled, ScheduledAt: &scheduledAt,
	})

	handler := serverWith(t, map[shared.UserID][]identity.Role{}, []editorial.Article{broken})

	req := httptest.NewRequest(http.MethodPost, "/internal/publish-due", nil)
	req.Header.Set("Authorization", "Bearer s3cret-value-of-known-length-0000")

	if rec := do(handler, req); rec.Code != http.StatusMultiStatus {
		t.Errorf("status = %d, want 207 body=%s", rec.Code, rec.Body.String())
	}
}

func TestUpdateDraftBadJSONIsRefused(t *testing.T) {
	t.Parallel()

	handler := serverWith(t, map[shared.UserID][]identity.Role{
		"usr_author": {identity.RoleAuthor},
	}, []editorial.Article{draftArt("art_1")})

	req := httptest.NewRequest(http.MethodPatch, "/articles/art_1",
		strings.NewReader(`{"titel":"typo"}`))
	req.Header.Set("X-Kurasikapa-User", "usr_author")
	req.Header.Set("Content-Type", "application/json")

	if rec := do(handler, req); rec.Code != http.StatusInternalServerError &&
		rec.Code != http.StatusBadRequest {
		// decode errors are currently unmapped → 500; either way the draft is untouched.
		t.Errorf("status = %d, want an error status", rec.Code)
	}
}

func TestApproveBadJSONIsRefused(t *testing.T) {
	t.Parallel()

	handler := serverWith(t, map[shared.UserID][]identity.Role{
		"usr_editor": {identity.RoleEditor},
	}, []editorial.Article{inReviewArt("art_1")})

	req := httptest.NewRequest(http.MethodPost, "/articles/art_1/approve",
		strings.NewReader(`{"revisionId":`))
	req.Header.Set("X-Kurasikapa-User", "usr_editor")
	req.Header.Set("Content-Type", "application/json")

	if rec := do(handler, req); rec.Code == http.StatusOK {
		t.Error("accepted malformed JSON")
	}
}

func TestSubmitConflictWhenNotDraft(t *testing.T) {
	t.Parallel()

	handler := serverWith(t, map[shared.UserID][]identity.Role{
		"usr_author": {identity.RoleAuthor},
	}, []editorial.Article{inReviewArt("art_1")})

	req := httptest.NewRequest(http.MethodPost, "/articles/art_1/submit", nil)
	req.Header.Set("X-Kurasikapa-User", "usr_author")

	if rec := do(handler, req); rec.Code != http.StatusConflict {
		t.Errorf("status = %d, want 409", rec.Code)
	}
}
