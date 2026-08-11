package editorial

import (
	"context"
)

// PublicPage is one page of live articles.
type PublicPage struct {
	Items      []PublicArticle `json:"items"`
	NextCursor string          `json:"nextCursor"`
}

// ListPublishedArticles is the homepage rail and sitemap.
type ListPublishedArticles struct{ deps Deps }

// NewListPublishedArticles wires the use case.
func NewListPublishedArticles(deps Deps) ListPublishedArticles {
	return ListPublishedArticles{deps: deps}
}

// Execute lists live articles. The repository filters, and so do we.
func (uc ListPublishedArticles) Execute(ctx context.Context, in PublicListInput) (PublicPage, error) {
	page, err := uc.deps.Articles.ListPublished(ctx, publishedQuery(in))
	if err != nil {
		return PublicPage{}, err
	}

	items := make([]PublicArticle, 0, len(page.Items))
	for _, a := range visibleOnly(page.Items) {
		items = append(items, publicFrom(a))
	}

	return PublicPage{Items: items, NextCursor: page.NextCursor}, nil
}
