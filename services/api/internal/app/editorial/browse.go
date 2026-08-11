package editorial

import (
	"context"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/shared"
)

// ListedPublic is a card on a section page: headline plus approved standfirst.
type ListedPublic struct {
	Article PublicArticle `json:"article"`
	Excerpt *string       `json:"excerpt"`
}

// SectionPage is a category plus its live articles.
type SectionPage struct {
	Category SectionView `json:"category"`
	Articles ListedPage  `json:"articles"`
}

// ListedPage is one page of section cards.
type ListedPage struct {
	Items      []ListedPublic `json:"items"`
	NextCursor string         `json:"nextCursor"`
}

// BrowseCategory is a section page.
//
// Unknown slugs return ErrNotFound — a 404, not an empty section that looks
// like a real page with nothing in it yet.
type BrowseCategory struct{ deps Deps }

// NewBrowseCategory wires the use case.
func NewBrowseCategory(deps Deps) BrowseCategory { return BrowseCategory{deps: deps} }

// BrowseInput names the section URL.
type BrowseInput struct {
	Slug   string
	Locale string
	After  string
	Limit  int
}

// Execute loads the section and its published articles.
func (uc BrowseCategory) Execute(ctx context.Context, in BrowseInput) (SectionPage, error) {
	category, err := uc.deps.Categories.FindBySlug(ctx, in.Slug, in.Locale)
	if err != nil {
		return SectionPage{}, err
	}

	page, err := uc.deps.Articles.ListPublished(ctx, publishedQuery(PublicListInput{
		Locale: in.Locale, CategoryID: category.ID(), After: in.After, Limit: in.Limit,
	}))
	if err != nil {
		return SectionPage{}, err
	}

	items, err := withApprovedExcerpts(ctx, uc.deps.Revisions, visibleOnly(page.Items))
	if err != nil {
		return SectionPage{}, err
	}

	return SectionPage{
		Category: sectionView(category, in.Locale),
		Articles: ListedPage{Items: items, NextCursor: page.NextCursor},
	}, nil
}

func withApprovedExcerpts(
	ctx context.Context,
	revisions ports.RevisionRepository,
	articles []editorial.Article,
) ([]ListedPublic, error) {
	ids := make([]shared.RevisionID, 0, len(articles))
	for _, a := range articles {
		if id, ok := a.ApprovedRevisionID(); ok {
			ids = append(ids, id)
		}
	}
	revs, err := revisions.FindManyByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	byID := map[shared.RevisionID]string{}
	for _, r := range revs {
		byID[r.ID()] = r.Body()
	}

	out := make([]ListedPublic, 0, len(articles))
	for _, a := range articles {
		item := ListedPublic{Article: publicFrom(a)}
		if id, ok := a.ApprovedRevisionID(); ok {
			if body, found := byID[id]; found {
				ex := ExcerptFrom(body, publicExcerpt)
				item.Excerpt = &ex
			}
		}
		out = append(out, item)
	}

	return out, nil
}
