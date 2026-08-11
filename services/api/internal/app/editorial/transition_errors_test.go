package editorial_test

import (
	"context"
	"errors"
	"testing"
	"time"

	app "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestTransitionErrorPaths(t *testing.T) {
	t.Parallel()

	t.Run("submit missing article", func(t *testing.T) {
		t.Parallel()
		h := newHarness()
		_, err := app.NewSubmitForReview(h.deps).Execute(context.Background(), app.SubmitInput{
			Actor: author(), ArticleID: "missing",
		})
		if !errors.Is(err, ports.ErrNotFound) {
			t.Errorf("got %v, want ErrNotFound", err)
		}
	})

	t.Run("submit illegal state", func(t *testing.T) {
		t.Parallel()
		inReview := editorial.Reconstitute(editorial.ArticleState{
			ID: "art_1", Locale: "en", Slug: shared.SlugFrom("x"),
			Title: "X", AuthorID: "usr_author", Status: editorial.StatusInReview,
		})
		h := newHarness(inReview)
		_, err := app.NewSubmitForReview(h.deps).Execute(context.Background(), app.SubmitInput{
			Actor: author(), ArticleID: "art_1",
		})
		if !errors.Is(err, editorial.ErrIllegalTransition) {
			t.Errorf("got %v, want ErrIllegalTransition", err)
		}
	})

	t.Run("approve missing revision", func(t *testing.T) {
		t.Parallel()
		inReview := editorial.Reconstitute(editorial.ArticleState{
			ID: "art_1", Locale: "en", Slug: shared.SlugFrom("x"),
			Title: "X", AuthorID: "usr_author", Status: editorial.StatusInReview,
		})
		h := newHarness(inReview)
		_, err := app.NewApproveArticle(h.deps).Execute(context.Background(), app.ApproveInput{
			Actor: editor(), ArticleID: "art_1", RevisionID: "rev_missing",
		})
		if !errors.Is(err, ports.ErrNotFound) {
			t.Errorf("got %v, want ErrNotFound", err)
		}
	})

	t.Run("approve wrong article revision", func(t *testing.T) {
		t.Parallel()
		inReview := editorial.Reconstitute(editorial.ArticleState{
			ID: "art_1", Locale: "en", Slug: shared.SlugFrom("x"),
			Title: "X", AuthorID: "usr_author", Status: editorial.StatusInReview,
		})
		h := newHarness(inReview)
		_ = h.revisions.Append(context.Background(), editorial.NewRevision(
			"rev_other", "art_other", nil, "Other", "Body.",
			shared.UserID("usr_author"), now,
		))
		_, err := app.NewApproveArticle(h.deps).Execute(context.Background(), app.ApproveInput{
			Actor: editor(), ArticleID: "art_1", RevisionID: "rev_other",
		})
		if !errors.Is(err, editorial.ErrRevisionNotOfArticle) {
			t.Errorf("got %v, want ErrRevisionNotOfArticle", err)
		}
	})

	t.Run("reject save failure", func(t *testing.T) {
		t.Parallel()
		inReview := editorial.Reconstitute(editorial.ArticleState{
			ID: "art_1", Locale: "en", Slug: shared.SlugFrom("x"),
			Title: "X", AuthorID: "usr_author", Status: editorial.StatusInReview,
		})
		h := newHarness(inReview)
		boom := errors.New("disk full")
		h.articles.FailSave = boom
		_, err := app.NewRejectArticle(h.deps).Execute(context.Background(), app.RejectInput{
			Actor: editor(), ArticleID: "art_1", Note: "no",
		})
		if !errors.Is(err, boom) {
			t.Errorf("got %v, want disk full", err)
		}
	})

	t.Run("schedule in the past", func(t *testing.T) {
		t.Parallel()
		revID := shared.RevisionID("rev_1")
		approvedArt := editorial.Reconstitute(editorial.ArticleState{
			ID: "art_1", Locale: "en", Slug: shared.SlugFrom("x"),
			Title: "X", AuthorID: "usr_author",
			Status: editorial.StatusApproved, ApprovedRevisionID: &revID,
		})
		h := newHarness(approvedArt)
		_, err := app.NewSchedulePublication(h.deps).Execute(context.Background(), app.ScheduleInput{
			Actor: editor(), ArticleID: "art_1", At: now.Add(-time.Minute),
		})
		if !errors.Is(err, editorial.ErrScheduleInPast) {
			t.Errorf("got %v, want ErrScheduleInPast", err)
		}
	})

	t.Run("unpublish not permitted", func(t *testing.T) {
		t.Parallel()
		revID := shared.RevisionID("rev_1")
		publishedAt := now
		live := editorial.Reconstitute(editorial.ArticleState{
			ID: "art_1", Locale: "en", Slug: shared.SlugFrom("x"),
			Title: "X", AuthorID: "usr_author",
			Status: editorial.StatusPublished, ApprovedRevisionID: &revID,
			PublishedAt: &publishedAt,
		})
		h := newHarness(live)
		_, err := app.NewUnpublishArticle(h.deps).Execute(context.Background(), app.UnpublishInput{
			Actor: author(), ArticleID: "art_1", Reason: "x",
		})
		if !errors.Is(err, identity.ErrNotPermitted) {
			t.Errorf("got %v, want ErrNotPermitted", err)
		}
	})

	t.Run("update draft not editable", func(t *testing.T) {
		t.Parallel()
		inReview := editorial.Reconstitute(editorial.ArticleState{
			ID: "art_1", Locale: "en", Slug: shared.SlugFrom("x"),
			Title: "X", AuthorID: "usr_author", Status: editorial.StatusInReview,
		})
		h := newHarness(inReview)
		_, err := app.NewUpdateDraft(h.deps).Execute(context.Background(), app.UpdateDraftInput{
			Actor: author(), ArticleID: "art_1", Title: "Y", Body: "z",
		})
		if !errors.Is(err, editorial.ErrNotEditable) {
			t.Errorf("got %v, want ErrNotEditable", err)
		}
	})

	t.Run("submit save failure", func(t *testing.T) {
		t.Parallel()
		h := newHarness(draftArticle("art_1"))
		boom := errors.New("disk full")
		h.articles.FailSave = boom
		_, err := app.NewSubmitForReview(h.deps).Execute(context.Background(), app.SubmitInput{
			Actor: author(), ArticleID: "art_1",
		})
		if !errors.Is(err, boom) {
			t.Errorf("got %v, want disk full", err)
		}
	})

	t.Run("schedule save failure", func(t *testing.T) {
		t.Parallel()
		revID := shared.RevisionID("rev_1")
		approvedArt := editorial.Reconstitute(editorial.ArticleState{
			ID: "art_1", Locale: "en", Slug: shared.SlugFrom("x"),
			Title: "X", AuthorID: "usr_author",
			Status: editorial.StatusApproved, ApprovedRevisionID: &revID,
		})
		h := newHarness(approvedArt)
		boom := errors.New("disk full")
		h.articles.FailSave = boom
		_, err := app.NewSchedulePublication(h.deps).Execute(context.Background(), app.ScheduleInput{
			Actor: editor(), ArticleID: "art_1", At: now.Add(time.Hour),
		})
		if !errors.Is(err, boom) {
			t.Errorf("got %v, want disk full", err)
		}
	})

	t.Run("unpublish save failure", func(t *testing.T) {
		t.Parallel()
		revID := shared.RevisionID("rev_1")
		publishedAt := now
		live := editorial.Reconstitute(editorial.ArticleState{
			ID: "art_1", Locale: "en", Slug: shared.SlugFrom("x"),
			Title: "X", AuthorID: "usr_author",
			Status: editorial.StatusPublished, ApprovedRevisionID: &revID,
			PublishedAt: &publishedAt,
		})
		h := newHarness(live)
		admin := identity.NewActor("usr_admin", []identity.Role{identity.RoleAdministrator})
		boom := errors.New("disk full")
		h.articles.FailSave = boom
		_, err := app.NewUnpublishArticle(h.deps).Execute(context.Background(), app.UnpublishInput{
			Actor: admin, ArticleID: "art_1", Reason: "x",
		})
		if !errors.Is(err, boom) {
			t.Errorf("got %v, want disk full", err)
		}
	})

	t.Run("approve save failure", func(t *testing.T) {
		t.Parallel()
		inReview := editorial.Reconstitute(editorial.ArticleState{
			ID: "art_1", Locale: "en", Slug: shared.SlugFrom("x"),
			Title: "X", AuthorID: "usr_author", Status: editorial.StatusInReview,
		})
		h := newHarness(inReview)
		_ = h.revisions.Append(context.Background(), editorial.NewRevision(
			"rev_1", "art_1", nil, "X", "Body.", shared.UserID("usr_author"), now,
		))
		boom := errors.New("disk full")
		h.articles.FailSave = boom
		_, err := app.NewApproveArticle(h.deps).Execute(context.Background(), app.ApproveInput{
			Actor: editor(), ArticleID: "art_1", RevisionID: "rev_1",
		})
		if !errors.Is(err, boom) {
			t.Errorf("got %v, want disk full", err)
		}
	})
}
