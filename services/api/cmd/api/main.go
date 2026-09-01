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
	adapterembedding "github.com/kurasikapa/api/internal/adapter/embedding"
	adaptermongo "github.com/kurasikapa/api/internal/adapter/mongo"
	adapternarration "github.com/kurasikapa/api/internal/adapter/narration"
	adapterpayments "github.com/kurasikapa/api/internal/adapter/payments"
	adapterrecording "github.com/kurasikapa/api/internal/adapter/recording"
	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	appidentity "github.com/kurasikapa/api/internal/app/identity"
	appinsight "github.com/kurasikapa/api/internal/app/insight"
	appmedia "github.com/kurasikapa/api/internal/app/media"
	"github.com/kurasikapa/api/internal/app/ports"
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
	staffProfiles := adaptermongo.NewStaffProfileRepository(db)
	televisionStore := adaptermongo.NewTelevisionRepositories(db)
	presenters := adaptermongo.NewPresenterRepository(televisionStore)
	programmes := adaptermongo.NewProgrammeRepository(televisionStore)
	schedule := adaptermongo.NewScheduleRepository(televisionStore)
	assets := adaptermongo.NewAssetRepository(db)
	narrationJobs := adaptermongo.NewNarrationJobRepository(db)
	recordingImports := adaptermongo.NewRecordingImportRepository(db)
	podcasts := adaptermongo.NewPodcastRepository(db)
	episodes := adaptermongo.NewEpisodeRepository(db)
	galleries := adaptermongo.NewGalleryRepository(db)
	events := adaptermongo.NewEventRepository(db)
	semantic := adaptermongo.NewSemanticRepository(db)
	plans := adaptermongo.NewMembershipPlanRepository(db)
	subscriptions := adaptermongo.NewSubscriptionRepository(db)
	donations := adaptermongo.NewDonationRepository(db)
	adCampaigns := adaptermongo.NewAdCampaignRepository(db)
	adEvents := adaptermongo.NewAdEventRepository(db)
	advertiserProposals := adaptermongo.NewAdvertiserProposalRepository(db)
	products := adaptermongo.NewProductRepository(db)
	productOrders := adaptermongo.NewProductOrderRepository(db)
	classifieds := adaptermongo.NewClassifiedRepository(db)
	affiliateLinks := adaptermongo.NewAffiliateLinkRepository(db)
	uploads := adaptercloudinary.NewSigner(cfg.CloudinaryCloudName, cfg.CloudinaryAPIKey, cfg.CloudinaryAPISecret, "kurasikapa/media")
	videoDelivery := adaptercloudinary.NewDelivery()
	embeddings := adapterembedding.NewVoyage(http.DefaultClient, cfg.VoyageAPIKey, cfg.VoyageModel, cfg.VoyageDimensions)
	payments := adapterpayments.NewGateway(http.DefaultClient, cfg.PaystackSecretKey, cfg.StripeSecretKey)
	paymentWebhooks := adapterpayments.NewWebhookVerifier(cfg.PaystackSecretKey, cfg.StripeWebhookSecret)
	var narrationProvider ports.NarrationProvider = adapternarration.Unavailable{}
	if cfg.NarrationBucket != "" {
		provider, providerErr := adapternarration.New(ctx, adapternarration.Config{
			Region: cfg.NarrationRegion, Bucket: cfg.NarrationBucket,
			CloudName: cfg.CloudinaryCloudName, CloudinaryKey: cfg.CloudinaryAPIKey,
			CloudinarySecret: cfg.CloudinaryAPISecret, Folder: "kurasikapa/narrations",
			Clock: clock,
		})
		if providerErr != nil {
			return providerErr
		}
		narrationProvider = provider
	}
	var recordingProvider ports.RecordingPromotionPort = adapterrecording.Unavailable{}
	if cfg.IVSRecordingBucket != "" {
		provider, providerErr := adapterrecording.New(ctx, adapterrecording.Config{
			Region: cfg.IVSRegion, SourceBucket: cfg.IVSRecordingBucket,
			OutputBucket: cfg.MediaConvertBucket, RoleARN: cfg.MediaConvertRoleARN,
			JobTemplate: cfg.MediaConvertTemplate, OutputPrefix: "kurasikapa/recordings",
			CloudName: cfg.CloudinaryCloudName, CloudinaryKey: cfg.CloudinaryAPIKey,
			CloudinarySecret: cfg.CloudinaryAPISecret, Clock: clock,
		})
		if providerErr != nil {
			return providerErr
		}
		recordingProvider = provider
	}

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
	if err := staffProfiles.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := assets.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := narrationJobs.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := recordingImports.EnsureIndexes(ctx); err != nil {
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
	if err := events.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := semantic.EnsureIndexes(ctx); err != nil {
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
	if err := advertiserProposals.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := products.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := productOrders.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := classifieds.EnsureIndexes(ctx); err != nil {
		return err
	}
	if err := affiliateLinks.EnsureIndexes(ctx); err != nil {
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
		Semantic:   semantic,
	}
	mediaDeps := appmedia.Deps{
		Presenters: presenters, Programmes: programmes, Schedule: schedule,
		Podcasts: podcasts, Episodes: episodes, Galleries: galleries, Events: events, Assets: assets,
		Clock: clock, IDs: uuidIDs{},
	}
	staffDeps := appidentity.StaffProfileDeps{Profiles: staffProfiles, Assets: assets, IDs: uuidIDs{}}
	revenueDeps := apprevenue.Deps{
		Plans: plans, Subscriptions: subscriptions, Donations: donations,
		AdCampaigns: adCampaigns, AdEvents: adEvents,
		Products: products, ProductOrders: productOrders, Classifieds: classifieds,
		AffiliateLinks: affiliateLinks, AdvertiserProposals: advertiserProposals,
		Payments: payments, Clock: clock, IDs: uuidIDs{},
	}

	handler := kurahttp.NewRouter(kurahttp.Deps{
		CreateDraft:                 appeditorial.NewCreateDraft(deps),
		UpdateDraft:                 appeditorial.NewUpdateDraft(deps),
		AttachArticleHero:           appeditorial.NewAttachArticleHero(deps),
		RequestArticleNarration:     appeditorial.NewRequestArticleNarration(deps, narrationJobs, narrationProvider),
		GetLatestNarration:          appeditorial.NewGetLatestArticleNarration(deps, narrationJobs),
		AttachArticleNarration:      appeditorial.NewAttachArticleNarration(deps, narrationJobs),
		ProcessNarrationJobs:        appeditorial.NewProcessNarrationJobs(deps, narrationJobs, narrationProvider),
		ReceiveRecording:            appmedia.NewReceiveRecording(mediaDeps, recordingImports, recordingProvider),
		ProcessRecordings:           appmedia.NewProcessRecordings(mediaDeps, recordingImports, recordingProvider),
		GetDraft:                    appeditorial.NewGetDraft(deps),
		ListAuthoredArticles:        appeditorial.NewListAuthoredArticles(deps),
		ListAwaitingReview:          appeditorial.NewListAwaitingReview(deps),
		ListRevisions:               appeditorial.NewListRevisions(deps),
		RestoreRevision:             appeditorial.NewRestoreRevision(deps),
		SubmitForReview:             appeditorial.NewSubmitForReview(deps),
		ApproveArticle:              appeditorial.NewApproveArticle(deps),
		RejectArticle:               appeditorial.NewRejectArticle(deps),
		SchedulePublication:         appeditorial.NewSchedulePublication(deps),
		PublishArticle:              appeditorial.NewPublishArticle(deps),
		UnpublishArticle:            appeditorial.NewUnpublishArticle(deps),
		PublishDueArticles:          appeditorial.NewPublishDueArticles(deps),
		GetPublishedArticle:         appeditorial.NewGetPublishedArticle(deps),
		ListPublishedArticles:       appeditorial.NewListPublishedArticles(deps),
		BrowseCategory:              appeditorial.NewBrowseCategory(deps),
		ListSections:                appeditorial.NewListSections(deps),
		ProcessSemanticIndex:        appeditorial.NewProcessSemanticIndex(semantic, embeddings, cfg.VoyageModel),
		QueueSemanticInventory:      appeditorial.NewQueueSemanticInventory(deps),
		SemanticSearch:              appeditorial.NewSemanticSearch(deps, embeddings, semantic),
		SemanticRelated:             appeditorial.NewSemanticRelated(deps, semantic),
		UpsertStaffProfile:          appidentity.NewUpsertStaffProfile(staffDeps),
		PublishStaffProfile:         appidentity.NewPublishStaffProfile(staffDeps),
		ListStaffProfiles:           appidentity.NewListStaffProfiles(staffDeps),
		GetStaffProfile:             appidentity.NewGetStaffProfile(staffDeps),
		BuildSEOReport:              appinsight.NewBuildSEOReport(appinsight.Deps{Articles: articles, Revisions: revisions, Profiles: staffProfiles, Clock: clock}, []string{"en", "fr"}),
		CreatePresenter:             appmedia.NewCreatePresenter(mediaDeps),
		PublishPresenter:            appmedia.NewPublishPresenter(mediaDeps),
		CreateProgramme:             appmedia.NewCreateProgramme(mediaDeps),
		PublishProgramme:            appmedia.NewPublishProgramme(mediaDeps),
		ScheduleProgramme:           appmedia.NewScheduleProgramme(mediaDeps),
		PublishReplay:               appmedia.NewPublishReplay(mediaDeps),
		ListReplayCandidates:        appmedia.NewListReplayCandidates(mediaDeps),
		ListTelevisionGuide:         appmedia.NewListTelevisionGuide(mediaDeps, videoDelivery),
		CreateAssetUpload:           appmedia.NewCreateAssetUpload(mediaDeps, assets, uploads),
		CompleteAssetUpload:         appmedia.NewCompleteAssetUpload(assets, uploads),
		ListAssets:                  appmedia.NewListAssets(assets),
		CreatePodcast:               appmedia.NewCreatePodcast(mediaDeps),
		PublishPodcast:              appmedia.NewPublishPodcast(mediaDeps),
		CreateEpisode:               appmedia.NewCreateEpisode(mediaDeps),
		PublishEpisode:              appmedia.NewPublishEpisode(mediaDeps),
		ListPodcastLibrary:          appmedia.NewListPodcastLibrary(mediaDeps),
		CreateGallery:               appmedia.NewCreateGallery(mediaDeps),
		PublishGallery:              appmedia.NewPublishGallery(mediaDeps),
		ListGalleryLibrary:          appmedia.NewListGalleryLibrary(mediaDeps, videoDelivery),
		CreateEvent:                 appmedia.NewCreateEvent(mediaDeps),
		PublishEvent:                appmedia.NewPublishEvent(mediaDeps),
		ListUpcomingEvents:          appmedia.NewListUpcomingEvents(mediaDeps),
		CreateMembershipPlan:        apprevenue.NewCreateMembershipPlan(revenueDeps),
		ActivateMembershipPlan:      apprevenue.NewActivateMembershipPlan(revenueDeps),
		ListMembershipPlans:         apprevenue.NewListMembershipPlans(revenueDeps),
		StartSubscription:           apprevenue.NewStartSubscription(revenueDeps),
		RecordDonation:              apprevenue.NewRecordDonation(revenueDeps),
		CheckEntitlement:            apprevenue.NewCheckEntitlement(revenueDeps),
		ConfirmSubscriptionPayment:  apprevenue.NewConfirmSubscriptionPayment(revenueDeps),
		ConfirmDonationPayment:      apprevenue.NewConfirmDonationPayment(revenueDeps),
		BuildRevenueReport:          apprevenue.NewBuildRevenueReport(revenueDeps),
		CreateAdCampaign:            apprevenue.NewCreateAdCampaign(revenueDeps),
		ActivateAdCampaign:          apprevenue.NewActivateAdCampaign(revenueDeps),
		ResolveAdPlacement:          apprevenue.NewResolveAdPlacement(revenueDeps),
		RecordAdEvent:               apprevenue.NewRecordAdEvent(revenueDeps),
		BuildAdReport:               apprevenue.NewBuildAdReport(revenueDeps),
		CreateProduct:               apprevenue.NewCreateProduct(revenueDeps),
		ActivateProduct:             apprevenue.NewActivateProduct(revenueDeps),
		ListProducts:                apprevenue.NewListProducts(revenueDeps),
		StartProductOrder:           apprevenue.NewStartProductOrder(revenueDeps),
		ConfirmProductOrder:         apprevenue.NewConfirmProductOrder(revenueDeps),
		SubmitClassified:            apprevenue.NewSubmitClassified(revenueDeps),
		ConfirmClassified:           apprevenue.NewConfirmClassified(revenueDeps),
		PublishClassified:           apprevenue.NewPublishClassified(revenueDeps),
		ListClassifieds:             apprevenue.NewListClassifieds(revenueDeps),
		CreateAffiliateLink:         apprevenue.NewCreateAffiliateLink(revenueDeps),
		ActivateAffiliateLink:       apprevenue.NewActivateAffiliateLink(revenueDeps),
		ListAffiliateLinks:          apprevenue.NewListAffiliateLinks(revenueDeps),
		FollowAffiliateLink:         apprevenue.NewFollowAffiliateLink(revenueDeps),
		SubmitAdvertiserProposal:    apprevenue.NewSubmitAdvertiserProposal(revenueDeps),
		ListOwnAdvertiserProposals:  apprevenue.NewListOwnAdvertiserProposals(revenueDeps),
		ListAdvertiserProposalQueue: apprevenue.NewListAdvertiserProposalQueue(revenueDeps),
		ApproveAdvertiserProposal:   apprevenue.NewApproveAdvertiserProposal(revenueDeps),
		RejectAdvertiserProposal:    apprevenue.NewRejectAdvertiserProposal(revenueDeps),
		PaymentWebhooks:             paymentWebhooks,
		Roles:                       roles,
		Clock:                       clock,
		Log:                         log,
		CronSecret:                  cfg.CronSecret,
		IVSWebhookSecret:            cfg.IVSWebhookSecret,
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
