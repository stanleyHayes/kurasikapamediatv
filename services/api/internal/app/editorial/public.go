package editorial

import (
	"context"
	"errors"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/shared"
)

const (
	publicFallback = 12
	publicMax      = 50
	publicExcerpt  = 220
)

// PublicArticle is the reader-facing card: no workflow fields.
type PublicArticle struct {
	ID          string           `json:"id"`
	Slug        string           `json:"slug"`
	Locale      string           `json:"locale"`
	Title       string           `json:"title"`
	CategoryID  string           `json:"categoryId"`
	PublishedAt *time.Time       `json:"publishedAt"`
	Hero        *ArticleHeroView `json:"hero"`
}

func publicFrom(a editorial.Article) PublicArticle {
	view := PublicArticle{
		ID: a.ID().String(), Slug: a.Slug().String(), Locale: a.Locale(),
		Title: a.Title(), CategoryID: a.CategoryID().String(), Hero: heroViewOf(a),
	}
	if at, ok := a.PublishedAt(); ok {
		view.PublishedAt = &at
	}

	return view
}

// PublishedView is one live article plus the APPROVED text.
type PublishedView struct {
	Article PublicArticle `json:"article"`
	Body    *string       `json:"body"`
}

// GetPublishedArticle is the reader-facing lookup.
//
// Visibility is decided by the domain, not by a repository filter. A query
// that merely forgot status=published would serve a draft to the public.
type GetPublishedArticle struct{ deps Deps }

// NewGetPublishedArticle wires the use case.
func NewGetPublishedArticle(deps Deps) GetPublishedArticle {
	return GetPublishedArticle{deps: deps}
}

// GetPublishedInput names the public URL.
type GetPublishedInput struct {
	Slug   string
	Locale string
}

// Execute returns the live article, or ErrNotFound for anything a reader
// must not see — including a draft that happens to share the slug.
func (uc GetPublishedArticle) Execute(ctx context.Context, in GetPublishedInput) (PublishedView, error) {
	article, err := uc.deps.Articles.FindBySlug(ctx, in.Slug, in.Locale)
	if err != nil {
		return PublishedView{}, err
	}
	if !editorial.IsPubliclyVisible(article.Status()) {
		return PublishedView{}, ports.ErrNotFound
	}

	body, err := approvedBody(ctx, uc.deps.Revisions, article)
	if err != nil {
		return PublishedView{}, err
	}

	return PublishedView{Article: publicFrom(article), Body: body}, nil
}

func approvedBody(
	ctx context.Context,
	revisions ports.RevisionRepository,
	article editorial.Article,
) (*string, error) {
	id, ok := article.ApprovedRevisionID()
	if !ok {
		return nil, nil
	}
	rev, err := revisions.FindByID(ctx, id)
	if errors.Is(err, ports.ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	text := rev.Body()

	return &text, nil
}

func visibleOnly(items []editorial.Article) []editorial.Article {
	out := make([]editorial.Article, 0, len(items))
	for _, a := range items {
		if editorial.IsPubliclyVisible(a.Status()) {
			out = append(out, a)
		}
	}

	return out
}

func publishedQuery(in PublicListInput) ports.PublishedQuery {
	return ports.PublishedQuery{
		Locale:     in.Locale,
		CategoryID: in.CategoryID,
		Cursor: ports.Cursor{
			After: in.After,
			Limit: clampWithin(in.Limit, publicFallback, publicMax),
		},
	}
}

// PublicListInput is cursor pagination for reader listings.
type PublicListInput struct {
	Locale     string
	CategoryID shared.CategoryID
	After      string
	Limit      int
}
