package mongo_test

import (
	"context"
	"testing"
	"time"

	adapter "github.com/kurasikapa/api/internal/adapter/mongo"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestTelevisionRepositoriesRoundTripAndFilterPublicGuide(t *testing.T) {
	t.Parallel()
	h := newHarness(t)
	store := adapter.NewTelevisionRepositories(h.DB)
	presenters := adapter.NewPresenterRepository(store)
	programmes := adapter.NewProgrammeRepository(store)
	schedule := adapter.NewScheduleRepository(store)
	ctx := context.Background()
	if err := store.EnsureIndexes(ctx); err != nil {
		t.Fatal(err)
	}

	presenter := domainmedia.ReconstitutePresenter(domainmedia.PresenterState{ID: "presenter", Name: "Ama", Slug: "ama", Locale: "en", Published: true, CreatedBy: "manager"})
	if err := presenters.Save(ctx, presenter); err != nil {
		t.Fatal(err)
	}
	if got, err := presenters.FindByID(ctx, presenter.ID()); err != nil || got.State().Name != "Ama" {
		t.Fatalf("%+v %v", got.State(), err)
	}
	if listed, err := presenters.ListPublished(ctx, "en"); err != nil || len(listed) != 1 {
		t.Fatalf("%d %v", len(listed), err)
	}

	programme := domainmedia.ReconstituteProgramme(domainmedia.ProgrammeState{ID: "programme", Title: "Morning Desk", Slug: "morning", Locale: "en", PresenterIDs: []shared.PresenterID{presenter.ID()}, Published: true, CreatedBy: "manager"})
	if err := programmes.Save(ctx, programme); err != nil {
		t.Fatal(err)
	}
	if got, err := programmes.FindByID(ctx, programme.ID()); err != nil || got.State().Title != "Morning Desk" {
		t.Fatalf("%+v %v", got.State(), err)
	}
	if listed, err := programmes.ListPublished(ctx, "en"); err != nil || len(listed) != 1 {
		t.Fatalf("%d %v", len(listed), err)
	}

	upcoming := domainmedia.ReconstituteScheduleSlot(domainmedia.ScheduleSlotState{ID: "upcoming", ProgrammeID: programme.ID(), Locale: "en", StartsAt: testNow.Add(time.Hour), EndsAt: testNow.Add(2 * time.Hour), State: domainmedia.ScheduleScheduled, CreatedBy: "manager"})
	caption, replay := shared.AssetID("caption"), shared.AssetID("replay")
	completed := domainmedia.ReconstituteScheduleSlot(domainmedia.ScheduleSlotState{ID: "replay", ProgrammeID: programme.ID(), Locale: "en", StartsAt: testNow.Add(-2 * time.Hour), EndsAt: testNow.Add(-time.Hour), State: domainmedia.ScheduleCompleted, ReplayAssetID: &replay, CaptionAssetID: &caption, CreatedBy: "manager"})
	if err := schedule.Save(ctx, upcoming); err != nil {
		t.Fatal(err)
	}
	if err := schedule.Save(ctx, completed); err != nil {
		t.Fatal(err)
	}
	if rows, err := schedule.ListUpcoming(ctx, "en", testNow, 20); err != nil || len(rows) != 1 {
		t.Fatalf("upcoming %d %v", len(rows), err)
	}
	if rows, err := schedule.ListReplays(ctx, "en", 12); err != nil || len(rows) != 1 {
		t.Fatalf("replays %d %v", len(rows), err)
	}

	for collection, names := range map[string][]string{
		adapter.CollPresenters:    {"locale_slug_unique", "public_directory"},
		adapter.CollProgrammes:    {"locale_slug_unique", "public_directory"},
		adapter.CollScheduleSlots: {"upcoming_schedule", "replay_schedule"},
	} {
		got := indexNames(t, h, collection)
		for _, name := range names {
			if !got[name] {
				t.Errorf("%s missing %s", collection, name)
			}
		}
	}
}

func TestAssetRepositoryRoundTripAndIndexes(t *testing.T) {
	t.Parallel()
	h := newHarness(t)
	repo := adapter.NewAssetRepository(h.DB)
	ctx := context.Background()
	if err := repo.EnsureIndexes(ctx); err != nil {
		t.Fatal(err)
	}
	asset := domainmedia.ReconstituteAsset(domainmedia.AssetState{ID: "asset", Kind: domainmedia.AssetVideo, Filename: "report.mp4", MIMEType: "video/mp4", Locale: "en", Status: domainmedia.AssetPending, CreatedBy: "manager"})
	if err := repo.Save(ctx, asset); err != nil {
		t.Fatal(err)
	}
	got, err := repo.FindByID(ctx, asset.ID())
	if err != nil || got.State().Filename != "report.mp4" {
		t.Fatalf("%+v %v", got.State(), err)
	}
	listed, err := repo.List(ctx, "en", 20)
	if err != nil || len(listed) != 1 {
		t.Fatalf("%d %v", len(listed), err)
	}
	names := indexNames(t, h, adapter.CollMediaAssets)
	for _, name := range []string{"library_locale_status", "provider_asset_unique"} {
		if !names[name] {
			t.Errorf("missing %s", name)
		}
	}
}

func TestPodcastRepositoriesRoundTripAndIndexes(t *testing.T) {
	t.Parallel()
	h := newHarness(t)
	podcasts := adapter.NewPodcastRepository(h.DB)
	episodes := adapter.NewEpisodeRepository(h.DB)
	ctx := context.Background()
	if err := podcasts.EnsureIndexes(ctx); err != nil {
		t.Fatal(err)
	}
	if err := episodes.EnsureIndexes(ctx); err != nil {
		t.Fatal(err)
	}

	artwork, audio, transcript := shared.AssetID("artwork"), shared.AssetID("audio"), shared.AssetID("transcript")
	podcast := domainmedia.ReconstitutePodcast(domainmedia.PodcastState{ID: "podcast", Title: "The Brief", Slug: "the-brief", Locale: "en", Summary: "The week's essential stories.", Author: "Kurasikapa Newsroom", ArtworkAssetID: &artwork, Published: true, CreatedBy: "manager"})
	if err := podcasts.Save(ctx, podcast); err != nil {
		t.Fatal(err)
	}
	if got, err := podcasts.FindByID(ctx, podcast.ID()); err != nil || got.State().Title != "The Brief" {
		t.Fatalf("%+v %v", got.State(), err)
	}
	if listed, err := podcasts.ListPublished(ctx, "en", 20); err != nil || len(listed) != 1 {
		t.Fatalf("podcasts %d %v", len(listed), err)
	}

	publishedAt := testNow.Add(-time.Hour)
	episode := domainmedia.ReconstituteEpisode(domainmedia.EpisodeState{ID: "episode", PodcastID: podcast.ID(), Title: "Market close", Slug: "market-close", Locale: "en", Summary: "A clear look at today's markets.", AudioAssetID: &audio, TranscriptAssetID: &transcript, Chapters: []domainmedia.EpisodeChapter{{Title: "Opening", StartsAtSec: 0}, {Title: "Cedi watch", StartsAtSec: 60}}, DurationSeconds: 180, Published: true, PublishedAt: &publishedAt, CreatedBy: "manager"})
	if err := episodes.Save(ctx, episode); err != nil {
		t.Fatal(err)
	}
	if got, err := episodes.FindByID(ctx, episode.ID()); err != nil || len(got.State().Chapters) != 2 {
		t.Fatalf("%+v %v", got.State(), err)
	}
	if listed, err := episodes.ListPublished(ctx, podcast.ID(), 20); err != nil || len(listed) != 1 {
		t.Fatalf("episodes %d %v", len(listed), err)
	}

	for collection, name := range map[string]string{
		adapter.CollPodcasts: "public_podcast_library",
		adapter.CollEpisodes: "public_episode_library",
	} {
		if !indexNames(t, h, collection)[name] {
			t.Errorf("%s missing %s", collection, name)
		}
	}
}
