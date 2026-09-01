package http_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/app/ports"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
	kurahttp "github.com/kurasikapa/api/internal/http"
)

var now = time.Date(2026, 8, 9, 12, 0, 0, 0, time.UTC)

/** A role store the test controls, so authorisation can be varied per case. */
type roles struct {
	granted map[shared.UserID][]identity.Role
	err     error
}

func (r roles) RolesFor(_ context.Context, id shared.UserID) ([]identity.Role, error) {
	if r.err != nil {
		return nil, r.err
	}

	return r.granted[id], nil
}

func (roles) Replace(_ context.Context, _ shared.UserID, _ []identity.Role) error { return nil }

func approved(id string) editorial.Article {
	slug := shared.SlugFrom("budget-2026")
	revID := shared.RevisionID("rev_1")

	return editorial.Reconstitute(editorial.ArticleState{
		ID:                 shared.ArticleID(id),
		Locale:             "en",
		Slug:               slug,
		Title:              "Budget 2026",
		AuthorID:           shared.UserID("usr_author"),
		Status:             editorial.StatusApproved,
		ApprovedRevisionID: &revID,
	})
}

func newServer(t *testing.T, granted map[shared.UserID][]identity.Role, seed ...editorial.Article) http.Handler {
	t.Helper()

	deps := appeditorial.Deps{
		Articles:   faketesting.NewArticleStore(seed...),
		Revisions:  faketesting.NewRevisionStore(),
		Categories: faketesting.NewCategoryStore(),
		Clock:      faketesting.FixedClock{At: now},
		IDs:        &faketesting.SequentialIDs{},
		Events:     &faketesting.RecordingEventBus{},
	}

	return routed(deps, granted)
}

func do(handler http.Handler, req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	return rec
}

func draftRequest(userID string) *http.Request {
	body := `{"locale":"en","title":"Budget 2026","body":"Text.","categoryId":"cat_business","familyId":""}`
	req := httptest.NewRequest(http.MethodPost, "/articles", strings.NewReader(body))
	if userID != "" {
		req.Header.Set("X-Kurasikapa-User", userID)
	}

	return req
}

func TestHealthzTouchesNothing(t *testing.T) {
	t.Parallel()

	// A health check that queries the database reports the database, and a
	// platform that restarts the service because Mongo blinked has made an
	// outage worse. Passing a nil role store proves it reaches no dependency.
	handler := kurahttp.NewRouter(kurahttp.Deps{
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
	})

	rec := do(handler, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d", rec.Code)
	}
}

func TestAnonymousRequestIsRefused(t *testing.T) {
	t.Parallel()

	// No forwarded user header means no Actor. This service trusts the header,
	// so it must be absent-means-refused rather than absent-means-anonymous.
	handler := newServer(t, map[shared.UserID][]identity.Role{})

	rec := do(handler, draftRequest(""))

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", rec.Code)
	}
}

func TestRolesComeFromOurStoreNotTheRequest(t *testing.T) {
	t.Parallel()

	// The header names WHO, never WHAT THEY MAY DO. A caller who could assert
	// their own roles would make the authorisation model decorative — so a
	// user we hold no grant for is refused, however they identify.
	handler := newServer(t, map[shared.UserID][]identity.Role{})

	rec := do(handler, draftRequest("usr_stranger"))

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", rec.Code)
	}
}

