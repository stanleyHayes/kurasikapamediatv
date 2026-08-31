package testing

import (
	"context"
	"sort"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type PodcastStore struct {
	Items map[shared.PodcastID]media.Podcast
	Err   error
}

func NewPodcastStore(seed ...media.Podcast) *PodcastStore {
	store := &PodcastStore{Items: map[shared.PodcastID]media.Podcast{}}
	for _, item := range seed {
		store.Items[item.ID()] = item
	}
	return store
}
func (s *PodcastStore) FindByID(_ context.Context, id shared.PodcastID) (media.Podcast, error) {
	if s.Err != nil {
		return media.Podcast{}, s.Err
	}
	item, ok := s.Items[id]
	if !ok {
		return media.Podcast{}, ports.ErrNotFound
	}
	return item, nil
}
func (s *PodcastStore) ListPublished(_ context.Context, locale string, limit int) ([]media.Podcast, error) {
	if s.Err != nil {
		return nil, s.Err
	}
	out := []media.Podcast{}
	for _, item := range s.Items {
		if item.State().Published && (locale == "" || item.State().Locale == locale) {
			out = append(out, item)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID().String() > out[j].ID().String() })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}
func (s *PodcastStore) Save(_ context.Context, item media.Podcast) error {
	if s.Err != nil {
		return s.Err
	}
	s.Items[item.ID()] = item
	return nil
}

type EpisodeStore struct {
	Items map[shared.EpisodeID]media.Episode
	Err   error
}

func NewEpisodeStore(seed ...media.Episode) *EpisodeStore {
	store := &EpisodeStore{Items: map[shared.EpisodeID]media.Episode{}}
	for _, item := range seed {
		store.Items[item.ID()] = item
	}
	return store
}
func (s *EpisodeStore) FindByID(_ context.Context, id shared.EpisodeID) (media.Episode, error) {
	if s.Err != nil {
		return media.Episode{}, s.Err
	}
	item, ok := s.Items[id]
	if !ok {
		return media.Episode{}, ports.ErrNotFound
	}
	return item, nil
}
func (s *EpisodeStore) ListPublished(_ context.Context, podcastID shared.PodcastID, limit int) ([]media.Episode, error) {
	if s.Err != nil {
		return nil, s.Err
	}
	out := []media.Episode{}
	for _, item := range s.Items {
		if item.State().Published && item.State().PodcastID == podcastID {
			out = append(out, item)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID().String() > out[j].ID().String() })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}
func (s *EpisodeStore) Save(_ context.Context, item media.Episode) error {
	if s.Err != nil {
		return s.Err
	}
	s.Items[item.ID()] = item
	return nil
}
