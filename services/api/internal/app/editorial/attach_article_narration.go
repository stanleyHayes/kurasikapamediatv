package editorial

import (
	"context"
	"errors"

	"github.com/kurasikapa/api/internal/app/ports"
	domaineditorial "github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var ErrNarrationJobNotUsable = errors.New("narration job is not ready for this article")

type AttachArticleNarration struct {
	deps Deps
	jobs ports.NarrationJobRepository
}

func NewAttachArticleNarration(deps Deps, jobs ports.NarrationJobRepository) AttachArticleNarration {
	return AttachArticleNarration{deps: deps, jobs: jobs}
}

func (u AttachArticleNarration) Execute(
	ctx context.Context,
	actor identity.Actor,
	articleID shared.ArticleID,
	jobID shared.NarrationJobID,
) (ArticleNarrationView, error) {
	if err := actor.Require(identity.PermArticlePublish); err != nil {
		return ArticleNarrationView{}, err
	}
	article, err := u.deps.Articles.FindByID(ctx, articleID)
	if err != nil {
		return ArticleNarrationView{}, err
	}
	job, err := u.jobs.FindByID(ctx, jobID)
	if err != nil {
		return ArticleNarrationView{}, err
	}
	state := job.State()
	if state.ArticleID != article.ID() || state.Status != media.NarrationReady || state.AssetID == nil {
		return ArticleNarrationView{}, ErrNarrationJobNotUsable
	}
	asset, err := u.deps.Assets.FindByID(ctx, *state.AssetID)
	if err != nil {
		return ArticleNarrationView{}, err
	}
	assetState := asset.State()
	if assetState.Status != media.AssetReady || assetState.Kind != media.AssetAudio || assetState.Locale != article.Locale() {
		return ArticleNarrationView{}, ErrNarrationJobNotUsable
	}
	narration := domaineditorial.ArticleNarration{
		AssetID: asset.ID(), SourceRevisionID: state.RevisionID, SecureURL: assetState.SecureURL,
		MIMEType: assetState.MIMEType, DurationSeconds: assetState.DurationSeconds, Voice: state.Voice,
	}
	article, err = article.SetNarration(narration, actor)
	if err != nil {
		return ArticleNarrationView{}, err
	}
	if err = u.deps.Articles.Save(ctx, article); err != nil {
		return ArticleNarrationView{}, err
	}
	return *narrationViewOf(article), nil
}
