package media_test

import (
	"context"
	"errors"
	"testing"

	appmedia "github.com/kurasikapa/api/internal/app/media"
	"github.com/kurasikapa/api/internal/app/ports"
	fakes "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
)

func TestVideoGalleryPublishingAndPublicLibrary(t *testing.T) {
	d, _, _, _ := deps()
	d.Galleries, d.Assets = fakes.NewGalleryStore(), fakes.NewAssetStore()
	video := readyAsset(t, actor(), "video", domainmedia.AssetVideo)
	caption := readyAsset(t, actor(), "caption", domainmedia.AssetCaption)
	if err := d.Assets.Save(context.Background(), video); err != nil {
		t.Fatal(err)
	}
	if err := d.Assets.Save(context.Background(), caption); err != nil {
		t.Fatal(err)
	}
	videoID, captionID := video.ID(), caption.ID()
	gallery, err := appmedia.NewCreateGallery(d).Execute(context.Background(), actor(), domainmedia.GalleryState{Kind: domainmedia.GalleryVideo, Title: "Accra dispatch", Summary: "Original field reporting", Locale: "en", Items: []domainmedia.GalleryItem{{AssetID: videoID, CaptionAssetID: &captionID, Caption: "Reporting from central Accra", Credit: "Kurasikapa Newsroom"}}})
	if err != nil {
		t.Fatal(err)
	}
	gallery, err = appmedia.NewPublishGallery(d).Execute(context.Background(), actor(), gallery.ID())
	if err != nil || !gallery.State().Published {
		t.Fatal(err)
	}
	library, err := appmedia.NewListGalleryLibrary(d).Execute(context.Background(), "en", 20)
	if err != nil || len(library) != 1 || len(library[0].Media) != 1 || library[0].Media[0].CaptionAsset == nil {
		t.Fatalf("%+v %v", library, err)
	}
}

func TestGalleryPublishingRejectsMissingAndWrongAssets(t *testing.T) {
	d, _, _, _ := deps()
	d.Galleries, d.Assets = fakes.NewGalleryStore(), fakes.NewAssetStore()
	captionID := domainmedia.AssetState{ID: "caption"}.ID
	gallery, err := appmedia.NewCreateGallery(d).Execute(context.Background(), actor(), domainmedia.GalleryState{Kind: domainmedia.GalleryVideo, Title: "Dispatch", Summary: "Field report", Items: []domainmedia.GalleryItem{{AssetID: "missing", CaptionAssetID: &captionID, Caption: "Context"}}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = appmedia.NewPublishGallery(d).Execute(context.Background(), actor(), gallery.ID()); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal(err)
	}
	wrong := readyAsset(t, actor(), "missing", domainmedia.AssetAudio)
	if err = d.Assets.Save(context.Background(), wrong); err != nil {
		t.Fatal(err)
	}
	if _, err = appmedia.NewPublishGallery(d).Execute(context.Background(), actor(), gallery.ID()); !errors.Is(err, appmedia.ErrGalleryAssetNotReady) {
		t.Fatal(err)
	}
	video := readyAsset(t, actor(), "missing", domainmedia.AssetVideo)
	if err = d.Assets.Save(context.Background(), video); err != nil {
		t.Fatal(err)
	}
	if _, err = appmedia.NewPublishGallery(d).Execute(context.Background(), actor(), gallery.ID()); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal(err)
	}
	wrongCaption := readyAsset(t, actor(), captionID, domainmedia.AssetVideo)
	if err = d.Assets.Save(context.Background(), wrongCaption); err != nil {
		t.Fatal(err)
	}
	if _, err = appmedia.NewPublishGallery(d).Execute(context.Background(), actor(), gallery.ID()); !errors.Is(err, appmedia.ErrGalleryCaptionNotReady) {
		t.Fatal(err)
	}
}

func TestPhotoGalleryLibraryAndRepositoryFailures(t *testing.T) {
	d, _, _, _ := deps()
	galleries, assets := fakes.NewGalleryStore(), fakes.NewAssetStore()
	d.Galleries, d.Assets = galleries, assets
	photo := domainmedia.ReconstituteAsset(domainmedia.AssetState{ID: "photo", Kind: domainmedia.AssetImage, Status: domainmedia.AssetReady, SecureURL: "https://cdn.test/photo.jpg"})
	if err := assets.Save(context.Background(), photo); err != nil {
		t.Fatal(err)
	}
	photographer := identity.NewActor("photo", []identity.Role{identity.RolePhotographer})
	gallery, err := appmedia.NewCreateGallery(d).Execute(context.Background(), photographer, domainmedia.GalleryState{Kind: domainmedia.GalleryPhoto, Title: "Market day", Summary: "A visual report from the market", Locale: "en", Items: []domainmedia.GalleryItem{{AssetID: photo.ID(), Caption: "Traders prepare for the day"}}})
	if err != nil {
		t.Fatal(err)
	}
	gallery, err = appmedia.NewPublishGallery(d).Execute(context.Background(), photographer, gallery.ID())
	if err != nil || !gallery.State().Published {
		t.Fatal(err)
	}
	library, err := appmedia.NewListGalleryLibrary(d).Execute(context.Background(), "en", 10)
	if err != nil || len(library) != 1 || library[0].Media[0].CaptionAsset != nil {
		t.Fatalf("%+v %v", library, err)
	}
	sentinel := errors.New("gallery store unavailable")
	galleries.Err = sentinel
	if _, err = appmedia.NewCreateGallery(d).Execute(context.Background(), photographer, domainmedia.GalleryState{Kind: domainmedia.GalleryPhoto, Title: "Other", Summary: "Another visual report"}); !errors.Is(err, sentinel) {
		t.Fatal(err)
	}
	if _, err = appmedia.NewPublishGallery(d).Execute(context.Background(), photographer, "missing"); !errors.Is(err, sentinel) {
		t.Fatal(err)
	}
	if _, err = appmedia.NewListGalleryLibrary(d).Execute(context.Background(), "en", 10); !errors.Is(err, sentinel) {
		t.Fatal(err)
	}
}
