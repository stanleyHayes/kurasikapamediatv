package editorial_test

import (
	"context"
	"errors"
	"testing"

	app "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
)

func businessCategory() editorial.Category {
	return editorial.ReconstituteCategory(editorial.CategoryState{
		ID:    "cat_business",
		Slugs: map[string]string{"en": "business", "fr": "economie"},
		Names: map[string]string{"en": "Business", "fr": "Économie"},
		Order: 1,
	})
}

func TestBrowseCategory(t *testing.T) {
	t.Parallel()

	t.Run("returns the section and its published articles", func(t *testing.T) {
		t.Parallel()
		h := newHarness(
			publishedArt("art_1", "budget-2026", "cat_business"),
			draftArticle("art_2"),
			publishedArt("art_3", "match-report", "cat_sports"),
		)
		_ = h.categories.Save(context.Background(), businessCategory())

		got, err := app.NewBrowseCategory(h.deps).Execute(context.Background(), app.BrowseInput{
			Slug: "business", Locale: "en",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Category.ID != "cat_business" || len(got.Articles.Items) != 1 {
			t.Errorf("got %+v", got)
		}
		if got.Articles.Items[0].Article.ID != "art_1" {
			t.Errorf("item = %+v", got.Articles.Items[0])
		}
	})

	t.Run("resolves the localised slug", func(t *testing.T) {
		t.Parallel()
		h := newHarness()
		_ = h.categories.Save(context.Background(), businessCategory())
		got, err := app.NewBrowseCategory(h.deps).Execute(context.Background(), app.BrowseInput{
			Slug: "economie", Locale: "fr",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Category.ID != "cat_business" {
			t.Errorf("id = %s", got.Category.ID)
		}
	})

	t.Run("unknown section", func(t *testing.T) {
		t.Parallel()
		h := newHarness()
		_, err := app.NewBrowseCategory(h.deps).Execute(context.Background(), app.BrowseInput{
			Slug: "astrology", Locale: "en",
		})
		if !errors.Is(err, ports.ErrNotFound) {
			t.Errorf("got %v, want ErrNotFound", err)
		}
	})

	t.Run("excerpt from the approved revision", func(t *testing.T) {
		t.Parallel()
		h := newHarness(publishedArt("art_1", "budget-2026", "cat_business"))
		_ = h.categories.Save(context.Background(), businessCategory())
		approved := editorial.NewRevision(
			"rev_art_1", "art_1", nil, "Approved",
			"The approved standfirst that readers should see.",
			"usr_author", now,
		)
		_ = h.revisions.Append(context.Background(), approved)
		_ = h.revisions.Append(context.Background(), editorial.NewRevision(
			"rev_draft", "art_1", &approved, "Draft",
			"An unapproved correction nobody may read yet.",
			"usr_author", now,
		))

		got, err := app.NewBrowseCategory(h.deps).Execute(context.Background(), app.BrowseInput{
			Slug: "business", Locale: "en",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		ex := got.Articles.Items[0].Excerpt
		if ex == nil || *ex != "The approved standfirst that readers should see." {
			t.Errorf("excerpt = %v", ex)
		}
	})
}

func TestListSections(t *testing.T) {
	t.Parallel()

	culture := editorial.ReconstituteCategory(editorial.CategoryState{
		ID: "cat_culture", Slugs: map[string]string{"en": "culture"},
		Names: map[string]string{"en": "Culture"}, Order: 3,
	})
	politics := editorial.ReconstituteCategory(editorial.CategoryState{
		ID: "cat_politics", Slugs: map[string]string{"fr": "politique"},
		Names: map[string]string{"fr": "Politique"}, Order: 2,
	})

	h := newHarness()
	_ = h.categories.Save(context.Background(), businessCategory())
	_ = h.categories.Save(context.Background(), culture)
	_ = h.categories.Save(context.Background(), politics)

	en, err := app.NewListSections(h.deps).Execute(context.Background(), "en")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(en) != 2 || en[0].ID != "cat_business" || en[1].ID != "cat_culture" {
		t.Errorf("en = %+v", en)
	}

	fr, err := app.NewListSections(h.deps).Execute(context.Background(), "fr")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(fr) != 2 || fr[0].ID != "cat_business" || fr[1].ID != "cat_politics" {
		t.Errorf("fr = %+v", fr)
	}

	tw, err := app.NewListSections(h.deps).Execute(context.Background(), "tw")
	if err != nil || len(tw) != 0 {
		t.Errorf("tw = %+v err = %v", tw, err)
	}
}

func TestEnglishSlugUnderFrenchURL(t *testing.T) {
	t.Parallel()

	h := newHarness()
	_ = h.categories.Save(context.Background(), businessCategory())
	_, err := app.NewBrowseCategory(h.deps).Execute(context.Background(), app.BrowseInput{
		Slug: "business", Locale: "fr",
	})
	if !errors.Is(err, ports.ErrNotFound) {
		t.Errorf("got %v, want ErrNotFound", err)
	}
}
