package shared_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestSlugFrom(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		in   string
		want string
	}{
		{"lowercases and hyphenates a headline", "Budget 2026: What Changes", "budget-2026-what-changes"},
		{"keeps digits", "Top 10 Stories", "top-10-stories"},
		{"collapses runs of punctuation", "a -- b", "a-b"},
		{"trims leading and trailing separators", "  ...Hello...  ", "hello"},
		{
			// The client publishes in French today. An ASCII-only slug would
			// turn this into "conomie", which is not a word.
			"keeps French accents rather than stripping them",
			"Économie et Société",
			"économie-et-société",
		},
		{
			// Twi uses ɛ and ɔ. Local languages beyond EN/FR are an open
			// question for the client, so the door is deliberately left open.
			"keeps Twi vowels",
			"Ɛdeɛn na ɛreba",
			"ɛdeɛn-na-ɛreba",
		},
		{"yields nothing when there is nothing to slugify", "!!! ???", ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := shared.SlugFrom(tc.in).String(); got != tc.want {
				t.Errorf("SlugFrom(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestSlugFromNormalisesCombiningMarks(t *testing.T) {
	t.Parallel()

	// "é" as one rune, and as "e" plus a combining acute. A reader cannot see
	// the difference; without NFC they produce two different slugs, so the
	// same headline published twice would occupy two URLs.
	precomposed := shared.SlugFrom("Économie")
	decomposed := shared.SlugFrom("Économie")

	if precomposed.String() != decomposed.String() {
		t.Errorf("normalisation differs: %q vs %q", precomposed, decomposed)
	}
}

func TestSlugFromTruncatesOnTheLimit(t *testing.T) {
	t.Parallel()

	got := shared.SlugFrom(strings.Repeat("a", shared.MaxSlugLen+50))

	if runes := []rune(got.String()); len(runes) > shared.MaxSlugLen {
		t.Errorf("got %d runes, want at most %d", len(runes), shared.MaxSlugLen)
	}
}

func TestSlugFromIsStableAcrossRepeatedCalls(t *testing.T) {
	t.Parallel()

	// Guards the bug the TypeScript Slug shipped: a global regexp there carried
	// lastIndex between calls, so validating the same string twice alternated
	// between accept and reject. Go's regexp is stateless, and this test is
	// what proves it stays that way if the implementation is ever rewritten.
	const headline = "Parliament Debates the Media Freedom Bill"

	first := shared.SlugFrom(headline).String()
	for i := range 5 {
		if got := shared.SlugFrom(headline).String(); got != first {
			t.Fatalf("call %d returned %q, first call returned %q", i+2, got, first)
		}
	}
}

func TestNewSlug(t *testing.T) {
	t.Parallel()

	t.Run("accepts an already-normalised slug", func(t *testing.T) {
		t.Parallel()

		got, err := shared.NewSlug("budget-2026")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.String() != "budget-2026" {
			t.Errorf("got %q", got)
		}
	})

	t.Run("refuses an empty slug", func(t *testing.T) {
		t.Parallel()

		if _, err := shared.NewSlug(""); !errors.Is(err, shared.ErrEmptySlug) {
			t.Errorf("got %v, want ErrEmptySlug", err)
		}
	})

	t.Run("refuses one over the length limit", func(t *testing.T) {
		t.Parallel()

		_, err := shared.NewSlug(strings.Repeat("a", shared.MaxSlugLen+1))
		if !errors.Is(err, shared.ErrSlugTooLong) {
			t.Errorf("got %v, want ErrSlugTooLong", err)
		}
	})

	t.Run("refuses to silently repair an unnormalised slug", func(t *testing.T) {
		t.Parallel()

		// Repairing here would let the stored slug drift from the URL the
		// article was published under, breaking every inbound link.
		if _, err := shared.NewSlug("Budget 2026"); err == nil {
			t.Error("expected an error for an unnormalised slug")
		}
	})
}

func TestHasLetterOrNumber(t *testing.T) {
	t.Parallel()

	cases := map[string]bool{
		"hello":   true,
		"2026":    true,
		"ɛdeɛn":   true,
		"!!! ???": false,
		"":        false,
	}

	for in, want := range cases {
		if got := shared.HasLetterOrNumber(in); got != want {
			t.Errorf("HasLetterOrNumber(%q) = %v, want %v", in, got, want)
		}
	}
}
