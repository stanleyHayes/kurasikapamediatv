package media_test

import (
	"context"
	"errors"
	"testing"
	"time"

	appmedia "github.com/kurasikapa/api/internal/app/media"
	"github.com/kurasikapa/api/internal/app/ports"
	fakes "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func replayAsset(id shared.AssetID, kind domainmedia.AssetKind, url string) domainmedia.Asset {
	mime := "video/mp4"
	if kind == domainmedia.AssetCaption {
		mime = "text/vtt"
	}
	return domainmedia.ReconstituteAsset(domainmedia.AssetState{
		ID: id, Kind: kind, MIMEType: mime, Locale: "en", Status: domainmedia.AssetReady,
		SecureURL: url, ProviderID: id.String(), Bytes: 1200,
	})
}

func replayDeps() (appmedia.Deps, *fakes.ScheduleStore, *fakes.AssetStore) {
	slot := domainmedia.ReconstituteScheduleSlot(domainmedia.ScheduleSlotState{
		ID: "slot", ProgrammeID: "programme", Locale: "en",
		StartsAt: now.Add(-2 * time.Hour), EndsAt: now.Add(-time.Hour),
		IsLive: true, State: domainmedia.ScheduleScheduled, CreatedBy: "manager",
	})
	schedule := fakes.NewScheduleStore(slot)
	assets := fakes.NewAssetStore(
		replayAsset("video", domainmedia.AssetVideo, "https://cdn.test/report.mp4"),
		replayAsset("captions", domainmedia.AssetCaption, "https://cdn.test/report.vtt"),
	)
	return appmedia.Deps{Schedule: schedule, Assets: assets, Clock: fakes.FixedClock{At: now}}, schedule, assets
}

func TestPublishReplayValidatesAssetsAndCompletesSlot(t *testing.T) {
	d, schedule, _ := replayDeps()
	result, err := appmedia.NewPublishReplay(d).Execute(context.Background(), actor(), appmedia.PublishReplayInput{
		SlotID: "slot", ReplayAssetID: "video", CaptionAssetID: "captions",
	})
	if err != nil || result.State().State != domainmedia.ScheduleCompleted {
		t.Fatalf("%+v %v", result.State(), err)
	}
	if schedule.Items["slot"].State().ReplayAssetID == nil {
		t.Fatal("completed replay was not persisted")
	}
}

func TestPublishReplayRejectsWrongOrUnreadyAssets(t *testing.T) {
	d, _, assets := replayDeps()
	assets.Items["video"] = replayAsset("video", domainmedia.AssetAudio, "https://cdn.test/report.mp3")
	u := appmedia.NewPublishReplay(d)
	input := appmedia.PublishReplayInput{SlotID: "slot", ReplayAssetID: "video", CaptionAssetID: "captions"}
	if _, err := u.Execute(context.Background(), actor(), input); !errors.Is(err, appmedia.ErrReplayNeedsReadyVideo) {
		t.Fatal(err)
	}
	assets.Items["video"] = replayAsset("video", domainmedia.AssetVideo, "https://cdn.test/report.mp4")
	assets.Items["captions"] = domainmedia.ReconstituteAsset(domainmedia.AssetState{ID: "captions", Kind: domainmedia.AssetCaption, Status: domainmedia.AssetPending})
	if _, err := u.Execute(context.Background(), actor(), input); !errors.Is(err, appmedia.ErrReplayNeedsReadyCaptions) {
		t.Fatal(err)
	}
	assets.Items["captions"] = replayAsset("captions", domainmedia.AssetCaption, "https://cdn.test/report.vtt")
	bad := assets.Items["captions"].State()
	bad.MIMEType = "application/octet-stream"
	assets.Items["captions"] = domainmedia.ReconstituteAsset(bad)
	if _, err := u.Execute(context.Background(), actor(), input); !errors.Is(err, appmedia.ErrReplayCaptionsMustBeVTT) {
		t.Fatal(err)
	}
}

func TestPublishReplayPropagatesLookupAndPermissionFailures(t *testing.T) {
	d, _, assets := replayDeps()
	u := appmedia.NewPublishReplay(d)
	input := appmedia.PublishReplayInput{SlotID: "missing", ReplayAssetID: "video", CaptionAssetID: "captions"}
	if _, err := u.Execute(context.Background(), actor(), input); err == nil {
		t.Fatal("expected missing slot")
	}
	input.SlotID = "slot"
	if _, err := u.Execute(context.Background(), identity.NewActor("guest", []identity.Role{identity.RoleGuest}), input); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	assets.Err = errors.New("asset store down")
	if _, err := u.Execute(context.Background(), actor(), input); err == nil {
		t.Fatal("expected asset failure")
	}
}

func TestReplayCandidatesAndPublicDelivery(t *testing.T) {
	d, schedule, assets := replayDeps()
	presenter := domainmedia.ReconstitutePresenter(domainmedia.PresenterState{ID: "presenter", Name: "Ama", Locale: "en", Published: true})
	programme := domainmedia.ReconstituteProgramme(domainmedia.ProgrammeState{ID: "programme", Title: "Morning", Locale: "en", Published: true, PresenterIDs: []shared.PresenterID{"presenter"}})
	d.Presenters = fakes.NewPresenterStore(presenter)
	programmes := fakes.NewProgrammeStore(programme)
	d.Programmes = programmes
	candidates, err := appmedia.NewListReplayCandidates(d).Execute(context.Background(), actor(), "en")
	if err != nil || len(candidates) != 1 || candidates[0].Programme.ID() != programme.ID() {
		t.Fatalf("%+v %v", candidates, err)
	}
	if _, err = appmedia.NewListReplayCandidates(d).Execute(context.Background(), identity.NewActor("guest", []identity.Role{identity.RoleGuest}), "en"); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	schedule.Err = errors.New("schedule down")
	if _, err = appmedia.NewListReplayCandidates(d).Execute(context.Background(), actor(), "en"); err == nil {
		t.Fatal("expected schedule failure")
	}
	schedule.Err = nil
	programmes.Err = errors.New("programme down")
	if _, err = appmedia.NewListReplayCandidates(d).Execute(context.Background(), actor(), "en"); err == nil {
		t.Fatal("expected programme failure")
	}
	programmes.Err = nil
	completed, err := schedule.Items["slot"].PublishReplay(actor(), "video", assetID("captions"), now)
	if err != nil {
		t.Fatal(err)
	}
	schedule.Items["slot"] = completed
	guide, err := appmedia.NewListTelevisionGuide(d, fakes.VideoDeliveryFake{
		Delivery: ports.VideoDelivery{PlaybackURL: "https://cdn.test/report.m3u8", PosterURL: "https://cdn.test/poster.jpg", MIMEType: "application/vnd.apple.mpegurl"},
	}).Execute(context.Background(), "en")
	if err != nil || guide.Replays[0].Replay == nil || guide.Replays[0].Replay.CaptionURL != assets.Items["captions"].State().SecureURL {
		t.Fatalf("%+v %v", guide.Replays, err)
	}
	delete(assets.Items, "captions")
	if _, err = appmedia.NewListTelevisionGuide(d, fakes.VideoDeliveryFake{}).Execute(context.Background(), "en"); err == nil {
		t.Fatal("expected missing caption failure")
	}
}

func assetID(id shared.AssetID) *shared.AssetID { return &id }