func TestActorAssertionRequiresTheCallingService(t *testing.T) {
	t.Parallel()

	app := appeditorial.Deps{
		Articles: faketesting.NewArticleStore(), Revisions: faketesting.NewRevisionStore(),
		Categories: faketesting.NewCategoryStore(), Clock: faketesting.FixedClock{At: now},
		IDs: &faketesting.SequentialIDs{}, Events: &faketesting.RecordingEventBus{},
	}
	deps := httpDeps(app, map[shared.UserID][]identity.Role{"usr_author": {identity.RoleAuthor}})
	deps.ActorSecret = "service-assertion-secret-of-known-length"
	handler := kurahttp.NewRouter(deps)

	for name, bearer := range map[string]string{
		"missing": "", "wrong": "Bearer attacker-controlled-value-000000",
	} {
		t.Run(name, func(t *testing.T) {
			req := draftRequest("usr_author")
			req.Header.Set("Authorization", bearer)
			if rec := do(handler, req); rec.Code != http.StatusForbidden {
				t.Errorf("status = %d, want 403", rec.Code)
			}
		})
	}

	req := draftRequest("usr_author")
	req.Header.Set("Authorization", "Bearer service-assertion-secret-of-known-length")
	if rec := do(handler, req); rec.Code != http.StatusCreated {
		t.Errorf("status = %d, want 201; body = %s", rec.Code, rec.Body.String())
	}
}

func TestAuthorMayCreateADraft(t *testing.T) {
	t.Parallel()

	handler := newServer(t, map[shared.UserID][]identity.Role{
		"usr_author": {identity.RoleAuthor},
	})

	rec := do(handler, draftRequest("usr_author"))

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding: %v", err)
	}
	if body["slug"] != "budget-2026" {
		t.Errorf("slug = %v", body["slug"])
	}
	if body["status"] != "draft" {
		t.Errorf("status = %v", body["status"])
	}
}

func TestUnknownFieldsAreRefused(t *testing.T) {
	t.Parallel()

	// A caller sending `titel` should be told, not silently handed an article
	// with no headline.
	handler := newServer(t, map[shared.UserID][]identity.Role{
		"usr_author": {identity.RoleAuthor},
	})

	req := httptest.NewRequest(http.MethodPost, "/articles", strings.NewReader(`{"titel":"Oops"}`))
	req.Header.Set("X-Kurasikapa-User", "usr_author")

	if rec := do(handler, req); rec.Code == http.StatusCreated {
		t.Error("a misspelled field was accepted")
	}
}

func TestPublishMapsDomainRefusalsToStatuses(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		user   string
		grant  []identity.Role
		want   int
		wantID string
	}{
		{"an editor may publish", "usr_editor", []identity.Role{identity.RoleEditor}, http.StatusOK, "art_1"},
		{
			// 403, not 404: they are authenticated and being told they may not.
			// A 404 would make an editor think their article had vanished.
			"an author may not publish", "usr_author", []identity.Role{identity.RoleAuthor},
			http.StatusForbidden, "art_1",
		},
		{
			"a missing article is a 404", "usr_editor", []identity.Role{identity.RoleEditor},
			http.StatusNotFound, "art_nope",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			handler := newServer(t, map[shared.UserID][]identity.Role{
				shared.UserID(tc.user): tc.grant,
			}, approved("art_1"))

			req := httptest.NewRequest(http.MethodPost, "/articles/"+tc.wantID+"/publish", nil)
			req.Header.Set("X-Kurasikapa-User", tc.user)

			if rec := do(handler, req); rec.Code != tc.want {
				t.Errorf("status = %d, want %d", rec.Code, tc.want)
			}
		})
	}
}

func TestPublishingSomethingUnapprovedIsAConflict(t *testing.T) {
	t.Parallel()

	// 409, not 400: the request is well-formed and the article is simply not
	// in a state where this can happen. 400 would tell the caller to change
	// their payload, which would not help.
	draft := editorial.Reconstitute(editorial.ArticleState{
		ID: shared.ArticleID("art_1"), Locale: "en", Slug: shared.SlugFrom("x"),
		Status: editorial.StatusDraft,
	})
	handler := newServer(t, map[shared.UserID][]identity.Role{
		"usr_editor": {identity.RoleEditor},
	}, draft)

	req := httptest.NewRequest(http.MethodPost, "/articles/art_1/publish", nil)
	req.Header.Set("X-Kurasikapa-User", "usr_editor")

	if rec := do(handler, req); rec.Code != http.StatusConflict {
		t.Errorf("status = %d, want 409", rec.Code)
	}
}

