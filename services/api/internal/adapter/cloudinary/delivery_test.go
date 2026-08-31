package cloudinary_test

import (
	"testing"

	adapter "github.com/kurasikapa/api/internal/adapter/cloudinary"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
)

func TestDeliveryProjectsAdaptiveCloudinaryVideo(t *testing.T) {
	asset := domainmedia.ReconstituteAsset(domainmedia.AssetState{
		Kind: domainmedia.AssetVideo, MIMEType: "video/mp4",
		SecureURL: "https://res.cloudinary.com/demo/video/upload/v42/news/dispatch.mp4",
	})
	delivery := adapter.NewDelivery().Project(asset)
	if delivery.PlaybackURL != "https://res.cloudinary.com/demo/video/upload/sp_auto/v42/news/dispatch.m3u8" {
		t.Fatalf("playback: %s", delivery.PlaybackURL)
	}
	if delivery.PosterURL != "https://res.cloudinary.com/demo/video/upload/so_0,f_jpg,q_auto/v42/news/dispatch.jpg" {
		t.Fatalf("poster: %s", delivery.PosterURL)
	}
	if delivery.MIMEType != "application/vnd.apple.mpegurl" {
		t.Fatalf("mime: %s", delivery.MIMEType)
	}
}

func TestDeliveryPreservesNonCloudinaryAndNonVideoAssets(t *testing.T) {
	projector := adapter.NewDelivery()
	for _, state := range []domainmedia.AssetState{
		{Kind: domainmedia.AssetVideo, MIMEType: "video/mp4", SecureURL: "https://cdn.test/report.mp4"},
		{Kind: domainmedia.AssetImage, MIMEType: "image/jpeg", SecureURL: "https://res.cloudinary.com/demo/image/upload/report.jpg"},
	} {
		delivery := projector.Project(domainmedia.ReconstituteAsset(state))
		if delivery.PlaybackURL != state.SecureURL || delivery.MIMEType != state.MIMEType || delivery.PosterURL != "" {
			t.Fatalf("fallback: %+v", delivery)
		}
	}
}
