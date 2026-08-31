// Command api serves the Kurasikapa backend.
//
// The composition root, and the only place allowed to know about both an
// adapter and a use case. Everything below this file talks to interfaces.
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	adaptercloudinary "github.com/kurasikapa/api/internal/adapter/cloudinary"
	adaptermongo "github.com/kurasikapa/api/internal/adapter/mongo"
	adapterpayments "github.com/kurasikapa/api/internal/adapter/payments"
	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	appmedia "github.com/kurasikapa/api/internal/app/media"
	apprevenue "github.com/kurasikapa/api/internal/app/revenue"
	kurahttp "github.com/kurasikapa/api/internal/http"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	if err := run(log); err != nil {
		log.Error("fatal", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	client, err := mongo.Connect(options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		return err
	}
	defer func() {
		disconnectCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = client.Disconnect(disconnectCtx)
	}()

	db := client.Database(cfg.MongoDB)

	// Ports on the left, adapters on the right. This is the only file where
	// both names appear.
	clock := systemClock{}
	articles := adaptermongo.NewArticleRepository(db, clock)
	revisions := adaptermongo.NewRevisionRepository(db)
	categories := adaptermongo.NewCategoryRepository(db)
	roles := adaptermongo.NewRoleRepository(db)
	televisionStore := adaptermongo.NewTelevisionRepositories(db)
	presenters := adaptermongo.NewPresenterRepository(televisionStore)
	programmes := adaptermongo.NewProgrammeRepository(televisionStore)
	schedule := adaptermongo.NewScheduleRepository(televisionStore)
	assets := adaptermongo.NewAssetRepository(db)
	podcasts := adaptermongo.NewPodcastRepository(db)
	episodes := adaptermongo.NewEpisodeRepository(db)
	galleries := adaptermongo.NewGalleryRepository(db)
	plans := adaptermongo.NewMembershipPlanRepository(db)
	subscriptions := adaptermongo.NewSubscriptionRepository(db)
	donations := adaptermongo.NewDonationRepository(db)
	adCampaigns := adaptermongo.NewAdCampaignRepository(db)
	adEvents := adaptermongo.NewAdEventRepository(db)
	uploads := adaptercloudinary.NewSigner(cfg.CloudinaryCloudName, cfg.CloudinaryAPIKey, cfg.CloudinaryAPISecret, "kurasikapa/media")
	payments := adapterpayments.NewGateway(http.DefaultClient, cfg.PaystackSecretKey, cfg.StripeSecretKey)
	paymentWebhooks := adapterpayments.NewWebhookVerifier(cfg.PaystackSecretKey, cfg.StripeWebhookSecret)

	if err := revisions.EnsureIndexes(ctx); err != nil {
		// Fatal, not a warning. The unique (articleId, seq) index is what makes
		// history monotonic — starting without it means a concurrent save can
		// silently lose a revision, which is the one failure this system must
		// not have.
		return err
	}

	if err := articles.EnsureIndexes(ctx); err != nil {
		// Also fatal. locale_slug_unique and family_locale_unique are
		// correctness rules the domain cannot enforce — without them a racing
		// double-save wins twice — and due_for_publication is what keeps the
		// publish cron a scan of scheduled articles only.
		return err
	}

	if err := categories.EnsureIndexes(ctx); err != nil {
		// slug_en_unique / slug_fr_unique are the same kind of rule: two
		// sections sharing a slug in a locale must be impossible, not merely
		// unlikely.
		return err
	}
	if err := televisionStore.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := assets.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := podcasts.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := episodes.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := galleries.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := plans.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := subscriptions.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := donations.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := adCampaigns.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := adEvents.EnsureIndexes(ctx); err != nil {
		return err
	}

	deps := appeditorial.Deps{
		Articles:   articles,
		Revisions:  revisions,
		Categories: categories,
		Assets:     assets,
		Clock:      clock,
		IDs:        uuidIDs{},
		Events:     loggingBus{log: log},
	}
	mediaDeps := appmedia.Deps{
		Presenters: presenters, Programmes: programmes, Schedule: schedule,
		Podcasts: podcasts, Episodes: episodes, Galleries: galleries, Assets: assets,
		Clock: clock, IDs: uuidIDs{},
	}
	revenueDeps := apprevenue.Deps{
		Plans: plans, Subscriptions: subscriptions, Donations: donations,
		AdCampaigns: adCampaigns, AdEvents: adEvents,
		Payments: payments, Clock: clock, IDs: uuidIDs{},
	}

	handler := kurahttp.NewRouter(kurahttp.Deps{
		CreateDraft:                appeditorial.NewCreateDraft(deps),
		UpdateDraft:                appeditorial.NewUpdateDraft(deps),
		AttachArticleHero:          appeditorial.NewAttachArticleHero(deps),
		GetDraft:                   appeditorial.NewGetDraft(deps),
		ListAuthoredArticles:       appeditorial.NewListAuthoredArticles(deps),
		ListAwaitingReview:         appeditorial.NewListAwaitingReview(deps),
		ListRevisions:              appeditorial.NewListRevisions(deps),
		RestoreRevision:            appeditorial.NewRestoreRevision(deps),
		SubmitForReview:            appeditorial.NewSubmitForReview(deps),
		ApproveArticle:             appeditorial.NewApproveArticle(deps),
		RejectArticle:              appeditorial.NewRejectArticle(deps),
		SchedulePublication:        appeditorial.NewSchedulePublication(deps),
		PublishArticle:             appeditorial.NewPublishArticle(deps),
		UnpublishArticle:           appeditorial.NewUnpublishArticle(deps),
		PublishDueArticles:         appeditorial.NewPublishDueArticles(deps),
		GetPublishedArticle:        appeditorial.NewGetPublishedArticle(deps),
		ListPublishedArticles:      appeditorial.NewListPublishedArticles(deps),
		BrowseCategory:             appeditorial.NewBrowseCategory(deps),
		ListSections:               appeditorial.NewListSections(deps),
		CreatePresenter:            appmedia.NewCreatePresenter(mediaDeps),
		PublishPresenter:           appmedia.NewPublishPresenter(mediaDeps),
		CreateProgramme:            appmedia.NewCreateProgramme(mediaDeps),
		PublishProgramme:           appmedia.NewPublishProgramme(mediaDeps),
		ScheduleProgramme:          appmedia.NewScheduleProgramme(mediaDeps),
		ListTelevisionGuide:        appmedia.NewListTelevisionGuide(mediaDeps),
		CreateAssetUpload:          appmedia.NewCreateAssetUpload(mediaDeps, assets, uploads),
		CompleteAssetUpload:        appmedia.NewCompleteAssetUpload(assets, uploads),
		ListAssets:                 appmedia.NewListAssets(assets),
		CreatePodcast:              appmedia.NewCreatePodcast(mediaDeps),
		PublishPodcast:             appmedia.NewPublishPodcast(mediaDeps),
		CreateEpisode:              appmedia.NewCreateEpisode(mediaDeps),
		PublishEpisode:             appmedia.NewPublishEpisode(mediaDeps),
		ListPodcastLibrary:         appmedia.NewListPodcastLibrary(mediaDeps),
		CreateGallery:              appmedia.NewCreateGallery(mediaDeps),
		PublishGallery:             appmedia.NewPublishGallery(mediaDeps),
		ListGalleryLibrary:         appmedia.NewListGalleryLibrary(mediaDeps),
		CreateMembershipPlan:       apprevenue.NewCreateMembershipPlan(revenueDeps),
		ActivateMembershipPlan:     apprevenue.NewActivateMembershipPlan(revenueDeps),
		ListMembershipPlans:        apprevenue.NewListMembershipPlans(revenueDeps),
		StartSubscription:          apprevenue.NewStartSubscription(revenueDeps),
		RecordDonation:             apprevenue.NewRecordDonation(revenueDeps),
		CheckEntitlement:           apprevenue.NewCheckEntitlement(revenueDeps),
		ConfirmSubscriptionPayment: apprevenue.NewConfirmSubscriptionPayment(revenueDeps),
		ConfirmDonationPayment:     apprevenue.NewConfirmDonationPayment(revenueDeps),
		BuildRevenueReport:         apprevenue.NewBuildRevenueReport(revenueDeps),
		CreateAdCampaign:           apprevenue.NewCreateAdCampaign(revenueDeps),
		ActivateAdCampaign:         apprevenue.NewActivateAdCampaign(revenueDeps),
		ResolveAdPlacement:         apprevenue.NewResolveAdPlacement(revenueDeps),
		RecordAdEvent:              apprevenue.NewRecordAdEvent(revenueDeps),
		BuildAdReport:              apprevenue.NewBuildAdReport(revenueDeps),
		PaymentWebhooks:            paymentWebhooks,
		Roles:                      roles,
		Clock:                      clock,
		Log:                        log,
		CronSecret:                 cfg.CronSecret,
	})

	server := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: handler,
		// Bounded on purpose. A server with no timeouts holds a connection for
		// ever when a client stops reading, and the symptom is exhaustion under
		// load rather than an error anyone can trace.
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		<-ctx.Done()

		// Drain rather than drop. A publish in flight when a deploy lands
		// should finish, not become a half-written article.
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	log.Info("listening", slog.String("addr", server.Addr))

	if err := server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}

	return nil
}

type systemClock struct{}

func (systemClock) Now() time.Time { return time.Now().UTC() }

type uuidIDs struct{}

// NewID returns a random 128-bit identifier as hex.
//
// crypto/rand, not math/rand. Ids appear in URLs, so a predictable one lets
// somebody guess the address of an unpublished draft.
func (uuidIDs) NewID() string {
	buf := make([]byte, 16)
	// rand.Read from crypto/rand never returns an error; it panics on failure,
	// which is correct — a process that cannot generate an id must not serve.
	_, _ = rand.Read(buf)

	return hex.EncodeToString(buf)
}
