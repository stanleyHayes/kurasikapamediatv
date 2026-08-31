package media

import (
	"errors"
	"strings"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type GalleryKind string

const (
	GalleryPhoto GalleryKind = "photo"
	GalleryVideo GalleryKind = "video"
)

var (
	ErrInvalidGalleryKind  = errors.New("gallery kind must be photo or video")
	ErrEmptyGalleryTitle   = errors.New("gallery title cannot be empty")
	ErrEmptyGallerySummary = errors.New("gallery summary cannot be empty")
	ErrGalleryNeedsItems   = errors.New("gallery requires at least one item")
	ErrInvalidGalleryItem  = errors.New("gallery item requires an asset and caption")
	ErrVideoNeedsCaptions  = errors.New("video gallery items require caption assets")
)

type GalleryItem struct {
	AssetID        shared.AssetID
	CaptionAssetID *shared.AssetID
	Caption        string
	Credit         string
}

type GalleryState struct {
	ID                           shared.GalleryID
	Kind                         GalleryKind
	Title, Slug, Locale, Summary string
	Items                        []GalleryItem
	Published                    bool
	PublishedAt                  *time.Time
	CreatedBy                    shared.UserID
}

type Gallery struct{ state GalleryState }

func NewGallery(actor identity.Actor, state GalleryState) (Gallery, error) {
	if state.Kind != GalleryPhoto && state.Kind != GalleryVideo {
		return Gallery{}, ErrInvalidGalleryKind
	}
	if err := actor.Require(galleryPermission(state.Kind)); err != nil {
		return Gallery{}, err
	}
	state.Title, state.Summary = strings.TrimSpace(state.Title), strings.TrimSpace(state.Summary)
	if state.Title == "" {
		return Gallery{}, ErrEmptyGalleryTitle
	}
	if state.Summary == "" {
		return Gallery{}, ErrEmptyGallerySummary
	}
	state.Published, state.PublishedAt, state.CreatedBy = false, nil, actor.ID()
	state.Items = copyGalleryItems(state.Items)
	return Gallery{state: state}, nil
}

func ReconstituteGallery(state GalleryState) Gallery {
	state.Items = copyGalleryItems(state.Items)
	return Gallery{state: state}
}
func (g Gallery) ID() shared.GalleryID { return g.state.ID }
func (g Gallery) State() GalleryState {
	g.state.Items = copyGalleryItems(g.state.Items)
	return g.state
}
func (g Gallery) Publish(actor identity.Actor, at time.Time) (Gallery, error) {
	if err := actor.Require(galleryPermission(g.state.Kind)); err != nil {
		return Gallery{}, err
	}
	if len(g.state.Items) == 0 {
		return Gallery{}, ErrGalleryNeedsItems
	}
	for _, item := range g.state.Items {
		if item.AssetID == "" || strings.TrimSpace(item.Caption) == "" {
			return Gallery{}, ErrInvalidGalleryItem
		}
		if g.state.Kind == GalleryVideo && item.CaptionAssetID == nil {
			return Gallery{}, ErrVideoNeedsCaptions
		}
	}
	g.state.Published, g.state.PublishedAt = true, &at
	return g, nil
}
func galleryPermission(kind GalleryKind) identity.Permission {
	if kind == GalleryPhoto {
		return identity.PermAssetUploadImage
	}
	return identity.PermAssetUploadVideo
}
func copyGalleryItems(items []GalleryItem) []GalleryItem {
	return append([]GalleryItem(nil), items...)
}
