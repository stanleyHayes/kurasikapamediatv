package editorial

import (
	"context"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type GetLatestArticleNarration struct {
	deps Deps
	jobs ports.NarrationJobRepository
}

func NewGetLatestArticleNarration(deps Deps, jobs ports.NarrationJobRepository) GetLatestArticleNarration {
	return GetLatestArticleNarration{deps: deps, jobs: jobs}
}

func (u GetLatestArticleNarration) Execute(ctx context.Context, actor identity.Actor, articleID shared.ArticleID) (NarrationJobView, error) {
	article, err := u.deps.Articles.FindByID(ctx, articleID)
	if err != nil {
		return NarrationJobView{}, err
	}
	if err = article.AssertReadable(actor); err != nil {
		return NarrationJobView{}, err
	}
	job, err := u.jobs.FindLatestForArticle(ctx, articleID)
	if err != nil {
		return NarrationJobView{}, err
	}
	view := narrationJobView(job)
	state := job.State()
	if state.AssetID == nil {
		return view, nil
	}
	asset, err := u.deps.Assets.FindByID(ctx, *state.AssetID)
	if err != nil {
		return NarrationJobView{}, err
	}
	return narrationJobPreview(view, asset), nil
}
