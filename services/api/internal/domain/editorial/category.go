package editorial

import (
	"errors"
	"fmt"

	"github.com/kurasikapa/api/internal/domain/shared"
)

// ErrLocaleNotCovered means the category has no slug in the requested locale.
var ErrLocaleNotCovered = errors.New("category has no slug for this locale")

// Category is a section of the site.
//
// Slugs are per-locale for the same reason articles are: a French reader
// should land on /fr/rubriques/politique, not on an English word. "Locale is
// data" applies to navigation as much as to prose.
//
// A category with no slug in a locale is simply not reachable there — which is
// how a section is rolled out in one language before another, without a flag.
type Category struct {
	id           shared.CategoryID
	parentID     *shared.CategoryID
	slugs        map[string]string
	names        map[string]string
	descriptions map[string]string
	order        int
}

// CategoryState is the full set of fields, for reconstitution and persistence.
type CategoryState struct {
	ID           shared.CategoryID
	ParentID     *shared.CategoryID
	Slugs        map[string]string
	Names        map[string]string
	Descriptions map[string]string
	Order        int
}

// ReconstituteCategory rebuilds a category from storage.
//
// Maps are copied rather than aliased. Storing the caller's map would let
// whatever built the state mutate the aggregate afterwards, which is exactly
// the sort of action-at-a-distance an aggregate exists to prevent.
func ReconstituteCategory(s CategoryState) Category {
	return Category{
		id:           s.ID,
		parentID:     s.ParentID,
		slugs:        copyMap(s.Slugs),
		names:        copyMap(s.Names),
		descriptions: copyMap(s.Descriptions),
		order:        s.Order,
	}
}

// State returns a snapshot for mapping to storage, with maps copied out.
func (c Category) State() CategoryState {
	return CategoryState{
		ID:           c.id,
		ParentID:     c.parentID,
		Slugs:        copyMap(c.slugs),
		Names:        copyMap(c.names),
		Descriptions: copyMap(c.descriptions),
		Order:        c.order,
	}
}

// ID returns the category identifier.
func (c Category) ID() shared.CategoryID { return c.id }

// Order returns the sort position within its level.
func (c Category) Order() int { return c.order }

// ParentID returns the parent category, if this is not top level.
func (c Category) ParentID() (shared.CategoryID, bool) {
	if c.parentID == nil {
		return "", false
	}

	return *c.parentID, true
}

// IsRootLevel reports whether this is a top-level section.
func (c Category) IsRootLevel() bool { return c.parentID == nil }

// CoversLocale reports whether the section is reachable in a locale.
func (c Category) CoversLocale(locale string) bool {
	_, ok := c.slugs[locale]

	return ok
}

// SlugIn returns the section's URL segment for a locale.
func (c Category) SlugIn(locale string) (shared.Slug, error) {
	raw, ok := c.slugs[locale]
	if !ok {
		return shared.Slug{}, fmt.Errorf("%w: %s (%s)", ErrLocaleNotCovered, c.id, locale)
	}

	return shared.NewSlug(raw)
}

// NameIn returns the display name, falling back to any name it has.
//
// A missing translation shows the section in another language rather than an
// empty heading. Visibly imperfect beats invisibly broken, and it makes the gap
// obvious to whoever can fix it.
//
// The fallback is deterministic — locales are visited in sorted order — because
// Go map iteration is randomised, and a heading that changes language between
// two identical requests would be worse than either outcome.
func (c Category) NameIn(locale string) string {
	if name, ok := c.names[locale]; ok {
		return name
	}

	return firstBySortedKey(c.names)
}

// DescriptionIn returns the section standfirst, or "" and false.
//
// Deliberately does NOT fall back to another locale, unlike NameIn. A heading
// in the wrong language is a visible glitch someone fixes; a whole paragraph in
// the wrong language reads as a broken translation to every reader who lands
// on the section.
func (c Category) DescriptionIn(locale string) (string, bool) {
	description, ok := c.descriptions[locale]

	return description, ok
}

func copyMap(in map[string]string) map[string]string {
	if in == nil {
		return map[string]string{}
	}

	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}

	return out
}

// firstBySortedKey returns the value under the lowest key.
//
// Lowest key rather than "any key" because Go randomises map iteration, and a
// section heading that changed language between two identical requests would
// be worse than either language on its own.
func firstBySortedKey(m map[string]string) string {
	lowest := ""

	for k := range m {
		if lowest == "" || k < lowest {
			lowest = k
		}
	}

	return m[lowest]
}
