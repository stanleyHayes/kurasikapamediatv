package http

import (
	"crypto/subtle"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

// Deps is what the transport layer needs. Use cases and ports, never adapters.
type Deps struct {
	CreateDraft        appeditorial.CreateDraft
	PublishArticle     appeditorial.PublishArticle
	PublishDueArticles appeditorial.PublishDueArticles
	Roles              ports.RoleRepository
	Log                *slog.Logger
	// CronSecret guards the scheduled-publication endpoint. Empty means the
	// endpoint refuses everything — see requireCron.
	CronSecret string
}

// NewRouter wires the HTTP surface.
//
// Go 1.22+ patterns carry the method, so there is no "405 handler" to forget
// and no switch on r.Method at the top of every function.
func NewRouter(deps Deps) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		// Deliberately touches nothing. A health check that queries the
		// database reports the database, and a platform that restarts the
		// service because Mongo blinked has made an outage worse.
		writeJSON(w, deps.Log, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("POST /articles", deps.handleCreateDraft)
	mux.HandleFunc("POST /articles/{id}/publish", deps.handlePublish)
	mux.HandleFunc("POST /internal/publish-due", deps.handlePublishDue)

	return withRequestLogging(deps.Log, mux)
}

/*
Authentication is NOT performed here.

Next.js owns the Better Auth session cookie — a session must be set by the
origin the browser talks to — so it verifies the session and forwards the user
id on `X-Kurasikapa-User`. This service then resolves that id to an Actor
through its OWN role store and lets the domain decide.

That split is the whole of ADR-0009: Next says who someone is, and this service
says what they may do. It also means the header is trusted, so this service
MUST NOT be publicly routable — it sits behind the platform's private
networking, and that is a deployment requirement, not a suggestion.
*/
const userHeader = "X-Kurasikapa-User"

func (d Deps) actorFrom(r *http.Request) (identity.Actor, error) {
	id := r.Header.Get(userHeader)
	if id == "" {
		return identity.Actor{}, identity.ErrNotPermitted
	}

	// Roles are read on every request, never carried in the header. A
	// revocation has to land on the next request rather than whenever a token
	// happens to expire — and a caller who could name their own roles would
	// make the whole authorisation model decorative.
	roles, err := d.Roles.RolesFor(r.Context(), shared.UserID(id))
	if err != nil {
		return identity.Actor{}, err
	}

	return identity.NewActor(shared.UserID(id), roles), nil
}

type createDraftBody struct {
	Locale     string `json:"locale"`
	Title      string `json:"title"`
	Body       string `json:"body"`
	CategoryID string `json:"categoryId"`
	FamilyID   string `json:"familyId"`
}

func (d Deps) handleCreateDraft(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}

	var body createDraftBody
	if err := decode(r, &body); err != nil {
		writeProblem(w, d.Log, err)

		return
	}

	article, err := d.CreateDraft.Execute(r.Context(), appeditorial.CreateDraftInput{
		Actor:    actor,
		Locale:   body.Locale,
		Title:    body.Title,
		Body:     body.Body,
		Category: shared.CategoryID(body.CategoryID),
		FamilyID: shared.FamilyID(body.FamilyID),
	})
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}

	writeJSON(w, d.Log, http.StatusCreated, articleView(article))
}

func (d Deps) handlePublish(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}

	article, err := d.PublishArticle.Execute(r.Context(), appeditorial.PublishArticleInput{
		Actor:     actor,
		ArticleID: shared.ArticleID(r.PathValue("id")),
	})
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}

	writeJSON(w, d.Log, http.StatusOK, articleView(article))
}

// handlePublishDue is the scheduled-publication cron.
//
// Guarded by a shared secret rather than a user header: there is no user. It
// acts as a system identity holding article:publish, so the same domain rules
// decide for a machine as for a person.
func (d Deps) handlePublishDue(w http.ResponseWriter, r *http.Request) {
	if !d.requireCron(r) {
		// 404, not 401: an unauthorised caller learns nothing about whether a
		// scheduling endpoint exists here at all.
		http.NotFound(w, r)

		return
	}

	result, err := d.PublishDueArticles.Execute(r.Context(), systemActor())
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}

	if len(result.Failed) > 0 {
		d.Log.Error("scheduled publication failures",
			slog.Int("count", len(result.Failed)),
			slog.Any("failures", result.Failed))
	}

	// 207 when some failed: the run happened, and a flat 200 would let an
	// uptime check call a half-failed publication healthy.
	status := http.StatusOK
	if len(result.Failed) > 0 {
		status = http.StatusMultiStatus
	}

	writeJSON(w, d.Log, status, result)
}

func decode(r *http.Request, into any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	// Unknown fields are an error, not a shrug. A caller sending `titel` should
	// be told, not silently given an article with no headline.
	decoder.DisallowUnknownFields()

	return decoder.Decode(into)
}

type articleResponse struct {
	ID          string     `json:"id"`
	FamilyID    string     `json:"familyId"`
	Locale      string     `json:"locale"`
	Slug        string     `json:"slug"`
	Title       string     `json:"title"`
	Status      string     `json:"status"`
	PublishedAt *time.Time `json:"publishedAt"`
}

// articleView is the wire shape, kept separate from the aggregate.
//
// Serialising the domain object directly would make every field rename a
// breaking API change, and would leak whatever the aggregate happens to hold.
func articleView(a editorial.Article) articleResponse {
	view := articleResponse{
		ID:       a.ID().String(),
		FamilyID: a.FamilyID().String(),
		Locale:   a.Locale(),
		Slug:     a.Slug().String(),
		Title:    a.Title(),
		Status:   string(a.Status()),
	}

	if at, ok := a.PublishedAt(); ok {
		view.PublishedAt = &at
	}

	return view
}

func withRequestLogging(log *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		next.ServeHTTP(w, r)

		log.Info("request",
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.Duration("took", time.Since(started)))
	})
}

/*
requireCron authorises the scheduled-publication endpoint.

An unset secret REFUSES everything. "Unconfigured" is not a reason to run an
endpoint that publishes articles unprotected — it is a reason not to run it.

Compared in constant time. The lengths are compared first and separately
because subtle.ConstantTimeCompare returns 0 for a length mismatch without
comparing, which on its own would leak length through timing; hashing is
overkill here, so the check is explicit and the cost is uniform.
*/
func (d Deps) requireCron(r *http.Request) bool {
	if d.CronSecret == "" {
		return false
	}

	// CutPrefix, not TrimPrefix. TrimPrefix returns the string UNCHANGED when
	// the prefix is absent, so the bare secret with no scheme was accepted —
	// caught by a test that sent exactly that.
	presented, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok {
		return false
	}

	return len(presented) == len(d.CronSecret) &&
		subtle.ConstantTimeCompare([]byte(presented), []byte(d.CronSecret)) == 1
}

/*
systemActor is the identity the cron acts as.

Not a bypass. The cron is given an Actor like anything else and the same domain
rules decide — a back door would mean the one code path nobody watches is also
the one with no rules. `administrator` rather than super admin: it publishes,
it never assigns roles.
*/
func systemActor() identity.Actor {
	return identity.NewActor("system:scheduler", []identity.Role{identity.RoleAdministrator})
}
