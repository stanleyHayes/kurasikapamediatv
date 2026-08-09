// Package shared holds the value objects every bounded context needs.
//
// Like the rest of internal/domain it imports no driver, no framework and no
// SDK. That is the point of the ring, and CI enforces it.
//
// One narrow exception: golang.org/x/text for Unicode NFC normalisation.
// JavaScript has String.prototype.normalize in the language; Go does not, and
// x/text is the Go team's own module for it. The exception is spelled out in
// the boundary check rather than left to judgement, and it is the only
// non-stdlib import the domain is permitted.
package shared

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// MaxSlugLen bounds a slug so a URL stays usable and an index stays small.
const MaxSlugLen = 120

var (
	// ErrEmptySlug is returned when normalisation leaves nothing behind — a
	// title of only punctuation, say.
	ErrEmptySlug = errors.New("slug: cannot be empty")
	// ErrSlugTooLong is returned above MaxSlugLen.
	ErrSlugTooLong = errors.New("slug: too long")
)

// disallowed matches every rune a slug may not contain.
//
// Letters and numbers are matched by Unicode category, not by [a-z0-9]. Twi
// uses ɛ and ɔ, French uses é and à, and an ASCII-only slug would quietly
// mangle both. The client publishes in French today and named local languages
// as an open question, so this is not hypothetical.
//
// Go's regexp is stateless between calls, unlike a JavaScript /g regexp whose
// lastIndex makes repeated .test() calls alternate — the bug the TypeScript
// Slug hit. Noted because the shape of the code looks similar and the trap
// does not exist here.
var disallowed = regexp.MustCompile(`[^\p{L}\p{N}-]+`)

// Slug is a URL-safe identifier for an article or a section.
//
// The zero value is not valid; construct with NewSlug or SlugFrom.
type Slug struct {
	value string
}

// String returns the slug text. The zero Slug returns "".
func (s Slug) String() string { return s.value }

// IsZero reports whether this is the uninitialised Slug.
func (s Slug) IsZero() bool { return s.value == "" }

// NewSlug validates an already-slugified string, rejecting anything it would
// have had to change.
//
// Deliberately strict: SlugFrom is for turning a title into a slug, and this
// is for reading one back from storage or from an editor's hands. Silently
// repairing here would let a stored slug drift from the URL it was published
// under, which breaks every inbound link to it.
func NewSlug(raw string) (Slug, error) {
	if raw == "" {
		return Slug{}, ErrEmptySlug
	}
	if len([]rune(raw)) > MaxSlugLen {
		return Slug{}, fmt.Errorf("%w: %d runes, max %d", ErrSlugTooLong, len([]rune(raw)), MaxSlugLen)
	}
	if normalised := SlugFrom(raw); normalised.value != raw {
		return Slug{}, fmt.Errorf("slug: %q is not normalised, expected %q", raw, normalised.value)
	}

	return Slug{value: raw}, nil
}

// SlugFrom derives a slug from arbitrary text, such as a headline.
//
// Returns the zero Slug when nothing survives normalisation; callers decide
// whether that is an error. CreateDraft treats it as one, because an article
// with no addressable URL cannot be published.
func SlugFrom(text string) Slug {
	// NFC first, so "e" + combining acute and the single rune "é" both become
	// the same rune before anything else looks at them. Skipping this makes
	// two visually identical titles produce two different slugs.
	folded := strings.ToLower(norm.NFC.String(text))

	cleaned := disallowed.ReplaceAllString(folded, "-")
	cleaned = strings.Trim(cleaned, "-")

	// Collapse runs left by adjacent punctuation: "a -- b" must not become
	// "a---b".
	for strings.Contains(cleaned, "--") {
		cleaned = strings.ReplaceAll(cleaned, "--", "-")
	}

	if runes := []rune(cleaned); len(runes) > MaxSlugLen {
		cleaned = strings.Trim(string(runes[:MaxSlugLen]), "-")
	}

	return Slug{value: cleaned}
}

// HasLetterOrNumber reports whether text contains anything a slug could be
// built from. Used to tell "unsluggable title" from "empty title" in errors.
func HasLetterOrNumber(text string) bool {
	for _, r := range text {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			return true
		}
	}

	return false
}
