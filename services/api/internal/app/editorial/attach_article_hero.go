package editorial

import (
	"context"
	"errors"

	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

// ErrHeroAssetNotUsable keeps pending, failed, wrong-locale and non-image
// assets out of reader-facing journalism.
var ErrHeroAssetNotUsable = errors.New("hero asset is not a ready image for this article")

// AttachArticleHeroInput names the verified image and its story-specific copy.
type AttachArticleHeroInput struct {
	Actor     identity.Actor
	ArticleID shared.ArticleID
	AssetID   shared.AssetID
	Caption   string
	Credit    string
}

// AttachArticleHero selects a verified media-library image for one story.
type AttachArticleHero struct{ deps Deps }

// NewAttachArticleHero wires the use case.
func NewAttachArticleHero(deps Deps) AttachArticleHero { return AttachArticleHero{deps: deps} }

// Execute validates the media record before the aggregate accepts its snapshot.
func (u AttachArticleHero) Execute(ctx context.Context, input AttachArticleHeroInput) (ArticleHeroView, error) {
	article, err := u.deps.Articles.FindByID(ctx, input.ArticleID)
	if err != nil {
		return ArticleHeroView{}, err
	}
	asset, err := u.deps.Assets.FindByID(ctx, input.AssetID)
	if err != nil {
		return ArticleHeroView{}, err
	}
	state := asset.State()
	if state.Kind != media.AssetImage || state.Status != media.AssetReady ||
		(state.Locale != "" && state.Locale != article.Locale()) {
		return ArticleHeroView{}, ErrHeroAssetNotUsable
	}

	hero := editorial.ArticleHero{
		AssetID: asset.ID(), SecureURL: state.SecureURL, AltText: state.AltText,
		Caption: input.Caption, Credit: input.Credit, Width: state.Width, Height: state.Height,
	}
	updated, err := article.SetHero(hero, input.Actor)
	if err != nil {
		return ArticleHeroView{}, err
	}
	if err := u.deps.Articles.Save(ctx, updated); err != nil {
		return ArticleHeroView{}, err
	}

	return heroView(hero), nil
}
