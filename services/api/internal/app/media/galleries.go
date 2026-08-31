package media

import (
	"context"
	"errors"

	"github.com/kurasikapa/api/internal/domain/identity"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var (
	ErrGalleryAssetNotReady   = errors.New("gallery asset is not ready or has the wrong kind")
	ErrGalleryCaptionNotReady = errors.New("gallery caption asset is not ready captions")
)

type CreateGallery struct{ deps Deps }

func NewCreateGallery(deps Deps) CreateGallery { return CreateGallery{deps: deps} }
func (u CreateGallery) Execute(ctx context.Context, actor identity.Actor, input domainmedia.GalleryState) (domainmedia.Gallery, error) {
	input.ID = shared.GalleryID(u.deps.IDs.NewID())
	gallery, err := domainmedia.NewGallery(actor, input)
	if err != nil {
		return domainmedia.Gallery{}, err
	}
	return gallery, u.deps.Galleries.Save(ctx, gallery)
}

type PublishGallery struct{ deps Deps }

func NewPublishGallery(deps Deps) PublishGallery { return PublishGallery{deps: deps} }
func (u PublishGallery) Execute(ctx context.Context, actor identity.Actor, id shared.GalleryID) (domainmedia.Gallery, error) {
	gallery, err := u.deps.Galleries.FindByID(ctx, id)
	if err != nil {
		return domainmedia.Gallery{}, err
	}
	if err = u.validateAssets(ctx, gallery.State()); err != nil {
		return domainmedia.Gallery{}, err
	}
	gallery, err = gallery.Publish(actor, u.deps.Clock.Now())
	if err != nil {
		return domainmedia.Gallery{}, err
	}
	return gallery, u.deps.Galleries.Save(ctx, gallery)
}
func (u PublishGallery) validateAssets(ctx context.Context, state domainmedia.GalleryState) error {
	want := domainmedia.AssetImage
	if state.Kind == domainmedia.GalleryVideo {
		want = domainmedia.AssetVideo
	}
	for _, item := range state.Items {
		asset, err := u.deps.Assets.FindByID(ctx, item.AssetID)
		if err != nil {
			return err
		}
		if asset.State().Kind != want || asset.State().Status != domainmedia.AssetReady {
			return ErrGalleryAssetNotReady
		}
		if state.Kind == domainmedia.GalleryVideo {
			if item.CaptionAssetID == nil {
				return ErrGalleryCaptionNotReady
			}
			caption, findErr := u.deps.Assets.FindByID(ctx, *item.CaptionAssetID)
			if findErr != nil {
				return findErr
			}
			if caption.State().Kind != domainmedia.AssetCaption || caption.State().Status != domainmedia.AssetReady {
				return ErrGalleryCaptionNotReady
			}
		}
	}
	return nil
}

type GalleryMedia struct {
	Item         domainmedia.GalleryItem
	Asset        domainmedia.Asset
	CaptionAsset *domainmedia.Asset
}
type GalleryLibraryItem struct {
	Gallery domainmedia.Gallery
	Media   []GalleryMedia
}
type ListGalleryLibrary struct{ deps Deps }

func NewListGalleryLibrary(deps Deps) ListGalleryLibrary { return ListGalleryLibrary{deps: deps} }
func (u ListGalleryLibrary) Execute(ctx context.Context, locale string, limit int) ([]GalleryLibraryItem, error) {
	galleries, err := u.deps.Galleries.ListPublished(ctx, locale, limit)
	if err != nil {
		return nil, err
	}
	out := make([]GalleryLibraryItem, 0, len(galleries))
	for _, gallery := range galleries {
		entry := GalleryLibraryItem{Gallery: gallery, Media: make([]GalleryMedia, 0, len(gallery.State().Items))}
		for _, item := range gallery.State().Items {
			asset, findErr := u.deps.Assets.FindByID(ctx, item.AssetID)
			if findErr != nil {
				return nil, findErr
			}
			media := GalleryMedia{Item: item, Asset: asset}
			if item.CaptionAssetID != nil {
				caption, captionErr := u.deps.Assets.FindByID(ctx, *item.CaptionAssetID)
				if captionErr != nil {
					return nil, captionErr
				}
				media.CaptionAsset = &caption
			}
			entry.Media = append(entry.Media, media)
		}
		out = append(out, entry)
	}
	return out, nil
}
