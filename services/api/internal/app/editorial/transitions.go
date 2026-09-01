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

// TransitionResult is the post-transition status the CMS needs.
type TransitionResult struct {
	ID     shared.ArticleID `json:"id"`
	Status string           `json:"status"`
	Locale string           `json:"locale"`
	Slug   string           `json:"slug"`
}

func transitionResult(a editorial.Article) TransitionResult {
	return TransitionResult{
		ID: a.ID(), Status: string(a.Status()), Locale: a.Locale(), Slug: a.Slug().String(),
	}
}

func announce(ctx context.Context, deps Deps, name string, a editorial.Article, detail map[string]string) {
	_ = deps.Events.Publish(ctx, ports.Event{
		Name: name, ArticleID: a.ID(), Locale: a.Locale(), Slug: a.Slug().String(),
		OccurredAt: deps.Clock.Now(), Detail: detail,
	})
}

// SubmitForReview sends a draft to the review queue.
type SubmitForReview struct{ deps Deps }

// NewSubmitForReview wires the use case.
func NewSubmitForReview(deps Deps) SubmitForReview { return SubmitForReview{deps: deps} }

// SubmitInput names the article to submit.
type SubmitInput struct {
	Actor     identity.Actor
	ArticleID shared.ArticleID
}

// Execute submits the article.
func (uc SubmitForReview) Execute(ctx context.Context, in SubmitInput) (TransitionResult, error) {
	article, err := uc.deps.Articles.FindByID(ctx, in.ArticleID)
	if err != nil {
		return TransitionResult{}, err
	}

	next, err := article.Submit(in.Actor)
	if err != nil {
		return TransitionResult{}, err
	}
	if err := uc.deps.Articles.Save(ctx, next); err != nil {
		return TransitionResult{}, fmt.Errorf("saving: %w", err)
	}

	announce(ctx, uc.deps, "article.submitted", next, nil)

	return transitionResult(next), nil
}

// ApproveArticle marks a specific revision as the one that may be published.
type ApproveArticle struct{ deps Deps }

// NewApproveArticle wires the use case.
func NewApproveArticle(deps Deps) ApproveArticle { return ApproveArticle{deps: deps} }

// ApproveInput names the article and the revision being approved.
type ApproveInput struct {
	Actor      identity.Actor
	ArticleID  shared.ArticleID
	RevisionID shared.RevisionID
}

// Execute approves the named revision.
func (uc ApproveArticle) Execute(ctx context.Context, in ApproveInput) (TransitionResult, error) {
	article, err := uc.deps.Articles.FindByID(ctx, in.ArticleID)
	if err != nil {
		return TransitionResult{}, err
	}

	revision, err := uc.deps.Revisions.FindByID(ctx, in.RevisionID)
	if err != nil {
		return TransitionResult{}, err
	}

	next, err := article.Approve(in.RevisionID, revision.ArticleID(), in.Actor)
	if err != nil {
		return TransitionResult{}, err
	}
	if err := uc.deps.Articles.Save(ctx, next); err != nil {
		return TransitionResult{}, fmt.Errorf("saving: %w", err)
	}

	announce(ctx, uc.deps, "article.approved", next, map[string]string{
		"revisionId": string(in.RevisionID),
	})

	return transitionResult(next), nil
}

// RejectArticle sends an article back to draft.
type RejectArticle struct{ deps Deps }

// NewRejectArticle wires the use case.
func NewRejectArticle(deps Deps) RejectArticle { return RejectArticle{deps: deps} }

// RejectInput carries the note shown to the author.
type RejectInput struct {
	Actor     identity.Actor
	ArticleID shared.ArticleID
	Note      string
}

// Execute rejects the article.
func (uc RejectArticle) Execute(ctx context.Context, in RejectInput) (TransitionResult, error) {
	article, err := uc.deps.Articles.FindByID(ctx, in.ArticleID)
	if err != nil {
		return TransitionResult{}, err
	}

	next, err := article.Reject(in.Actor)
	if err != nil {
		return TransitionResult{}, err
	}
	if err := uc.deps.Articles.Save(ctx, next); err != nil {
		return TransitionResult{}, fmt.Errorf("saving: %w", err)
	}

	announce(ctx, uc.deps, "article.rejected", next, map[string]string{"note": in.Note})

	return transitionResult(next), nil
}

// SchedulePublication sets a future publication time.
type SchedulePublication struct{ deps Deps }

// NewSchedulePublication wires the use case.
func NewSchedulePublication(deps Deps) SchedulePublication {
	return SchedulePublication{deps: deps}
}

// ScheduleInput names when to publish.
type ScheduleInput struct {
	Actor     identity.Actor
	ArticleID shared.ArticleID
	At        time.Time
}

// Execute schedules the article.
func (uc SchedulePublication) Execute(ctx context.Context, in ScheduleInput) (TransitionResult, error) {
	article, err := uc.deps.Articles.FindByID(ctx, in.ArticleID)
	if err != nil {
		return TransitionResult{}, err
	}

	next, err := article.Schedule(in.At, uc.deps.Clock.Now(), in.Actor)
	if err != nil {
		return TransitionResult{}, err
	}
	if err := uc.deps.Articles.Save(ctx, next); err != nil {
		return TransitionResult{}, fmt.Errorf("saving: %w", err)
	}

	announce(ctx, uc.deps, "article.scheduled", next, map[string]string{
		"scheduledAt": in.At.UTC().Format(time.RFC3339),
	})

	return transitionResult(next), nil
}

// UnpublishArticle pulls a live article.
type UnpublishArticle struct{ deps Deps }

// NewUnpublishArticle wires the use case.
func NewUnpublishArticle(deps Deps) UnpublishArticle { return UnpublishArticle{deps: deps} }

// UnpublishInput carries the reason retained for the audit log.
type UnpublishInput struct {
	Actor     identity.Actor
	ArticleID shared.ArticleID
	Reason    string
}

// Execute unpublishes the article.
func (uc UnpublishArticle) Execute(ctx context.Context, in UnpublishInput) (TransitionResult, error) {
	article, err := uc.deps.Articles.FindByID(ctx, in.ArticleID)
	if err != nil {
		return TransitionResult{}, err
	}

	next, err := article.Unpublish(in.Actor)
	if err != nil {
		return TransitionResult{}, err
	}
	if err := uc.deps.Articles.Save(ctx, next); err != nil {
		return TransitionResult{}, fmt.Errorf("saving: %w", err)
	}
	if uc.deps.Semantic != nil {
		_ = uc.deps.Semantic.Deactivate(ctx, next.ID())
	}

	announce(ctx, uc.deps, "article.unpublished", next, map[string]string{"reason": in.Reason})

	return transitionResult(next), nil
}
