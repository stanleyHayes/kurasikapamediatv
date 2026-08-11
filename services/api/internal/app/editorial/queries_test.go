package editorial_test

import (
	"context"
	"errors"
	"testing"

	app "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestExcerptFrom(t *testing.T) {
	t.Parallel()

	if got := app.ExcerptFrom("A short standfirst.", 100); got != "A short standfirst." {
		t.Errorf("short = %q", got)
	}
	if got := app.ExcerptFrom("First para.\n\n  Second   para.", 100); got != "First para. Second para." {
		t.Errorf("whitespace = %q", got)
	}
	if got := app.ExcerptFrom("The quick brown fox jumps", 12); got != "The quick…" {
		t.Errorf("word cut = %q", got)
	}
}

func TestGetDraft(t *testing.T) {
	t.Parallel()

	t.Run("returns the newest text", func(t *testing.T) {
		t.Parallel()
		h := newHarness(draftArticle("art_1"))
		_ = h.revisions.Append(context.Background(), editorial.NewRevision(
			"rev_1", "art_1", nil, "Budget 2026", "first",
			shared.UserID("usr_author"), now,
		))
		first, _ := h.revisions.FindLatest(context.Background(), "art_1")
		_ = h.revisions.Append(context.Background(), editorial.NewRevision(
			"rev_2", "art_1", &first, "Budget 2026", "second",
			shared.UserID("usr_author"), now,
		))

		got, err := app.NewGetDraft(h.deps).Execute(context.Background(), app.GetDraftInput{
			Actor: author(), ArticleID: "art_1",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Latest == nil || got.Latest.Body != "second" {
			t.Errorf("latest = %+v", got.Latest)
		}
	})

	t.Run("null revision when none exist", func(t *testing.T) {
		t.Parallel()
		h := newHarness(draftArticle("art_1"))
		got, err := app.NewGetDraft(h.deps).Execute(context.Background(), app.GetDraftInput{
			Actor: author(), ArticleID: "art_1",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Latest != nil {
			t.Errorf("latest = %+v, want nil", got.Latest)
		}
	})

	t.Run("missing article", func(t *testing.T) {
		t.Parallel()
		h := newHarness()
		_, err := app.NewGetDraft(h.deps).Execute(context.Background(), app.GetDraftInput{
			Actor: author(), ArticleID: "missing",
		})
		if !errors.Is(err, ports.ErrNotFound) {
			t.Errorf("got %v, want ErrNotFound", err)
		}
	})

	t.Run("refuses a subscriber", func(t *testing.T) {
		t.Parallel()
		h := newHarness(draftArticle("art_1"))
		_, err := app.NewGetDraft(h.deps).Execute(context.Background(), app.GetDraftInput{
			Actor: reader(), ArticleID: "art_1",
		})
		if !errors.Is(err, identity.ErrNotPermitted) {
			t.Errorf("got %v, want ErrNotPermitted", err)
		}
	})

	t.Run("refuses another author", func(t *testing.T) {
		t.Parallel()
		h := newHarness(draftArticle("art_1"))
		other := identity.NewActor("usr_other", []identity.Role{identity.RoleAuthor})
		_, err := app.NewGetDraft(h.deps).Execute(context.Background(), app.GetDraftInput{
			Actor: other, ArticleID: "art_1",
		})
		if !errors.Is(err, editorial.ErrNotOwnArticle) {
			t.Errorf("got %v, want ErrNotOwnArticle", err)
		}
	})
}

func TestListAuthoredAndReview(t *testing.T) {
	t.Parallel()

	t.Run("authored is scoped to the actor", func(t *testing.T) {
		t.Parallel()
		mine := draftArticle("art_1")
		theirs := editorial.Reconstitute(editorial.ArticleState{
			ID: "art_2", Locale: "en", Slug: shared.SlugFrom("other"),
			Title: "Other", AuthorID: "usr_other", Status: editorial.StatusDraft,
		})
		h := newHarness(mine, theirs)
		_ = h.revisions.Append(context.Background(), editorial.NewRevision(
			"rev_1", "art_1", nil, "Budget 2026", "Opening paragraph for the card.",
			shared.UserID("usr_author"), now,
		))

		got, err := app.NewListAuthoredArticles(h.deps).Execute(context.Background(), app.ListInput{
			Actor: author(),
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(got.Items) != 1 || got.Items[0].ID != "art_1" {
			t.Errorf("items = %+v", got.Items)
		}
		if got.Items[0].Excerpt == nil {
			t.Error("expected an excerpt from the latest revision")
		}
	})

	t.Run("review queue requires approve", func(t *testing.T) {
		t.Parallel()
		inReview := editorial.Reconstitute(editorial.ArticleState{
			ID: "art_1", Locale: "en", Slug: shared.SlugFrom("budget-2026"),
			Title: "Budget 2026", AuthorID: "usr_author", Status: editorial.StatusInReview,
		})
		h := newHarness(inReview)

		_, err := app.NewListAwaitingReview(h.deps).Execute(context.Background(), app.ListInput{
			Actor: author(),
		})
		if !errors.Is(err, identity.ErrNotPermitted) {
			t.Errorf("got %v, want ErrNotPermitted", err)
		}

		got, err := app.NewListAwaitingReview(h.deps).Execute(context.Background(), app.ListInput{
			Actor: editor(),
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(got.Items) != 1 {
			t.Errorf("items = %d, want 1", len(got.Items))
		}
	})
}
