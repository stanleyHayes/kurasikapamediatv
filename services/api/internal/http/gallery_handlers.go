package http

import (
	"net/http"

	appmedia "github.com/kurasikapa/api/internal/app/media"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type galleryRequest struct {
	Kind                         domainmedia.GalleryKind
	Title, Slug, Locale, Summary string
	Items                        []domainmedia.GalleryItem
}

func (d Deps) handleCreateGallery(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input galleryRequest
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	gallery, err := d.CreateGallery.Execute(r.Context(), actor, domainmedia.GalleryState{Kind: input.Kind, Title: input.Title, Slug: input.Slug, Locale: input.Locale, Summary: input.Summary, Items: input.Items})
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, galleryView(gallery))
}
func (d Deps) handlePublishGallery(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	gallery, err := d.PublishGallery.Execute(r.Context(), actor, shared.GalleryID(r.PathValue("id")))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, galleryView(gallery))
}
func (d Deps) handleGalleryLibrary(w http.ResponseWriter, r *http.Request) {
	library, err := d.ListGalleryLibrary.Execute(r.Context(), r.PathValue("locale"), 50)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	items := make([]any, len(library))
	for i, entry := range library {
		media := make([]any, len(entry.Media))
		for j, item := range entry.Media {
			media[j] = galleryMediaView(item)
		}
		view := galleryView(entry.Gallery)
		view["media"] = media
		items[i] = view
	}
	writeJSON(w, d.Log, http.StatusOK, map[string]any{"items": items})
}
func galleryView(gallery domainmedia.Gallery) map[string]any {
	s := gallery.State()
	return map[string]any{"id": s.ID.String(), "kind": s.Kind, "title": s.Title, "slug": s.Slug, "locale": s.Locale, "summary": s.Summary, "items": s.Items, "published": s.Published, "publishedAt": s.PublishedAt}
}
func galleryMediaView(item appmedia.GalleryMedia) map[string]any {
	view := map[string]any{"assetId": item.Item.AssetID.String(), "url": item.Asset.State().SecureURL, "mimeType": item.Asset.State().MIMEType, "altText": item.Asset.State().AltText, "caption": item.Item.Caption, "credit": item.Item.Credit}
	if item.Delivery.PlaybackURL != "" {
		view["url"], view["mimeType"] = item.Delivery.PlaybackURL, item.Delivery.MIMEType
		view["posterUrl"] = item.Delivery.PosterURL
	}
	if item.CaptionAsset != nil {
		view["captionUrl"] = item.CaptionAsset.State().SecureURL
	}
	return view
}
