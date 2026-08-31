package http

import (
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	appmedia "github.com/kurasikapa/api/internal/app/media"
	"github.com/kurasikapa/api/internal/app/ports"
	apprevenue "github.com/kurasikapa/api/internal/app/revenue"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

// Deps is what the transport layer needs. Use cases and ports, never adapters.
type Deps struct {
	CreateDraft                appeditorial.CreateDraft
	UpdateDraft                appeditorial.UpdateDraft
	GetDraft                   appeditorial.GetDraft
	ListAuthoredArticles       appeditorial.ListAuthoredArticles
	ListAwaitingReview         appeditorial.ListAwaitingReview
	ListRevisions              appeditorial.ListRevisions
	RestoreRevision            appeditorial.RestoreRevision
	SubmitForReview            appeditorial.SubmitForReview
	ApproveArticle             appeditorial.ApproveArticle
	RejectArticle              appeditorial.RejectArticle
	SchedulePublication        appeditorial.SchedulePublication
	PublishArticle             appeditorial.PublishArticle
	UnpublishArticle           appeditorial.UnpublishArticle
	PublishDueArticles         appeditorial.PublishDueArticles
	GetPublishedArticle        appeditorial.GetPublishedArticle
	ListPublishedArticles      appeditorial.ListPublishedArticles
	BrowseCategory             appeditorial.BrowseCategory
	ListSections               appeditorial.ListSections
	CreatePresenter            appmedia.CreatePresenter
	PublishPresenter           appmedia.PublishPresenter
	CreateProgramme            appmedia.CreateProgramme
	PublishProgramme           appmedia.PublishProgramme
	ScheduleProgramme          appmedia.ScheduleProgramme
	ListTelevisionGuide        appmedia.ListTelevisionGuide
	CreateAssetUpload          appmedia.CreateAssetUpload
	CompleteAssetUpload        appmedia.CompleteAssetUpload
	ListAssets                 appmedia.ListAssets
	CreatePodcast              appmedia.CreatePodcast
	PublishPodcast             appmedia.PublishPodcast
	CreateEpisode              appmedia.CreateEpisode
	PublishEpisode             appmedia.PublishEpisode
	ListPodcastLibrary         appmedia.ListPodcastLibrary
	CreateGallery              appmedia.CreateGallery
	PublishGallery             appmedia.PublishGallery
	ListGalleryLibrary         appmedia.ListGalleryLibrary
	CreateMembershipPlan       apprevenue.CreateMembershipPlan
	ActivateMembershipPlan     apprevenue.ActivateMembershipPlan
	ListMembershipPlans        apprevenue.ListMembershipPlans
	StartSubscription          apprevenue.StartSubscription
	RecordDonation             apprevenue.RecordDonation
	CheckEntitlement           apprevenue.CheckEntitlement
	ConfirmSubscriptionPayment apprevenue.ConfirmSubscriptionPayment
	ConfirmDonationPayment     apprevenue.ConfirmDonationPayment
	PaymentWebhooks            ports.PaymentWebhookVerifier
	Roles                      ports.RoleRepository
	Clock                      ports.Clock
	Log                        *slog.Logger
	CronSecret                 string
}

// NewRouter wires the HTTP surface.
func NewRouter(deps Deps) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, deps.Log, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("POST /articles", deps.handleCreateDraft)
	mux.HandleFunc("GET /me/articles", deps.handleListAuthored)
	mux.HandleFunc("GET /review", deps.handleListReview)
	mux.HandleFunc("GET /articles/{id}", deps.handleGetDraft)
	mux.HandleFunc("PATCH /articles/{id}", deps.handleUpdateDraft)
	mux.HandleFunc("GET /articles/{id}/revisions", deps.handleListRevisions)
	mux.HandleFunc("POST /articles/{id}/revisions/{rid}/restore", deps.handleRestore)
	mux.HandleFunc("POST /articles/{id}/submit", deps.handleSubmit)
	mux.HandleFunc("POST /articles/{id}/approve", deps.handleApprove)
	mux.HandleFunc("POST /articles/{id}/reject", deps.handleReject)
	mux.HandleFunc("POST /articles/{id}/schedule", deps.handleSchedule)
	mux.HandleFunc("POST /articles/{id}/publish", deps.handlePublish)
	mux.HandleFunc("POST /articles/{id}/unpublish", deps.handleUnpublish)
	mux.HandleFunc("POST /internal/publish-due", deps.handlePublishDue)
	mux.HandleFunc("GET /public/{locale}/articles/{slug}", deps.handleGetPublished)
	mux.HandleFunc("GET /public/{locale}/articles", deps.handleListPublished)
	mux.HandleFunc("GET /public/{locale}/sections/{slug}", deps.handleBrowseCategory)
	mux.HandleFunc("GET /public/{locale}/sections", deps.handleListSections)
	mux.HandleFunc("GET /public/{locale}/television", deps.handleTelevisionGuide)
	mux.HandleFunc("POST /television/presenters", deps.handleCreatePresenter)
	mux.HandleFunc("POST /television/presenters/{id}/publish", deps.handlePublishPresenter)
	mux.HandleFunc("POST /television/programmes", deps.handleCreateProgramme)
	mux.HandleFunc("POST /television/programmes/{id}/publish", deps.handlePublishProgramme)
	mux.HandleFunc("POST /television/schedule", deps.handleScheduleProgramme)
	mux.HandleFunc("POST /media/assets/uploads", deps.handleCreateAssetUpload)
	mux.HandleFunc("POST /media/assets/{id}/complete", deps.handleCompleteAssetUpload)
	mux.HandleFunc("GET /media/assets", deps.handleListAssets)
	mux.HandleFunc("POST /media/podcasts", deps.handleCreatePodcast)
	mux.HandleFunc("POST /media/podcasts/{id}/publish", deps.handlePublishPodcast)
	mux.HandleFunc("POST /media/episodes", deps.handleCreateEpisode)
	mux.HandleFunc("POST /media/episodes/{id}/publish", deps.handlePublishEpisode)
	mux.HandleFunc("GET /public/{locale}/podcasts", deps.handlePodcastLibrary)
	mux.HandleFunc("POST /media/galleries", deps.handleCreateGallery)
	mux.HandleFunc("POST /media/galleries/{id}/publish", deps.handlePublishGallery)
	mux.HandleFunc("GET /public/{locale}/galleries", deps.handleGalleryLibrary)
	mux.HandleFunc("POST /revenue/membership-plans", deps.handleCreateMembershipPlan)
	mux.HandleFunc("POST /revenue/membership-plans/{id}/activate", deps.handleActivateMembershipPlan)
	mux.HandleFunc("GET /public/{locale}/membership-plans", deps.handleListMembershipPlans)
	mux.HandleFunc("POST /revenue/subscriptions", deps.handleStartSubscription)
	mux.HandleFunc("POST /public/donations", deps.handleRecordDonation)
	mux.HandleFunc("GET /revenue/entitlement", deps.handleCheckEntitlement)
	mux.HandleFunc("POST /webhooks/payments/{provider}", deps.handlePaymentWebhook)

	return withRequestLogging(deps.Log, mux)
}

