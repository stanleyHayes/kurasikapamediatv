package testing

import (
	"context"
	"sort"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type EventStore struct {
	Items map[shared.EventID]media.Event
	Err   error
}

func NewEventStore(seed ...media.Event) *EventStore {
	store := &EventStore{Items: map[shared.EventID]media.Event{}}
	for _, item := range seed {
		store.Items[item.ID()] = item
	}
	return store
}

func (s *EventStore) FindByID(_ context.Context, id shared.EventID) (media.Event, error) {
	if s.Err != nil {
		return media.Event{}, s.Err
	}
	item, ok := s.Items[id]
	if !ok {
		return media.Event{}, ports.ErrNotFound
	}
	return item, nil
}

func (s *EventStore) ListUpcoming(_ context.Context, locale string, now time.Time, limit int) ([]media.Event, error) {
	if s.Err != nil {
		return nil, s.Err
	}
	out := make([]media.Event, 0, len(s.Items))
	for _, item := range s.Items {
		state := item.State()
		if state.Published && state.Locale == locale && state.EndsAt.After(now) {
			out = append(out, item)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].State().StartsAt.Before(out[j].State().StartsAt) })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (s *EventStore) Save(_ context.Context, item media.Event) error {
	if s.Err != nil {
		return s.Err
	}
	s.Items[item.ID()] = item
	return nil
}
