package editorial

import (
	"context"

	"github.com/kurasikapa/api/internal/domain/editorial"
)

// SectionView is one nav item for a locale.
type SectionView struct {
	ID          string  `json:"id"`
	Slug        string  `json:"slug"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Order       int     `json:"order"`
}

func sectionView(c editorial.Category, locale string) SectionView {
	view := SectionView{
		ID: c.ID().String(), Name: c.NameIn(locale), Order: c.Order(),
	}
	if slug, err := c.SlugIn(locale); err == nil {
		view.Slug = slug.String()
	}
	if d, ok := c.DescriptionIn(locale); ok {
		view.Description = &d
	}

	return view
}

// ListSections is the site's navigation for one locale.
//
// Categories with no slug in the locale are absent rather than shown broken.
type ListSections struct{ deps Deps }

// NewListSections wires the use case.
func NewListSections(deps Deps) ListSections { return ListSections{deps: deps} }

// Execute lists sections in editorial order.
func (uc ListSections) Execute(ctx context.Context, locale string) ([]SectionView, error) {
	sections, err := uc.deps.Categories.ListForLocale(ctx, locale)
	if err != nil {
		return nil, err
	}

	out := make([]SectionView, 0, len(sections))
	for _, c := range sections {
		out = append(out, sectionView(c, locale))
	}

	return out, nil
}
