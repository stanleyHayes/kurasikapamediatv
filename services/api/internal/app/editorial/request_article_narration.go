package editorial

import (
	"context"
	"errors"
	"fmt"

	"github.com/kurasikapa/api/internal/app/ports"
	domaineditorial "github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var (
	ErrNarrationTextTooLong = errors.New("article exceeds the narration provider character limit")
	ErrNarrationTextEmpty   = errors.New("article has no text to narrate")
)

type RequestArticleNarration struct {
	deps     Deps
	jobs     ports.NarrationJobRepository
	provider ports.NarrationProvider
}

func NewRequestArticleNarration(deps Deps, jobs ports.NarrationJobRepository, provider ports.NarrationProvider) RequestArticleNarration {
	return RequestArticleNarration{deps: deps, jobs: jobs, provider: provider}
}

func (u RequestArticleNarration) Execute(ctx context.Context, actor identity.Actor, articleID shared.ArticleID) (NarrationJobView, error) {
	if err := actor.Require(identity.PermArticlePublish); err != nil {
		return NarrationJobView{}, err
	}
	article, revision, err := u.approvedRevision(ctx, articleID)
	if err != nil {
		return NarrationJobView{}, err
	}
	text := NarrationText(article.Title(), revision.Body())
	if text == "" {
		return NarrationJobView{}, ErrNarrationTextEmpty
	}
	if narrationTooLong(text) {
		return NarrationJobView{}, ErrNarrationTextTooLong
	}
	job, err := media.NewNarrationJob(actor, media.NarrationJobState{
		ID: shared.NarrationJobID(u.deps.IDs.NewID()), ArticleID: article.ID(), RevisionID: revision.ID(),
		Locale: article.Locale(), Voice: voiceFor(article.Locale()),
	}, u.deps.Clock.Now())
	if err != nil {
		return NarrationJobView{}, err
	}
	if err = u.jobs.Save(ctx, job); err != nil {
		return NarrationJobView{}, err
	}
	taskID, err := u.provider.Start(ctx, ports.NarrationRequest{
		JobID: job.ID(), Text: text, Locale: article.Locale(), Voice: job.State().Voice,
	})
	if err != nil {
		return NarrationJobView{}, u.recordStartFailure(ctx, actor, job, err)
	}
	job, err = job.Start(actor, taskID, u.deps.Clock.Now())
	if err == nil {
		err = u.jobs.Save(ctx, job)
	}
	return narrationJobView(job), err
}

func (u RequestArticleNarration) approvedRevision(ctx context.Context, articleID shared.ArticleID) (domaineditorial.Article, domaineditorial.Revision, error) {
	article, err := u.deps.Articles.FindByID(ctx, articleID)
	if err != nil {
		return domaineditorial.Article{}, domaineditorial.Revision{}, err
	}
	revisionID, ok := article.ApprovedRevisionID()
	if !ok {
		return domaineditorial.Article{}, domaineditorial.Revision{}, domaineditorial.ErrNoApprovedRevision
	}
	revision, err := u.deps.Revisions.FindByID(ctx, revisionID)
	return article, revision, err
}

func (u RequestArticleNarration) recordStartFailure(ctx context.Context, actor identity.Actor, job media.NarrationJob, cause error) error {
	failed, transitionErr := job.Fail(actor, cause.Error(), u.deps.Clock.Now())
	if transitionErr != nil {
		return errors.Join(cause, transitionErr)
	}
	if saveErr := u.jobs.Save(ctx, failed); saveErr != nil {
		return errors.Join(cause, fmt.Errorf("saving failed narration: %w", saveErr))
	}
	return cause
}

func voiceFor(locale string) string {
	if locale == "fr" {
		return "Florian"
	}
	return "Amy"
}
