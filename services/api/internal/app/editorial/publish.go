package editorial

import (
	"context"
	"fmt"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

// PublishArticleInput names the article to publish.
type PublishArticleInput struct {
	Actor     identity.Actor
	ArticleID shared.ArticleID
}

// PublishArticle makes an approved article live.
type PublishArticle struct {
	deps Deps
}

// NewPublishArticle wires the use case.
func NewPublishArticle(deps Deps) PublishArticle { return PublishArticle{deps: deps} }

// Execute publishes the article and announces it.
func (uc PublishArticle) Execute(ctx context.Context, in PublishArticleInput) (editorial.Article, error) {
	article, err := uc.deps.Articles.FindByID(ctx, in.ArticleID)
	if err != nil {
		return editorial.Article{}, err
	}

	return publishAndAnnounce(ctx, uc.deps, article, in.Actor, uc.deps.Clock.Now())
}

// PublishDueResult reports what a cron run did.
//
// Published and Failed are separate lists rather than an error: one article
// failing must not strand the rest of the batch, and a caller that cannot see
// which ones failed cannot alert on them. Silently swallowing a failure means
// a scheduled article quietly never goes live, which is the worst outcome
// available to a newsroom.
type PublishDueResult struct {
	// Tagged because this crosses the wire. Without tags Go emits
	// "Published"/"Failed", which is inconsistent with every other response
	// and the sort of thing a client works around rather than reports.
	Published []PublishedItem  `json:"published"`
	Failed    []PublishFailure `json:"failed"`
}

// PublishedItem is enough for the Next BFF to invalidate caches and write an
// audit entry without a second round-trip. Id alone was not: listing rails are
// tagged by locale.
type PublishedItem struct {
	ID     shared.ArticleID `json:"id"`
	Slug   string           `json:"slug"`
	Locale string           `json:"locale"`
}

// PublishFailure names one article that could not be published, and why.
type PublishFailure struct {
	ArticleID shared.ArticleID `json:"articleId"`
	Reason    string           `json:"reason"`
}

// PublishDueArticles is the scheduled-publication cron.
//
// Nothing calls the TypeScript equivalent today, which means SchedulePublication
// currently writes a promise the system never keeps. Wiring this to a trigger
// is what closes that hole.
type PublishDueArticles struct {
	deps Deps
}

// NewPublishDueArticles wires the use case.
func NewPublishDueArticles(deps Deps) PublishDueArticles { return PublishDueArticles{deps: deps} }

// Execute publishes every article whose scheduled time has passed.
//
// The actor is supplied by the composition root — a system identity holding
// article:publish. The cron does not get to bypass authorisation; it gets an
// identity like anything else, so the same domain rule decides.
func (uc PublishDueArticles) Execute(ctx context.Context, actor identity.Actor) (PublishDueResult, error) {
	now := uc.deps.Clock.Now()

	due, err := uc.deps.Articles.ListDueForPublication(ctx, now)
	if err != nil {
		return PublishDueResult{}, fmt.Errorf("listing due articles: %w", err)
	}

	// Initialised to empty slices, not nil. nil marshals to `null`, and a
	// client doing `failed.length` on null crashes — "nothing failed" is a
	// fact worth stating positively rather than as an absence.
	result := PublishDueResult{Published: []PublishedItem{}, Failed: []PublishFailure{}}

	for _, article := range due {
		published, err := publishAndAnnounce(ctx, uc.deps, article, actor, now)
		if err != nil {
			result.Failed = append(result.Failed, PublishFailure{
				ArticleID: article.ID(),
				Reason:    err.Error(),
			})

			continue
		}

		result.Published = append(result.Published, PublishedItem{
			ID:     published.ID(),
			Slug:   published.Slug().String(),
			Locale: published.Locale(),
		})
	}

	return result, nil
}

// publishAndAnnounce is the step both paths share: ask the domain, save, tell.
//
// Shared deliberately. An immediate publish and a scheduled one must produce
// exactly the same state and the same event; two copies of this would drift,
// and the drift would show up as "the cron publishes articles that do not
// appear on the homepage".
func publishAndAnnounce(
	ctx context.Context,
	deps Deps,
	article editorial.Article,
	actor identity.Actor,
	now time.Time,
) (editorial.Article, error) {
	published, err := article.Publish(now, actor)
	if err != nil {
		return editorial.Article{}, err
	}

	if err := deps.Articles.Save(ctx, published); err != nil {
		return editorial.Article{}, fmt.Errorf("saving published article: %w", err)
	}

	// Vector indexing is asynchronous and never changes publication truth. The
	// durable queue is best-effort here for the same reason as cache events: a
	// story already saved as published must not be reported as unpublished.
	_ = queueSemanticArticle(ctx, deps, published)

	// After the save, never before. An event announcing a publication that did
	// not persist would invalidate caches for an article still sitting in its
	// old state — the reader would see the story vanish and come back.
	event := ports.Event{
		Name:       "article.published",
		ArticleID:  published.ID(),
		Locale:     published.Locale(),
		Slug:       published.Slug().String(),
		OccurredAt: now,
	}
	// Discarded deliberately, and the contract says why: the article IS
	// published by this point. Failing the call now would tell the editor it
	// did not work and invite them to press publish again. A stale cache
	// expires on its own; a double publish does not.
	//
	// This is not a silent failure — EventBus implementations are required to
	// report their own delivery failures. See the port.
	_ = deps.Events.Publish(ctx, event)

	return published, nil
}
