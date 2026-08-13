package editorial_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	app "github.com/kurasikapa/api/internal/app/editorial"
)

func TestUpdateDraftSlugGuard(t *testing.T) {
	t.Parallel()

	t.Run("keeping the same title is not a clash", func(t *testing.T) {
		t.Parallel()

		// FindBySlug returns the article itself here, and refusing that no-op
		// would make every autosave that leaves the title alone fail.
		h := newHarness(draftArticle("art_1"))

		got, err := app.NewUpdateDraft(h.deps).Execute(context.Background(), app.UpdateDraftInput{
			Actor: author(), ArticleID: "art_1",
			Title: "Budget 2026", Body: "Same title, new text.",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Slug != "budget-2026" {
			t.Errorf("slug = %q", got.Slug)
		}
	})

	t.Run("a failed slug check surfaces instead of passing", func(t *testing.T) {
		t.Parallel()

		// A store error is not "slug free". Treating it as such would let a
		// rename through while the clash check was blind.
		h := newHarness(draftArticle("art_1"))
		h.articles.FailFindBySlug = errors.New("store down")

		_, err := app.NewUpdateDraft(h.deps).Execute(context.Background(), app.UpdateDraftInput{
			Actor: author(), ArticleID: "art_1",
			Title: "A Brand New Title", Body: "x",
		})
		if err == nil || !strings.Contains(err.Error(), "checking slug") {
			t.Errorf("got %v, want a wrapped slug-check failure", err)
		}
	})
}