func TestCronEndpointRefusesWithoutTheSecret(t *testing.T) {
	t.Parallel()

	handler := newServer(t, map[shared.UserID][]identity.Role{})

	cases := map[string]string{
		"no header":           "",
		"wrong secret":        "Bearer wrong",
		"right length, wrong": "Bearer 0000000000000000000000000000000000",
		// The bare secret with no scheme. TrimPrefix accepted this; CutPrefix
		// does not.
		"correct secret, no scheme": "s3cret-value-of-known-length-0000",
	}

	for name, header := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodPost, "/internal/publish-due", nil)
			if header != "" {
				req.Header.Set("Authorization", header)
			}

			// 404, not 401: an unauthorised caller learns nothing about
			// whether a scheduling endpoint exists here at all.
			if rec := do(handler, req); rec.Code != http.StatusNotFound {
				t.Errorf("status = %d, want 404", rec.Code)
			}
		})
	}
}

func TestCronEndpointRunsWithTheSecret(t *testing.T) {
	t.Parallel()

	handler := newServer(t, map[shared.UserID][]identity.Role{})

	req := httptest.NewRequest(http.MethodPost, "/internal/publish-due", nil)
	req.Header.Set("Authorization", "Bearer s3cret-value-of-known-length-0000")

	if rec := do(handler, req); rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
}

func TestCronEndpointRefusesEverythingWhenUnconfigured(t *testing.T) {
	t.Parallel()

	// "Unconfigured" is not a reason to run an endpoint that publishes
	// articles unprotected — it is a reason not to run it.
	handler := kurahttp.NewRouter(kurahttp.Deps{
		Log:        slog.New(slog.NewTextHandler(io.Discard, nil)),
		CronSecret: "",
	})

	req := httptest.NewRequest(http.MethodPost, "/internal/publish-due", nil)
	req.Header.Set("Authorization", "Bearer ")

	if rec := do(handler, req); rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestUnexpectedErrorsDoNotLeakTheirMessage(t *testing.T) {
	t.Parallel()

	// An unmapped error is by definition one we have no safe sentence for, and
	// forwarding it can hand a connection string to whoever made the request.
	handler := kurahttp.NewRouter(kurahttp.Deps{
		Roles: roles{err: errBoom{}},
		Log:   slog.New(slog.NewTextHandler(io.Discard, nil)),
	})

	rec := do(handler, draftRequest("usr_author"))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "mongodb://") {
		t.Error("the response leaked the underlying error")
	}
}

type errBoom struct{}

func (errBoom) Error() string { return "mongodb://user:hunter2@cluster.internal/kurasikapa" }

var _ ports.RoleRepository = roles{}

func TestCronResponseShapeIsStable(t *testing.T) {
	t.Parallel()

	// A wire contract, so it is asserted rather than eyeballed. Untagged Go
	// structs emit "Published"/"Failed", which is inconsistent with every
	// other response here — the sort of thing a client works around silently
	// rather than reports.
	handler := newServer(t, map[shared.UserID][]identity.Role{})

	req := httptest.NewRequest(http.MethodPost, "/internal/publish-due", nil)
	req.Header.Set("Authorization", "Bearer s3cret-value-of-known-length-0000")

	rec := do(handler, req)

	var body map[string]json.RawMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding: %v", err)
	}

	for _, key := range []string{"published", "failed"} {
		if _, ok := body[key]; !ok {
			t.Errorf("missing %q in %s", key, rec.Body.String())
		}
	}

	// Empty arrays, never null. A client doing `failed.length` on null
	// crashes, and "nothing failed" is worth stating positively.
	if string(body["failed"]) != "[]" || string(body["published"]) != "[]" {
		t.Errorf("empty result should be [], got %s", rec.Body.String())
	}
}
