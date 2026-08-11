package http_test

import (
	"io"
	"log/slog"
	"net/http"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
	kurahttp "github.com/kurasikapa/api/internal/http"
)

func httpDeps(app appeditorial.Deps, granted map[shared.UserID][]identity.Role) kurahttp.Deps {
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
		Roles:                 roles{granted: granted},
		Log:                   slog.New(slog.NewTextHandler(io.Discard, nil)),
		CronSecret:            "s3cret-value-of-known-length-0000",
	}
}

func routed(app appeditorial.Deps, granted map[shared.UserID][]identity.Role) http.Handler {
	return kurahttp.NewRouter(httpDeps(app, granted))
}
