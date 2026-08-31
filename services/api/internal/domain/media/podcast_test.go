package media_test

import (
	"errors"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestPodcastRequiresEditorialMetadataAndPermission(t *testing.T) {
	manager := identity.NewActor("manager", []identity.Role{identity.RoleVideoEditor})
	if _, err := media.NewPodcast(manager, media.PodcastState{Title: " ", Summary: "A show"}); !errors.Is(err, media.ErrEmptyPodcastTitle) {
		t.Fatal(err)
	}
	if _, err := media.NewPodcast(manager, media.PodcastState{Title: "The Brief", Summary: " "}); !errors.Is(err, media.ErrEmptyPodcastSummary) {
		t.Fatal(err)
	}
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err := media.NewPodcast(guest, media.PodcastState{Title: "The Brief", Summary: "A show"}); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	podcast, err := media.NewPodcast(manager, media.PodcastState{ID: "pod_1", Title: " The Brief ", Summary: " A useful weekly show "})
	if err != nil || podcast.State().CreatedBy != "manager" || podcast.State().Published {
		t.Fatal(err)
	}
	podcast, err = podcast.Publish(manager)
	if err != nil || !podcast.State().Published {
		t.Fatal(err)
	}
}

func TestEpisodePublicationRequiresAudioTranscriptAndValidChapters(t *testing.T) {
	manager := identity.NewActor("manager", []identity.Role{identity.RoleVideoEditor})
	if _, err := media.NewEpisode(manager, media.EpisodeState{Title: " "}); !errors.Is(err, media.ErrEmptyEpisodeTitle) {
		t.Fatal(err)
	}
	episode, err := media.NewEpisode(manager, media.EpisodeState{ID: "ep_1", PodcastID: "pod_1", Title: " Market close ", DurationSeconds: 120})
	if err != nil || episode.State().CreatedBy != "manager" {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 31, 14, 0, 0, 0, time.UTC)
	if _, err = episode.Publish(manager, now); !errors.Is(err, media.ErrEpisodeNeedsAudio) {
		t.Fatal(err)
	}
	audio, transcript := shared.AssetID("audio_1"), shared.AssetID("transcript_1")
	state := episode.State()
	state.AudioAssetID = &audio
	episode = media.ReconstituteEpisode(state)
	if _, err = episode.Publish(manager, now); !errors.Is(err, media.ErrEpisodeNeedsTranscript) {
		t.Fatal(err)
	}
	state.TranscriptAssetID = &transcript
	state.Chapters = []media.EpisodeChapter{{Title: "Opening", StartsAtSec: 0}, {Title: "Earlier", StartsAtSec: 0}}
	episode = media.ReconstituteEpisode(state)
	if _, err = episode.Publish(manager, now); !errors.Is(err, media.ErrInvalidEpisodeChapter) {
		t.Fatal(err)
	}
	state.Chapters = []media.EpisodeChapter{{Title: "Opening", StartsAtSec: 0}, {Title: "Markets", StartsAtSec: 60}}
	episode = media.ReconstituteEpisode(state)
	episode, err = episode.Publish(manager, now)
	if err != nil || !episode.State().Published || episode.State().PublishedAt == nil {
		t.Fatal(err)
	}
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err = episode.Publish(guest, now); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
}
