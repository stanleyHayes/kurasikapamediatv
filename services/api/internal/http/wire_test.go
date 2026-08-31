package http_test

import (
	"io"
	"log/slog"
	"net/http"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	appmedia "github.com/kurasikapa/api/internal/app/media"
	"github.com/kurasikapa/api/internal/app/ports"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
	kurahttp "github.com/kurasikapa/api/internal/http"
)

func httpDeps(app appeditorial.Deps, granted map[shared.UserID][]identity.Role) kurahttp.Deps {
	mediaDeps := appmedia.Deps{
		Presenters: faketesting.NewPresenterStore(), Programmes: faketesting.NewProgrammeStore(),
		Schedule: faketesting.NewScheduleStore(), Clock: faketesting.FixedClock{At: now},
		IDs: &faketesting.SequentialIDs{},
	}
	assets := faketesting.NewAssetStore()
	uploads := &faketesting.MediaUploadFake{Ticket: ports.UploadTicket{
		URL: "https://api.cloudinary.test/upload", APIKey: "key", Signature: "signature",
		PublicID: "id_1", ResourceType: "video", Folder: "kurasikapa/media", Timestamp: now.Unix(),
	}}
	return kurahttp.Deps{
		CreateDraft:           appeditorial.NewCreateDraft(app),
		UpdateDraft:           appeditorial.NewUpdateDraft(app),
		GetDraft:              appeditorial.NewGetDraft(app),
		ListAuthoredArticles:  appeditorial.NewListAuthoredArticles(app),
		ListAwaitingReview:    appeditorial.NewListAwaitingReview(app),
		ListRevisions:         appeditorial.NewListRevisions(app),
		RestoreRevision:       appeditorial.NewRestoreRevision(app),
		SubmitForReview:       appeditorial.NewSubmitForReview(app),
		ApproveArticle:        appeditorial.NewApproveArticle(app),
		RejectArticle:         appeditorial.NewRejectArticle(app),
		SchedulePublication:   appeditorial.NewSchedulePublication(app),
		PublishArticle:        appeditorial.NewPublishArticle(app),
		UnpublishArticle:      appeditorial.NewUnpublishArticle(app),
		PublishDueArticles:    appeditorial.NewPublishDueArticles(app),
		GetPublishedArticle:   appeditorial.NewGetPublishedArticle(app),
		ListPublishedArticles: appeditorial.NewListPublishedArticles(app),
		BrowseCategory:        appeditorial.NewBrowseCategory(app),
		ListSections:          appeditorial.NewListSections(app),
		CreatePresenter:       appmedia.NewCreatePresenter(mediaDeps),
		PublishPresenter:      appmedia.NewPublishPresenter(mediaDeps),
		CreateProgramme:       appmedia.NewCreateProgramme(mediaDeps),
		PublishProgramme:      appmedia.NewPublishProgramme(mediaDeps),
		ScheduleProgramme:     appmedia.NewScheduleProgramme(mediaDeps),
		ListTelevisionGuide:   appmedia.NewListTelevisionGuide(mediaDeps),
		CreateAssetUpload:     appmedia.NewCreateAssetUpload(mediaDeps, assets, uploads),
		CompleteAssetUpload:   appmedia.NewCompleteAssetUpload(assets, uploads),
		ListAssets:            appmedia.NewListAssets(assets),
		Roles:                 roles{granted: granted},
		Log:                   slog.New(slog.NewTextHandler(io.Discard, nil)),
		CronSecret:            "s3cret-value-of-known-length-0000",
	}
}

func routed(app appeditorial.Deps, granted map[shared.UserID][]identity.Role) http.Handler {
	return kurahttp.NewRouter(httpDeps(app, granted))
}
