package http_test

import (
	"context"
	"io"
	"log/slog"
	"net/http"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	appidentity "github.com/kurasikapa/api/internal/app/identity"
	appinsight "github.com/kurasikapa/api/internal/app/insight"
	appmedia "github.com/kurasikapa/api/internal/app/media"
	"github.com/kurasikapa/api/internal/app/ports"
	apprevenue "github.com/kurasikapa/api/internal/app/revenue"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
	kurahttp "github.com/kurasikapa/api/internal/http"
)

func httpDeps(app appeditorial.Deps, granted map[shared.UserID][]identity.Role) kurahttp.Deps {
	mediaDeps := appmedia.Deps{
		Presenters: faketesting.NewPresenterStore(), Programmes: faketesting.NewProgrammeStore(),
		Schedule: faketesting.NewScheduleStore(), Clock: faketesting.FixedClock{At: now},
		Podcasts: faketesting.NewPodcastStore(), Episodes: faketesting.NewEpisodeStore(),
		Galleries: faketesting.NewGalleryStore(),
		Events:    faketesting.NewEventStore(),
		IDs:       &faketesting.SequentialIDs{},
	}
	assets := faketesting.NewAssetStore()
	portrait := domainmedia.ReconstituteAsset(domainmedia.AssetState{ID: "portrait", Kind: domainmedia.AssetImage, Status: domainmedia.AssetReady, SecureURL: "https://cdn.test/portrait.jpg", AltText: "Newsroom journalist", Width: 800, Height: 1000})
	_ = assets.Save(context.Background(), portrait)
	app.Assets = assets
	mediaDeps.Assets = assets
	uploads := &faketesting.MediaUploadFake{Ticket: ports.UploadTicket{
		URL: "https://api.cloudinary.test/upload", APIKey: "key", Signature: "signature",
		PublicID: "id_1", ResourceType: "video", Folder: "kurasikapa/media", Timestamp: now.Unix(),
	}}
	revenueDeps := apprevenue.Deps{
		Plans: faketesting.NewMembershipPlanStore(), Subscriptions: faketesting.NewSubscriptionStore(),
		Donations: faketesting.NewDonationStore(), Payments: faketesting.PaymentGatewayFake{Session: ports.CheckoutSession{
			Provider: "paystack", ProviderRef: "checkout_1", CheckoutURL: "https://pay.example/checkout",
		}}, Clock: faketesting.FixedClock{At: now}, IDs: &faketesting.SequentialIDs{},
	}
	revenueDeps.AdCampaigns = faketesting.NewAdCampaignStore()
	revenueDeps.AdEvents = &faketesting.AdEventStore{}
	revenueDeps.Products = faketesting.NewProductStore()
	revenueDeps.ProductOrders = faketesting.NewProductOrderStore()
	revenueDeps.Classifieds = faketesting.NewClassifiedStore()
	revenueDeps.AffiliateLinks = faketesting.NewAffiliateLinkStore()
	revenueDeps.AdvertiserProposals = faketesting.NewAdvertiserProposalStore(revenueDeps.AdCampaigns.(*faketesting.AdCampaignStore))
	profiles := faketesting.NewStaffProfileStore()
	staffDeps := appidentity.StaffProfileDeps{Profiles: profiles, Assets: assets, IDs: &faketesting.SequentialIDs{}}
	recordingImports := faketesting.NewRecordingImportStore()
	recordingProvider := &faketesting.RecordingPromotionFake{StartResult: ports.RecordingTranscode{TaskID: "transcode_1", OutputRef: "processed/recording.mp4"}, CheckResult: ports.RecordingProviderResult{Status: ports.RecordingProviderProcessing}}
	return kurahttp.Deps{
		CreateDraft:                 appeditorial.NewCreateDraft(app),
		UpdateDraft:                 appeditorial.NewUpdateDraft(app),
		AttachArticleHero:           appeditorial.NewAttachArticleHero(app),
		GetDraft:                    appeditorial.NewGetDraft(app),
		ListAuthoredArticles:        appeditorial.NewListAuthoredArticles(app),
		ListAwaitingReview:          appeditorial.NewListAwaitingReview(app),
		ListRevisions:               appeditorial.NewListRevisions(app),
		RestoreRevision:             appeditorial.NewRestoreRevision(app),
		SubmitForReview:             appeditorial.NewSubmitForReview(app),
		ApproveArticle:              appeditorial.NewApproveArticle(app),
		RejectArticle:               appeditorial.NewRejectArticle(app),
		SchedulePublication:         appeditorial.NewSchedulePublication(app),
		PublishArticle:              appeditorial.NewPublishArticle(app),
		UnpublishArticle:            appeditorial.NewUnpublishArticle(app),
		PublishDueArticles:          appeditorial.NewPublishDueArticles(app),
		GetPublishedArticle:         appeditorial.NewGetPublishedArticle(app),
		ListPublishedArticles:       appeditorial.NewListPublishedArticles(app),
		BrowseCategory:              appeditorial.NewBrowseCategory(app),
		ListSections:                appeditorial.NewListSections(app),
		UpsertStaffProfile:          appidentity.NewUpsertStaffProfile(staffDeps),
		PublishStaffProfile:         appidentity.NewPublishStaffProfile(staffDeps),
		ListStaffProfiles:           appidentity.NewListStaffProfiles(staffDeps),
		GetStaffProfile:             appidentity.NewGetStaffProfile(staffDeps),
		BuildSEOReport:              appinsight.NewBuildSEOReport(appinsight.Deps{Articles: app.Articles, Revisions: app.Revisions, Profiles: profiles, Clock: app.Clock}, []string{"en", "fr"}),
		CreatePresenter:             appmedia.NewCreatePresenter(mediaDeps),
		PublishPresenter:            appmedia.NewPublishPresenter(mediaDeps),
		CreateProgramme:             appmedia.NewCreateProgramme(mediaDeps),
		PublishProgramme:            appmedia.NewPublishProgramme(mediaDeps),
		ScheduleProgramme:           appmedia.NewScheduleProgramme(mediaDeps),
		PublishReplay:               appmedia.NewPublishReplay(mediaDeps),
		ListReplayCandidates:        appmedia.NewListReplayCandidates(mediaDeps),
		ListTelevisionGuide:         appmedia.NewListTelevisionGuide(mediaDeps, faketesting.VideoDeliveryFake{Delivery: ports.VideoDelivery{PlaybackURL: "https://cdn.test/report.m3u8", PosterURL: "https://cdn.test/poster.jpg", MIMEType: "application/vnd.apple.mpegurl"}}),
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
		ListGalleryLibrary:          appmedia.NewListGalleryLibrary(mediaDeps, faketesting.VideoDeliveryFake{Delivery: ports.VideoDelivery{PlaybackURL: "https://cdn.test/report.m3u8", PosterURL: "https://cdn.test/poster.jpg", MIMEType: "application/vnd.apple.mpegurl"}}),
		CreateEvent:                 appmedia.NewCreateEvent(mediaDeps),
		PublishEvent:                appmedia.NewPublishEvent(mediaDeps),
		ListUpcomingEvents:          appmedia.NewListUpcomingEvents(mediaDeps),
		ReceiveRecording:            appmedia.NewReceiveRecording(mediaDeps, recordingImports, recordingProvider),
		ProcessRecordings:           appmedia.NewProcessRecordings(mediaDeps, recordingImports, recordingProvider),
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
		PaymentWebhooks:             faketesting.PaymentWebhookFake{},
		Roles:                       roles{granted: granted},
		Clock:                       faketesting.FixedClock{At: now},
		Log:                         slog.New(slog.NewTextHandler(io.Discard, nil)),
		CronSecret:                  "s3cret-value-of-known-length-0000",
		IVSWebhookSecret:            "ivs-secret-value-of-known-length",
	}
}

func routed(app appeditorial.Deps, granted map[shared.UserID][]identity.Role) http.Handler {
	return kurahttp.NewRouter(httpDeps(app, granted))
}
