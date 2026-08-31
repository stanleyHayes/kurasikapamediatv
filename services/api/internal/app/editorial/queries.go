package editorial

import (
	"context"
	"errors"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

const (
	listFallback = 25
	listMax      = 100
	excerptChars = 140
)

// DraftView is the wire shape for the studio editor.
type DraftView struct {
	Article StudioArticle `json:"article"`
	Latest  *RevisionView `json:"latest"`
}

// StudioArticle is what the CMS lists and the editor header needs.
type StudioArticle struct {
	ID          string           `json:"id"`
	FamilyID    string           `json:"familyId"`
	Locale      string           `json:"locale"`
	Slug        string           `json:"slug"`
	Title       string           `json:"title"`
	Status      string           `json:"status"`
	CategoryID  string           `json:"categoryId"`
	PublishedAt *time.Time       `json:"publishedAt"`
	ScheduledAt *time.Time       `json:"scheduledAt"`
	Excerpt     *string          `json:"excerpt"`
	Hero        *ArticleHeroView `json:"hero"`
}

// RevisionView is one history row. Excerpt is for the panel; Body is the text.
type RevisionView struct {
	ID        string    `json:"id"`
	Seq       int       `json:"seq"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
	Excerpt   string    `json:"excerpt"`
}

func studioFrom(a editorial.Article) StudioArticle {
	view := StudioArticle{
		ID: a.ID().String(), FamilyID: a.FamilyID().String(), Locale: a.Locale(),
		Slug: a.Slug().String(), Title: a.Title(), Status: string(a.Status()),
		CategoryID: a.CategoryID().String(), Hero: heroViewOf(a),
	}
	if at, ok := a.PublishedAt(); ok {
		view.PublishedAt = &at
	}
	if at, ok := a.ScheduledAt(); ok {
		view.ScheduledAt = &at
	}

	return view
}

func revisionView(r editorial.Revision, excerptLimit int) RevisionView {
	return RevisionView{
		ID: r.ID().String(), Seq: r.Seq(), Title: r.Title(), Body: r.Body(),
		CreatedAt: r.CreatedAt(), Excerpt: ExcerptFrom(r.Body(), excerptLimit),
	}
}

func clampLimit(requested int) int {
	return clampWithin(requested, listFallback, listMax)
}

func clampWithin(requested, fallback, max int) int {
	if requested < 1 {
		return fallback
	}
	if requested > max {
		return max
	}

	return requested
}

// GetDraft loads an article and its current text for the editor.
type GetDraft struct{ deps Deps }

// NewGetDraft wires the use case.
func NewGetDraft(deps Deps) GetDraft { return GetDraft{deps: deps} }

// GetDraftInput names the article to open.
type GetDraftInput struct {
	Actor     identity.Actor
	ArticleID shared.ArticleID
}

// Execute loads the draft. Authorisation is not optional even though this only
// reads: an unpublished draft is confidential until the newsroom decides otherwise.
func (uc GetDraft) Execute(ctx context.Context, in GetDraftInput) (DraftView, error) {
	article, err := uc.deps.Articles.FindByID(ctx, in.ArticleID)
	if err != nil {
		return DraftView{}, err
	}
	if err := article.AssertReadable(in.Actor); err != nil {
		return DraftView{}, err
	}

	latest, err := uc.deps.Revisions.FindLatest(ctx, article.ID())
	var latestView *RevisionView
	if err == nil {
		view := revisionView(latest, 160)
		latestView = &view
	} else if !errors.Is(err, ports.ErrNotFound) {
		return DraftView{}, err
	}

	return DraftView{Article: studioFrom(article), Latest: latestView}, nil
}

// AuthoredPage is one page of "my drafts".
type AuthoredPage struct {
	Items      []StudioArticle `json:"items"`
	NextCursor string          `json:"nextCursor"`
}

// ListAuthoredArticles is "my drafts" in the CMS.
//
// Scoped to the actor's own id, never to an id supplied by the caller.
type ListAuthoredArticles struct{ deps Deps }

// NewListAuthoredArticles wires the use case.
func NewListAuthoredArticles(deps Deps) ListAuthoredArticles {
	return ListAuthoredArticles{deps: deps}
}

// ListInput is cursor pagination for studio lists.
type ListInput struct {
	Actor identity.Actor
	After string
	Limit int
}

// Execute lists the caller's own articles.
func (uc ListAuthoredArticles) Execute(ctx context.Context, in ListInput) (AuthoredPage, error) {
	page, err := uc.deps.Articles.ListAuthoredBy(ctx, ports.AuthoredQuery{
		AuthorID: in.Actor.ID(),
		Cursor:   ports.Cursor{After: in.After, Limit: clampLimit(in.Limit)},
	})
	if err != nil {
		return AuthoredPage{}, err
	}

	ids := make([]shared.ArticleID, 0, len(page.Items))
	for _, a := range page.Items {
		ids = append(ids, a.ID())
	}
	latest, err := uc.deps.Revisions.FindLatestForArticles(ctx, ids)
	if err != nil {
		return AuthoredPage{}, err
	}
	byArticle := map[shared.ArticleID]string{}
	for _, r := range latest {
		byArticle[r.ArticleID()] = r.Body()
	}

	items := make([]StudioArticle, 0, len(page.Items))
	for _, a := range page.Items {
		item := studioFrom(a)
		if body, ok := byArticle[a.ID()]; ok {
			ex := ExcerptFrom(body, excerptChars)
			item.Excerpt = &ex
		}
		items = append(items, item)
	}

	return AuthoredPage{Items: items, NextCursor: page.NextCursor}, nil
}

// ReviewPage is the editorial review queue.
type ReviewPage struct {
	Items      []StudioArticle `json:"items"`
	NextCursor string          `json:"nextCursor"`
}

// ListAwaitingReview is the review queue. Permission is the only thing
// standing between a journalist and every colleague's submission.
type ListAwaitingReview struct{ deps Deps }

// NewListAwaitingReview wires the use case.
func NewListAwaitingReview(deps Deps) ListAwaitingReview {
	return ListAwaitingReview{deps: deps}
}

// Execute lists articles in review.
func (uc ListAwaitingReview) Execute(ctx context.Context, in ListInput) (ReviewPage, error) {
	if err := in.Actor.Require(identity.PermArticleApprove); err != nil {
		return ReviewPage{}, err
	}

	page, err := uc.deps.Articles.ListAwaitingReview(ctx, ports.Cursor{
		After: in.After, Limit: clampLimit(in.Limit),
	})
	if err != nil {
		return ReviewPage{}, err
	}

	items := make([]StudioArticle, 0, len(page.Items))
	for _, a := range page.Items {
		items = append(items, studioFrom(a))
	}

	return ReviewPage{Items: items, NextCursor: page.NextCursor}, nil
}
