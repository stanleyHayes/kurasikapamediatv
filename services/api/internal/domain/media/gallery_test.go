package media_test

import (
	"errors"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestGalleryPublicationRequiresEditorialContext(t *testing.T) {
	photographer := identity.NewActor("photo", []identity.Role{identity.RolePhotographer})
	if _, err := media.NewGallery(photographer, media.GalleryState{Kind: "other", Title: "Title", Summary: "Summary"}); !errors.Is(err, media.ErrInvalidGalleryKind) {
		t.Fatal(err)
	}
	if _, err := media.NewGallery(photographer, media.GalleryState{Kind: media.GalleryPhoto, Title: " ", Summary: "Summary"}); !errors.Is(err, media.ErrEmptyGalleryTitle) {
		t.Fatal(err)
	}
	if _, err := media.NewGallery(photographer, media.GalleryState{Kind: media.GalleryPhoto, Title: "Title", Summary: " "}); !errors.Is(err, media.ErrEmptyGallerySummary) {
		t.Fatal(err)
	}
	gallery, err := media.NewGallery(photographer, media.GalleryState{ID: "gallery", Kind: media.GalleryPhoto, Title: " Accra in motion ", Summary: " A visual dispatch "})
	if err != nil || gallery.ID() != "gallery" || gallery.State().CreatedBy != "photo" {
		t.Fatal(err)
	}
	if _, err = gallery.Publish(photographer, time.Now()); !errors.Is(err, media.ErrGalleryNeedsItems) {
		t.Fatal(err)
	}
	state := gallery.State()
	state.Items = []media.GalleryItem{{AssetID: "image", Caption: " "}}
	gallery = media.ReconstituteGallery(state)
	if _, err = gallery.Publish(photographer, time.Now()); !errors.Is(err, media.ErrInvalidGalleryItem) {
		t.Fatal(err)
	}
}

func TestVideoGalleryRequiresSynchronizedCaptions(t *testing.T) {
	editor := identity.NewActor("video", []identity.Role{identity.RoleVideoEditor})
	gallery, err := media.NewGallery(editor, media.GalleryState{Kind: media.GalleryVideo, Title: "Field reports", Summary: "Original video journalism", Items: []media.GalleryItem{{AssetID: "video", Caption: "Report from the field"}}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = gallery.Publish(editor, time.Now()); !errors.Is(err, media.ErrVideoNeedsCaptions) {
		t.Fatal(err)
	}
	caption := shared.AssetID("captions")
	state := gallery.State()
	state.Items[0].CaptionAssetID = &caption
	gallery = media.ReconstituteGallery(state)
	published, err := gallery.Publish(editor, time.Date(2026, 8, 31, 15, 0, 0, 0, time.UTC))
	if err != nil || !published.State().Published || published.State().PublishedAt == nil {
		t.Fatal(err)
	}
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err = published.Publish(guest, time.Now()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
}
