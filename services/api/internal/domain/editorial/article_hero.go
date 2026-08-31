package editorial

import (
	"errors"
	"net/url"
	"strings"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

// ErrInvalidArticleHero means the selected image cannot be published with the
// accessibility and provenance a news photograph requires.
var ErrInvalidArticleHero = errors.New("article hero media is incomplete")

// ArticleHero is the approved delivery snapshot attached to a story.
//
// The CDN URL and metadata are copied from the verified media asset when the
// editor attaches it. Reader lists can then render one article in one query,
// while AssetID preserves provenance back to the newsroom library.
type ArticleHero struct {
	AssetID       shared.AssetID
	SecureURL     string
	AltText       string
	Caption       string
	Credit        string
	Width, Height int
}

// SetHero changes the lead visual only while direct story edits are allowed.
func (a Article) SetHero(hero ArticleHero, actor identity.Actor) (Article, error) {
	if err := a.guardEditable(actor); err != nil {
		return Article{}, err
	}
	if !validHero(hero) {
		return Article{}, ErrInvalidArticleHero
	}

	next := a
	next.hero = &hero

	return next, nil
}

// Hero returns the selected lead visual, if the editor has attached one.
func (a Article) Hero() (ArticleHero, bool) {
	if a.hero == nil {
		return ArticleHero{}, false
	}

	return *a.hero, true
}

func validHero(hero ArticleHero) bool {
	parsed, err := url.ParseRequestURI(strings.TrimSpace(hero.SecureURL))
	return hero.AssetID != "" && err == nil && parsed.Scheme == "https" &&
		strings.TrimSpace(hero.AltText) != "" && strings.TrimSpace(hero.Credit) != "" &&
		hero.Width > 0 && hero.Height > 0
}
