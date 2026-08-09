package editorial_test

import (
	"errors"
	"testing"

	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func politics(mutate ...func(*editorial.CategoryState)) editorial.Category {
	state := editorial.CategoryState{
		ID:           shared.CategoryID("cat_politics"),
		Slugs:        map[string]string{"en": "politics", "fr": "politique"},
		Names:        map[string]string{"en": "Politics", "fr": "Politique"},
		Descriptions: map[string]string{"en": "Power, policy and the people who wield both."},
		Order:        1,
	}

	for _, m := range mutate {
		m(&state)
	}

	return editorial.ReconstituteCategory(state)
}

func TestSlugInIsPerLocale(t *testing.T) {
	t.Parallel()

	// A French reader should land on /fr/rubriques/politique, not on an
	// English word. "Locale is data" applies to navigation too.
	en, err := politics().SlugIn("en")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	fr, err := politics().SlugIn("fr")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if en.String() != "politics" || fr.String() != "politique" {
		t.Errorf("en = %q, fr = %q", en, fr)
	}
}

func TestSlugInRefusesAnUncoveredLocale(t *testing.T) {
	t.Parallel()

	// A section with no slug in a locale is simply not reachable there. That
	// is how a section rolls out in one language before another, without a flag.
	if _, err := politics().SlugIn("de"); !errors.Is(err, editorial.ErrLocaleNotCovered) {
		t.Errorf("got %v, want ErrLocaleNotCovered", err)
	}
}

func TestCoversLocale(t *testing.T) {
	t.Parallel()

	if !politics().CoversLocale("fr") {
		t.Error("fr should be covered")
	}
	if politics().CoversLocale("de") {
		t.Error("de should not be covered")
	}
}

func TestNameInFallsBackVisibly(t *testing.T) {
	t.Parallel()

	// A missing translation shows the section in another language rather than
	// an empty heading. Visibly imperfect beats invisibly broken.
	partial := politics(func(s *editorial.CategoryState) {
		s.Names = map[string]string{"en": "Politics"}
	})

	if got := partial.NameIn("fr"); got != "Politics" {
		t.Errorf("NameIn(fr) = %q, want the English fallback", got)
	}
}

func TestNameInFallbackIsDeterministic(t *testing.T) {
	t.Parallel()

	// Go randomises map iteration. A heading that changed language between two
	// identical requests would be worse than either language on its own, so the
	// fallback picks the lowest locale key rather than whichever comes first.
	many := politics(func(s *editorial.CategoryState) {
		s.Names = map[string]string{"fr": "Politique", "es": "Política", "pt": "Política"}
	})

	first := many.NameIn("en")
	for range 20 {
		if got := many.NameIn("en"); got != first {
			t.Fatalf("fallback is not deterministic: %q then %q", first, got)
		}
	}
	if first != "Política" {
		t.Errorf("fallback = %q, want the lowest locale key (es)", first)
	}
}

func TestNameInIsEmptyWhenThereAreNoNames(t *testing.T) {
	t.Parallel()

	bare := politics(func(s *editorial.CategoryState) { s.Names = map[string]string{} })

	if got := bare.NameIn("en"); got != "" {
		t.Errorf("NameIn = %q, want empty", got)
	}
}

func TestDescriptionInDoesNotFallBack(t *testing.T) {
	t.Parallel()

	// Deliberately asymmetric with NameIn. A heading in the wrong language is
	// a visible glitch someone fixes; a whole paragraph in the wrong language
	// reads as a broken translation to every French reader on the section.
	if _, ok := politics().DescriptionIn("fr"); ok {
		t.Error("a French description must not fall back to English")
	}

	got, ok := politics().DescriptionIn("en")
	if !ok || got != "Power, policy and the people who wield both." {
		t.Errorf("DescriptionIn(en) = %q (ok=%v)", got, ok)
	}
}

func TestHierarchy(t *testing.T) {
	t.Parallel()

	if !politics().IsRootLevel() {
		t.Error("politics should be top level")
	}
	if _, ok := politics().ParentID(); ok {
		t.Error("a top-level section has no parent")
	}

	parent := shared.CategoryID("cat_news")
	child := politics(func(s *editorial.CategoryState) { s.ParentID = &parent })

	if child.IsRootLevel() {
		t.Error("a child is not top level")
	}
	if got, ok := child.ParentID(); !ok || got != parent {
		t.Errorf("parent = %q (ok=%v)", got, ok)
	}
}

func TestCategoryDoesNotAliasTheCallersMaps(t *testing.T) {
	t.Parallel()

	// Storing the caller's map would let whatever built the state mutate the
	// aggregate afterwards — exactly the action at a distance an aggregate
	// exists to prevent.
	slugs := map[string]string{"en": "politics"}
	category := editorial.ReconstituteCategory(editorial.CategoryState{
		ID:    shared.CategoryID("cat_politics"),
		Slugs: slugs,
		Names: map[string]string{"en": "Politics"},
	})

	slugs["en"] = "hijacked"

	got, err := category.SlugIn("en")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.String() != "politics" {
		t.Errorf("slug = %q — the aggregate aliased the caller's map", got)
	}

	// And the way out is a copy too.
	exported := category.State()
	exported.Slugs["en"] = "hijacked-again"

	if again, _ := category.SlugIn("en"); again.String() != "politics" {
		t.Errorf("slug = %q — State() handed out the aggregate's own map", again)
	}
}

func TestCategoryHandlesNilMaps(t *testing.T) {
	t.Parallel()

	bare := editorial.ReconstituteCategory(editorial.CategoryState{
		ID: shared.CategoryID("cat_bare"),
	})

	if bare.CoversLocale("en") {
		t.Error("a category with no slugs covers nothing")
	}
	if _, ok := bare.DescriptionIn("en"); ok {
		t.Error("a category with no descriptions has none")
	}
	if bare.Order() != 0 {
		t.Errorf("order = %d", bare.Order())
	}
}
