package cloudinary_test

import (
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"testing"
	"time"

	adapter "github.com/kurasikapa/api/internal/adapter/cloudinary"
	"github.com/kurasikapa/api/internal/app/ports"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
)

func TestSignerCreatesScopedDirectUploadTickets(t *testing.T) {
	signer := adapter.NewSigner("demo", "key", "secret", "kurasikapa/media")
	for kind, resource := range map[domainmedia.AssetKind]string{domainmedia.AssetImage: "image", domainmedia.AssetVideo: "video", domainmedia.AssetAudio: "video", domainmedia.AssetCaption: "raw"} {
		ticket, err := signer.SignUpload(ports.UploadRequest{AssetID: "asset_1", Kind: kind, Timestamp: time.Unix(1_700_000_000, 0)})
		if err != nil || ticket.ResourceType != resource || ticket.Signature == "" || ticket.PublicID != "asset_1" || ticket.Timestamp != 1_700_000_000 {
			t.Fatalf("%s: %+v %v", kind, ticket, err)
		}
	}
}
func TestSignerFailsClosedWhenUnconfigured(t *testing.T) {
	signer := adapter.NewSigner("", "", "", "")
	if _, err := signer.SignUpload(ports.UploadRequest{}); !errors.Is(err, adapter.ErrNotConfigured) {
		t.Fatal(err)
	}
	if err := signer.VerifyUpload(ports.UploadReceipt{}); !errors.Is(err, adapter.ErrNotConfigured) {
		t.Fatal(err)
	}
}
func TestSignerVerifiesProviderReceipt(t *testing.T) {
	signer := adapter.NewSigner("demo", "key", "secret", "kurasikapa")
	digest := sha1.Sum([]byte("public_id=kurasikapa/asset_1&version=42secret"))
	receipt := ports.UploadReceipt{PublicID: "kurasikapa/asset_1", SecureURL: "https://res.cloudinary.com/demo/video/upload/v42/asset.mp4", Version: 42, Bytes: 2048, Signature: hex.EncodeToString(digest[:])}
	if err := signer.VerifyUpload(receipt); err != nil {
		t.Fatal(err)
	}
	receipt.Signature = "bad"
	if err := signer.VerifyUpload(receipt); !errors.Is(err, adapter.ErrInvalidReceipt) {
		t.Fatal(err)
	}
}