/*
Authentication is NOT performed here.

Next.js owns the Better Auth session cookie — a session must be set by the
origin the browser talks to — so it verifies the session and forwards the user
id on `X-Kurasikapa-User`. This service then resolves that id to an Actor
through its OWN role store and lets the domain decide.
*/
const userHeader = "X-Kurasikapa-User"

func (d Deps) actorFrom(r *http.Request) (identity.Actor, error) {
	id := r.Header.Get(userHeader)
	if id == "" {
		return identity.Actor{}, identity.ErrNotPermitted
	}

	roles, err := d.Roles.RolesFor(r.Context(), shared.UserID(id))
	if err != nil {
		return identity.Actor{}, err
	}

	return identity.NewActor(shared.UserID(id), roles), nil
}

func (d Deps) handlePublishDue(w http.ResponseWriter, r *http.Request) {
	if !d.requireCron(r) {
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

	status := http.StatusOK
	if len(result.Failed) > 0 {
		status = http.StatusMultiStatus
	}

	writeJSON(w, d.Log, status, result)
}

func decode(r *http.Request, into any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(into); err != nil {
		return fmt.Errorf("%w: %v", errMalformedRequest, err)
	}
	return nil
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

func articleView(a editorial.Article) articleResponse {
	view := articleResponse{
		ID: a.ID().String(), FamilyID: a.FamilyID().String(), Locale: a.Locale(),
		Slug: a.Slug().String(), Title: a.Title(), Status: string(a.Status()),
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

func (d Deps) requireCron(r *http.Request) bool {
	if d.CronSecret == "" {
		return false
	}

	presented, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok {
		return false
	}

	return len(presented) == len(d.CronSecret) &&
		subtle.ConstantTimeCompare([]byte(presented), []byte(d.CronSecret)) == 1
}

func systemActor() identity.Actor {
	return identity.NewActor("system:scheduler", []identity.Role{identity.RoleAdministrator})
}
