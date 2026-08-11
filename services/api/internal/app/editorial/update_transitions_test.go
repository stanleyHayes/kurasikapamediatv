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

func draftArticle(id string) editorial.Article {
	return editorial.Reconstitute(editorial.ArticleState{
		ID:       shared.ArticleID(id),
		Locale:   "en",
		Slug:     shared.SlugFrom("budget-2026"),
		Title:    "Budget 2026",
		AuthorID: shared.UserID("usr_author"),
		Status:   editorial.StatusDraft,
	})
}

func TestUpdateDraft(t *testing.T) {
	t.Parallel()

	t.Run("appends a revision and retitles", func(t *testing.T) {
		t.Parallel()

		h := newHarness(draftArticle("art_1"))
		_ = h.revisions.Append(context.Background(), editorial.NewRevision(
			"rev_1", "art_1", nil, "Budget 2026", "Old body.",
			shared.UserID("usr_author"), now,
		))

		got, err := app.NewUpdateDraft(h.deps).Execute(context.Background(), app.UpdateDraftInput{
			Actor: author(), ArticleID: "art_1",
			Title: "Budget 2026 Revised", Body: "New body.",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Seq != 2 {
			t.Errorf("seq = %d, want 2", got.Seq)
		}
		if got.Slug != "budget-2026-revised" {
			t.Errorf("slug = %q", got.Slug)
		}
		if len(h.events.Names()) != 0 {
			t.Errorf("draft save must not emit events, got %v", h.events.Names())
		}
	})

	t.Run("refuses a slug already taken by another article", func(t *testing.T) {
		t.Parallel()

		other := editorial.Reconstitute(editorial.ArticleState{
			ID: "art_2", Locale: "en", Slug: shared.SlugFrom("taken-slug"),
			Title: "Taken", AuthorID: "usr_other", Status: editorial.StatusDraft,
		})
		h := newHarness(draftArticle("art_1"), other)

		_, err := app.NewUpdateDraft(h.deps).Execute(context.Background(), app.UpdateDraftInput{
			Actor: author(), ArticleID: "art_1",
			Title: "Taken Slug", Body: "x",
		})
		if !errors.Is(err, app.ErrSlugTaken) {
			t.Errorf("got %v, want ErrSlugTaken", err)
		}
	})

	t.Run("missing article is not found", func(t *testing.T) {
		t.Parallel()

		h := newHarness()
		_, err := app.NewUpdateDraft(h.deps).Execute(context.Background(), app.UpdateDraftInput{
			Actor: author(), ArticleID: "missing", Title: "x", Body: "y",
		})
		if !errors.Is(err, ports.ErrNotFound) {
			t.Errorf("got %v, want ErrNotFound", err)
		}
	})
}

func TestSubmitForReview(t *testing.T) {
	t.Parallel()

	h := newHarness(draftArticle("art_1"))
	got, err := app.NewSubmitForReview(h.deps).Execute(context.Background(), app.SubmitInput{
		Actor: author(), ArticleID: "art_1",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Status != string(editorial.StatusInReview) {
		t.Errorf("status = %s", got.Status)
	}
	if names := h.events.Names(); len(names) != 1 || names[0] != "article.submitted" {
		t.Errorf("events = %v", names)
	}
}

func TestApproveArticle(t *testing.T) {
	t.Parallel()

	inReview := editorial.Reconstitute(editorial.ArticleState{
		ID: "art_1", Locale: "en", Slug: shared.SlugFrom("budget-2026"),
		Title: "Budget 2026", AuthorID: "usr_author", Status: editorial.StatusInReview,
	})
	h := newHarness(inReview)
	rev := editorial.NewRevision(
		"rev_1", "art_1", nil, "Budget 2026", "Body.",
		shared.UserID("usr_author"), now,
	)
	_ = h.revisions.Append(context.Background(), rev)

	got, err := app.NewApproveArticle(h.deps).Execute(context.Background(), app.ApproveInput{
		Actor: editor(), ArticleID: "art_1", RevisionID: "rev_1",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Status != string(editorial.StatusApproved) {
		t.Errorf("status = %s", got.Status)
	}
}

func TestRejectArticle(t *testing.T) {
	t.Parallel()

	inReview := editorial.Reconstitute(editorial.ArticleState{
		ID: "art_1", Locale: "en", Slug: shared.SlugFrom("budget-2026"),
		Title: "Budget 2026", AuthorID: "usr_author", Status: editorial.StatusInReview,
	})
	h := newHarness(inReview)

	got, err := app.NewRejectArticle(h.deps).Execute(context.Background(), app.RejectInput{
		Actor: editor(), ArticleID: "art_1", Note: "Needs sources",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Status != string(editorial.StatusDraft) {
		t.Errorf("status = %s", got.Status)
	}
	if h.events.Names()[0] != "article.rejected" {
		t.Errorf("events = %v", h.events.Names())
	}
}

func TestScheduleAndUnpublish(t *testing.T) {
	t.Parallel()

	revID := shared.RevisionID("rev_1")
	approvedArt := editorial.Reconstitute(editorial.ArticleState{
		ID: "art_1", Locale: "en", Slug: shared.SlugFrom("budget-2026"),
		Title: "Budget 2026", AuthorID: "usr_author",
		Status: editorial.StatusApproved, ApprovedRevisionID: &revID,
	})

	t.Run("schedule", func(t *testing.T) {
		t.Parallel()
		h := newHarness(approvedArt)
		later := now.Add(time.Hour)
		got, err := app.NewSchedulePublication(h.deps).Execute(context.Background(), app.ScheduleInput{
			Actor: editor(), ArticleID: "art_1", At: later,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Status != string(editorial.StatusScheduled) {
			t.Errorf("status = %s", got.Status)
		}
	})

	t.Run("unpublish", func(t *testing.T) {
		t.Parallel()
		publishedAt := now
		live := editorial.Reconstitute(editorial.ArticleState{
			ID: "art_1", Locale: "en", Slug: shared.SlugFrom("budget-2026"),
			Title: "Budget 2026", AuthorID: "usr_author",
			Status: editorial.StatusPublished, ApprovedRevisionID: &revID,
			PublishedAt: &publishedAt,
		})
		h := newHarness(live)
		admin := identity.NewActor("usr_admin", []identity.Role{identity.RoleAdministrator})

		got, err := app.NewUnpublishArticle(h.deps).Execute(context.Background(), app.UnpublishInput{
			Actor: admin, ArticleID: "art_1", Reason: "Correction needed",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Status != string(editorial.StatusUnpublished) {
			t.Errorf("status = %s", got.Status)
		}
		if h.events.Names()[0] != "article.unpublished" {
			t.Errorf("events = %v", h.events.Names())
		}
	})
}
