package testing

import (
	"context"
	"sort"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type GalleryStore struct {
	Items map[shared.GalleryID]media.Gallery
	Err   error
}

func NewGalleryStore(seed ...media.Gallery) *GalleryStore {
	store := &GalleryStore{Items: map[shared.GalleryID]media.Gallery{}}
	for _, item := range seed {
		store.Items[item.ID()] = item
	}
	return store
}
func (s *GalleryStore) FindByID(_ context.Context, id shared.GalleryID) (media.Gallery, error) {
	if s.Err != nil {
		return media.Gallery{}, s.Err
	}
	item, ok := s.Items[id]
	if !ok {
		return media.Gallery{}, ports.ErrNotFound
	}
	return item, nil
}
func (s *GalleryStore) ListPublished(_ context.Context, locale string, limit int) ([]media.Gallery, error) {
	if s.Err != nil {
		return nil, s.Err
	}
	out := []media.Gallery{}
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
func (s *GalleryStore) Save(_ context.Context, item media.Gallery) error {
	if s.Err != nil {
		return s.Err
	}
	s.Items[item.ID()] = item
	return nil
}
