package editorial

import "github.com/kurasikapa/api/internal/domain/editorial"

// ArticleHeroView is safe to expose to Studio and readers.
type ArticleHeroView struct {
	AssetID   string `json:"assetId"`
	SecureURL string `json:"secureUrl"`
	AltText   string `json:"altText"`
	Caption   string `json:"caption"`
	Credit    string `json:"credit"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
}

func heroView(hero editorial.ArticleHero) ArticleHeroView {
	return ArticleHeroView{
		AssetID: hero.AssetID.String(), SecureURL: hero.SecureURL, AltText: hero.AltText,
		Caption: hero.Caption, Credit: hero.Credit, Width: hero.Width, Height: hero.Height,
	}
}

func heroViewOf(article editorial.Article) *ArticleHeroView {
	hero, ok := article.Hero()
	if !ok {
		return nil
	}
	view := heroView(hero)

	return &view
}
