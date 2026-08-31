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
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestPodcastEpisodePublicationAndPublicLibrary(t *testing.T) {
	d, _, _, _ := deps()
	d.Podcasts, d.Episodes, d.Assets = fakes.NewPodcastStore(), fakes.NewEpisodeStore(), fakes.NewAssetStore()
	artwork := domainmedia.ReconstituteAsset(domainmedia.AssetState{ID: "artwork_1", Kind: domainmedia.AssetImage, Status: domainmedia.AssetReady, SecureURL: "https://example.test/artwork.jpg"})
	if err := d.Assets.Save(context.Background(), artwork); err != nil {
		t.Fatal(err)
	}
	artworkID := artwork.ID()
	podcast, err := appmedia.NewCreatePodcast(d).Execute(context.Background(), actor(), domainmedia.PodcastState{Title: "The Kurasikapa Brief", Summary: "Context behind the week's defining stories", Locale: "en", ArtworkAssetID: &artworkID})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = appmedia.NewCreateEpisode(d).Execute(context.Background(), actor(), domainmedia.EpisodeState{PodcastID: podcast.ID(), Title: "Market close"}); !errors.Is(err, appmedia.ErrPodcastNotPublished) {
		t.Fatal(err)
	}
	podcast, err = appmedia.NewPublishPodcast(d).Execute(context.Background(), actor(), podcast.ID())
	if err != nil || !podcast.State().Published {
		t.Fatal(err)
	}
	audio := readyAsset(t, actor(), "audio_1", domainmedia.AssetAudio)
	transcript := readyAsset(t, actor(), "transcript_1", domainmedia.AssetTranscript)
	if err = d.Assets.Save(context.Background(), audio); err != nil {
		t.Fatal(err)
	}
	if err = d.Assets.Save(context.Background(), transcript); err != nil {
		t.Fatal(err)
	}
	audioID, transcriptID := audio.ID(), transcript.ID()
	episode, err := appmedia.NewCreateEpisode(d).Execute(context.Background(), actor(), domainmedia.EpisodeState{PodcastID: podcast.ID(), Title: "Market close", AudioAssetID: &audioID, TranscriptAssetID: &transcriptID, DurationSeconds: 180, Chapters: []domainmedia.EpisodeChapter{{Title: "Opening", StartsAtSec: 0}}})
	if err != nil {
		t.Fatal(err)
	}
	episode, err = appmedia.NewPublishEpisode(d).Execute(context.Background(), actor(), episode.ID())
	if err != nil || !episode.State().Published {
		t.Fatal(err)
	}
	library, err := appmedia.NewListPodcastLibrary(d).Execute(context.Background(), "en", 20)
	if err != nil || len(library) != 1 || len(library[0].Episodes) != 1 || library[0].Artwork == nil {
		t.Fatal(err)
	}
}

func TestPublishEpisodeRejectsMissingAndWrongAssets(t *testing.T) {
	d, _, _, _ := deps()
	d.Podcasts, d.Episodes, d.Assets = fakes.NewPodcastStore(), fakes.NewEpisodeStore(), fakes.NewAssetStore()
	podcast := domainmedia.ReconstitutePodcast(domainmedia.PodcastState{ID: "pod_1", Published: true})
	if err := d.Podcasts.Save(context.Background(), podcast); err != nil {
		t.Fatal(err)
	}
	audioID, transcriptID := shared.AssetID("missing_audio"), shared.AssetID("missing_transcript")
	episode, err := appmedia.NewCreateEpisode(d).Execute(context.Background(), actor(), domainmedia.EpisodeState{PodcastID: podcast.ID(), Title: "Episode", AudioAssetID: &audioID, TranscriptAssetID: &transcriptID})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = appmedia.NewPublishEpisode(d).Execute(context.Background(), actor(), episode.ID()); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal(err)
	}
	wrong := readyAsset(t, actor(), audioID, domainmedia.AssetVideo)
	if err = d.Assets.Save(context.Background(), wrong); err != nil {
		t.Fatal(err)
	}
	if _, err = appmedia.NewPublishEpisode(d).Execute(context.Background(), actor(), episode.ID()); !errors.Is(err, appmedia.ErrEpisodeAudioNotReady) {
		t.Fatal(err)
	}
	readyAudio := readyAsset(t, actor(), audioID, domainmedia.AssetAudio)
	if err = d.Assets.Save(context.Background(), readyAudio); err != nil {
		t.Fatal(err)
	}
	wrongTranscript := readyAsset(t, actor(), transcriptID, domainmedia.AssetVideo)
	if err = d.Assets.Save(context.Background(), wrongTranscript); err != nil {
		t.Fatal(err)
	}
	if _, err = appmedia.NewPublishEpisode(d).Execute(context.Background(), actor(), episode.ID()); !errors.Is(err, appmedia.ErrTranscriptNotReady) {
		t.Fatal(err)
	}
}

func TestPodcastUseCasesPropagateRepositoryFailures(t *testing.T) {
	sentinel := errors.New("store unavailable")
	d, _, _, _ := deps()
	podcasts, episodes, assets := fakes.NewPodcastStore(), fakes.NewEpisodeStore(), fakes.NewAssetStore()
	d.Podcasts, d.Episodes, d.Assets = podcasts, episodes, assets
	podcasts.Err = sentinel
	if _, err := appmedia.NewCreatePodcast(d).Execute(context.Background(), actor(), domainmedia.PodcastState{Title: "Brief", Summary: "Daily news"}); !errors.Is(err, sentinel) {
		t.Fatal(err)
	}
	if _, err := appmedia.NewPublishPodcast(d).Execute(context.Background(), actor(), "missing"); !errors.Is(err, sentinel) {
		t.Fatal(err)
	}
	if _, err := appmedia.NewCreateEpisode(d).Execute(context.Background(), actor(), domainmedia.EpisodeState{PodcastID: "missing", Title: "Episode"}); !errors.Is(err, sentinel) {
		t.Fatal(err)
	}
	if _, err := appmedia.NewListPodcastLibrary(d).Execute(context.Background(), "en", 20); !errors.Is(err, sentinel) {
		t.Fatal(err)
	}
	podcasts.Err = nil
	episodes.Err = sentinel
	if _, err := appmedia.NewPublishEpisode(d).Execute(context.Background(), actor(), "missing"); !errors.Is(err, sentinel) {
		t.Fatal(err)
	}
}

func readyAsset(t *testing.T, actor identity.Actor, id shared.AssetID, kind domainmedia.AssetKind) domainmedia.Asset {
	t.Helper()
	asset, err := domainmedia.NewAsset(actor, domainmedia.AssetState{ID: id, Kind: kind, Filename: "asset"})
	if err != nil {
		t.Fatal(err)
	}
	asset, err = asset.MarkReady(actor, domainmedia.AssetDelivery{ProviderID: "provider", SecureURL: "https://example.test/asset", Bytes: 10})
	if err != nil {
		t.Fatal(err)
	}
	return asset
}
