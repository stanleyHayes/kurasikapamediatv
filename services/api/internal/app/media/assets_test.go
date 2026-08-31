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

func TestSignedAssetUploadWorkflow(t *testing.T) {
	d, _, _, _ := deps()
	assets := fakes.NewAssetStore()
	uploads := &fakes.MediaUploadFake{Ticket: ports.UploadTicket{URL: "https://api.cloudinary.test/upload", Signature: "signed"}}
	created, err := appmedia.NewCreateAssetUpload(d, assets, uploads).Execute(context.Background(), actor(), domainmedia.AssetState{Kind: domainmedia.AssetVideo, Filename: "report.mp4", MIMEType: "video/mp4", Locale: "en"})
	if err != nil || created.Asset.ID() != "id_1" || created.Ticket.Signature != "signed" {
		t.Fatal(err)
	}
	receipt := ports.UploadReceipt{PublicID: "kurasikapa/id_1", SecureURL: "https://res.cloudinary.test/video.mp4", Signature: "verified", Version: 2, Bytes: 4096}
	completed, err := appmedia.NewCompleteAssetUpload(assets, uploads).Execute(context.Background(), actor(), created.Asset.ID(), receipt)
	if err != nil || completed.State().Status != domainmedia.AssetReady || uploads.LastReceipt.PublicID == "" {
		t.Fatal(err)
	}
	listed, err := appmedia.NewListAssets(assets).Execute(context.Background(), actor(), "en", 20)
	if err != nil || len(listed) != 1 {
		t.Fatal(err)
	}
}

func TestAssetUseCasesFailClosed(t *testing.T) {
	d, _, _, _ := deps()
	assets := fakes.NewAssetStore()
	uploads := &fakes.MediaUploadFake{SignErr: errors.New("not configured")}
	if _, err := appmedia.NewCreateAssetUpload(d, assets, uploads).Execute(context.Background(), actor(), domainmedia.AssetState{Kind: domainmedia.AssetVideo, Filename: "report.mp4"}); err == nil {
		t.Fatal("expected signer failure")
	}
	uploads.SignErr = nil
	uploads.Ticket = ports.UploadTicket{Signature: "ok"}
	created, err := appmedia.NewCreateAssetUpload(d, assets, uploads).Execute(context.Background(), actor(), domainmedia.AssetState{Kind: domainmedia.AssetVideo, Filename: "report.mp4"})
	if err != nil {
		t.Fatal(err)
	}
	uploads.VerifyErr = errors.New("bad receipt")
	if _, err = appmedia.NewCompleteAssetUpload(assets, uploads).Execute(context.Background(), actor(), created.Asset.ID(), ports.UploadReceipt{}); err == nil {
		t.Fatal("expected verification failure")
	}
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err = appmedia.NewListAssets(assets).Execute(context.Background(), guest, "en", 20); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
}

func TestAssetUseCasesPropagateRepositoryAndDeliveryFailures(t *testing.T) {
	d, _, _, _ := deps()
	storageFailure := errors.New("storage unavailable")
	assets := fakes.NewAssetStore()
	uploads := &fakes.MediaUploadFake{Ticket: ports.UploadTicket{Signature: "ok"}}

	assets.Err = storageFailure
	if _, err := appmedia.NewCreateAssetUpload(d, assets, uploads).Execute(context.Background(), actor(), domainmedia.AssetState{Kind: domainmedia.AssetVideo, Filename: "report.mp4"}); !errors.Is(err, storageFailure) {
		t.Fatalf("create save: %v", err)
	}
	if _, err := appmedia.NewListAssets(assets).Execute(context.Background(), actor(), "en", 20); !errors.Is(err, storageFailure) {
		t.Fatalf("list: %v", err)
	}

	assets.Err = nil
	complete := appmedia.NewCompleteAssetUpload(assets, uploads)
	if _, err := complete.Execute(context.Background(), actor(), "missing", ports.UploadReceipt{}); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("find: %v", err)
	}
	created, err := appmedia.NewCreateAssetUpload(d, assets, uploads).Execute(context.Background(), actor(), domainmedia.AssetState{Kind: domainmedia.AssetVideo, Filename: "report.mp4"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = complete.Execute(context.Background(), actor(), created.Asset.ID(), ports.UploadReceipt{PublicID: "provider", SecureURL: "https://example.test/report.mp4"}); !errors.Is(err, domainmedia.ErrInvalidAssetDelivery) {
		t.Fatalf("delivery: %v", err)
	}
}
