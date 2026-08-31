package media_test

import (
	"errors"
	"testing"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
)

func TestAssetUploadLifecycle(t *testing.T) {
	state := media.AssetState{ID: "asset", Kind: media.AssetVideo, Filename: "report.mp4", MIMEType: "video/mp4", Locale: "en"}
	asset, err := media.NewAsset(manager(), state)
	if err != nil || asset.State().Status != media.AssetPending {
		t.Fatal(err)
	}
	if asset.ID() != "asset" || asset.RequiredPermission() != identity.PermAssetUploadVideo {
		t.Fatal(asset.State())
	}
	asset, err = asset.MarkReady(manager(), media.AssetDelivery{ProviderID: "kurasikapa/asset", SecureURL: "https://res.cloudinary.com/demo/image/upload/asset.jpg", Bytes: 2048, Width: 1200, Height: 800})
	if err != nil || asset.State().Status != media.AssetReady {
		t.Fatal(err)
	}
	if _, err = asset.MarkReady(manager(), media.AssetDelivery{}); !errors.Is(err, media.ErrAssetAlreadyFinal) {
		t.Fatal(err)
	}
	if media.ReconstituteAsset(asset.State()).ID() != asset.ID() {
		t.Fatal("reconstitution failed")
	}
}

func TestImageRequiresAlternativeText(t *testing.T) {
	editor := identity.NewActor("editor", []identity.Role{identity.RoleEditor})
	_, err := media.NewAsset(editor, media.AssetState{ID: "asset", Kind: media.AssetImage, Filename: "photo.jpg", MIMEType: "image/jpeg"})
	if !errors.Is(err, media.ErrImageNeedsAltText) {
		t.Fatal(err)
	}
}

func TestAssetPermissionsAndValidation(t *testing.T) {
	state := media.AssetState{ID: "asset", Kind: media.AssetVideo, Filename: "report.mp4", MIMEType: "video/mp4"}
	if _, err := media.NewAsset(guest(), state); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	state.Kind = media.AssetKind("unknown")
	if _, err := media.NewAsset(manager(), state); !errors.Is(err, media.ErrInvalidAssetKind) {
		t.Fatal(err)
	}
	state.Kind, state.Filename = media.AssetVideo, " "
	if _, err := media.NewAsset(manager(), state); !errors.Is(err, media.ErrEmptyAssetFilename) {
		t.Fatal(err)
	}
}

func TestFailedAssetCannotBecomeReady(t *testing.T) {
	asset, err := media.NewAsset(manager(), media.AssetState{ID: "asset", Kind: media.AssetAudio, Filename: "bulletin.mp3", MIMEType: "audio/mpeg"})
	if err != nil {
		t.Fatal(err)
	}
	asset, err = asset.MarkFailed(manager(), "provider rejected upload")
	if err != nil || asset.State().FailureReason == "" {
		t.Fatal(err)
	}
	if _, err = asset.MarkFailed(manager(), "again"); !errors.Is(err, media.ErrAssetAlreadyFinal) {
		t.Fatal(err)
	}
}
