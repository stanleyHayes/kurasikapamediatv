package editorial_test

import (
	"context"
	"errors"
	"testing"

	app "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func publishedArt(id, slug string, category shared.CategoryID) editorial.Article {
	revID := shared.RevisionID("rev_" + id)
	at := now

	return editorial.Reconstitute(editorial.ArticleState{
		ID: shared.ArticleID(id), Locale: "en", Slug: shared.SlugFrom(slug),
		Title: "Budget 2026", AuthorID: "usr_author", CategoryID: category,
		Status: editorial.StatusPublished, ApprovedRevisionID: &revID, PublishedAt: &at,
	})
}

func TestGetPublishedArticle(t *testing.T) {
	t.Parallel()

	t.Run("returns a published article", func(t *testing.T) {
		t.Parallel()
		h := newHarness(publishedArt("art_1", "budget-2026", "cat_business"))
		got, err := app.NewGetPublishedArticle(h.deps).Execute(context.Background(), app.GetPublishedInput{
			Slug: "budget-2026", Locale: "en",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Article.ID != "art_1" {
			t.Errorf("id = %s", got.Article.ID)
		}
	})

	t.Run("missing slug", func(t *testing.T) {
		t.Parallel()
		h := newHarness()
		_, err := app.NewGetPublishedArticle(h.deps).Execute(context.Background(), app.GetPublishedInput{
			Slug: "nope", Locale: "en",
		})
		if !errors.Is(err, ports.ErrNotFound) {
			t.Errorf("got %v, want ErrNotFound", err)
		}
	})

	t.Run("does not cross locales", func(t *testing.T) {
		t.Parallel()
		h := newHarness(publishedArt("art_1", "budget-2026", "cat_business"))
		_, err := app.NewGetPublishedArticle(h.deps).Execute(context.Background(), app.GetPublishedInput{
			Slug: "budget-2026", Locale: "fr",
		})
		if !errors.Is(err, ports.ErrNotFound) {
			t.Errorf("got %v, want ErrNotFound", err)
		}
	})

	t.Run("hides a draft", func(t *testing.T) {
		t.Parallel()
		h := newHarness(draftArticle("art_1"))
		_, err := app.NewGetPublishedArticle(h.deps).Execute(context.Background(), app.GetPublishedInput{
			Slug: "budget-2026", Locale: "en",
		})
		if !errors.Is(err, ports.ErrNotFound) {
			t.Errorf("got %v, want ErrNotFound", err)
		}
	})

	t.Run("body is the approved revision", func(t *testing.T) {
		t.Parallel()
		h := newHarness(publishedArt("art_1", "budget-2026", "cat_business"))
		approved := editorial.NewRevision(
			"rev_art_1", "art_1", nil, "Budget 2026", "Approved text.",
			"usr_author", now,
		)
		_ = h.revisions.Append(context.Background(), approved)
		later := editorial.NewRevision(
			"rev_draft", "art_1", &approved, "Budget 2026", "Unapproved correction.",
			"usr_author", now,
		)
		_ = h.revisions.Append(context.Background(), later)

		got, err := app.NewGetPublishedArticle(h.deps).Execute(context.Background(), app.GetPublishedInput{
			Slug: "budget-2026", Locale: "en",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Body == nil || *got.Body != "Approved text." {
			t.Errorf("body = %v", got.Body)
		}
	})
}

func TestListPublishedArticles(t *testing.T) {
	t.Parallel()

	t.Run("returns published only", func(t *testing.T) {
		t.Parallel()
		h := newHarness(
			publishedArt("art_1", "budget-2026", "cat_business"),
			draftArticle("art_2"),
		)
		got, err := app.NewListPublishedArticles(h.deps).Execute(context.Background(), app.PublicListInput{
			Locale: "en",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(got.Items) != 1 || got.Items[0].ID != "art_1" {
			t.Errorf("items = %+v", got.Items)
		}
	})

	t.Run("filters by category", func(t *testing.T) {
		t.Parallel()
		h := newHarness(publishedArt("art_1", "budget-2026", "cat_business"))
		got, err := app.NewListPublishedArticles(h.deps).Execute(context.Background(), app.PublicListInput{
			Locale: "en", CategoryID: "cat_sports",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(got.Items) != 0 {
			t.Errorf("items = %+v", got.Items)
		}
	})

	t.Run("clamps limit and passes the cursor", func(t *testing.T) {
		t.Parallel()
		h := newHarness()
		_, err := app.NewListPublishedArticles(h.deps).Execute(context.Background(), app.PublicListInput{
			Locale: "en", After: "art_9", Limit: 100_000,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		q := h.articles.LastPublished
		if q.Cursor.After != "art_9" || q.Cursor.Limit != 50 {
			t.Errorf("query = %+v", q)
		}
	})
}
