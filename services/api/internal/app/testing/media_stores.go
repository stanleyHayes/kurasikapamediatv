package testing

import (
	"context"
	"sort"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type PresenterStore struct {
	Items map[shared.PresenterID]domainmedia.Presenter
	Err   error
}

func NewPresenterStore(seed ...domainmedia.Presenter) *PresenterStore {
	store := &PresenterStore{Items: map[shared.PresenterID]domainmedia.Presenter{}}
	for _, item := range seed {
		store.Items[item.ID()] = item
	}
	return store
}
func (s *PresenterStore) FindByID(_ context.Context, id shared.PresenterID) (domainmedia.Presenter, error) {
	if s.Err != nil {
		return domainmedia.Presenter{}, s.Err
	}
	item, ok := s.Items[id]
	if !ok {
		return domainmedia.Presenter{}, ports.ErrNotFound
	}
	return item, nil
}
func (s *PresenterStore) ListPublished(_ context.Context, locale string) ([]domainmedia.Presenter, error) {
	if s.Err != nil {
		return nil, s.Err
	}
	out := []domainmedia.Presenter{}
	for _, item := range s.Items {
		state := item.State()
		if state.Published && state.Locale == locale {
			out = append(out, item)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].State().Name < out[j].State().Name })
	return out, nil
}
func (s *PresenterStore) Save(_ context.Context, item domainmedia.Presenter) error {
	if s.Err != nil {
		return s.Err
	}
	s.Items[item.ID()] = item
	return nil
}

type ProgrammeStore struct {
	Items map[shared.ProgrammeID]domainmedia.Programme
	Err   error
}

func NewProgrammeStore(seed ...domainmedia.Programme) *ProgrammeStore {
	store := &ProgrammeStore{Items: map[shared.ProgrammeID]domainmedia.Programme{}}
	for _, item := range seed {
		store.Items[item.ID()] = item
	}
	return store
}
func (s *ProgrammeStore) FindByID(_ context.Context, id shared.ProgrammeID) (domainmedia.Programme, error) {
	if s.Err != nil {
		return domainmedia.Programme{}, s.Err
	}
	item, ok := s.Items[id]
	if !ok {
		return domainmedia.Programme{}, ports.ErrNotFound
	}
	return item, nil
}
func (s *ProgrammeStore) ListPublished(_ context.Context, locale string) ([]domainmedia.Programme, error) {
	if s.Err != nil {
		return nil, s.Err
	}
	out := []domainmedia.Programme{}
	for _, item := range s.Items {
		state := item.State()
		if state.Published && state.Locale == locale {
			out = append(out, item)
		}
	}
	return out, nil
}
func (s *ProgrammeStore) Save(_ context.Context, item domainmedia.Programme) error {
	if s.Err != nil {
		return s.Err
	}
	s.Items[item.ID()] = item
	return nil
}

type ScheduleStore struct {
	Items map[shared.ScheduleSlotID]domainmedia.ScheduleSlot
	Err   error
}

func NewScheduleStore(seed ...domainmedia.ScheduleSlot) *ScheduleStore {
	store := &ScheduleStore{Items: map[shared.ScheduleSlotID]domainmedia.ScheduleSlot{}}
	for _, item := range seed {
		store.Items[item.ID()] = item
	}
	return store
}
func (s *ScheduleStore) FindByID(_ context.Context, id shared.ScheduleSlotID) (domainmedia.ScheduleSlot, error) {
	if s.Err != nil {
		return domainmedia.ScheduleSlot{}, s.Err
	}
	item, ok := s.Items[id]
	if !ok {
		return domainmedia.ScheduleSlot{}, ports.ErrNotFound
	}
	return item, nil
}
func (s *ScheduleStore) ListUpcoming(_ context.Context, locale string, from time.Time, limit int) ([]domainmedia.ScheduleSlot, error) {
	return s.list(locale, limit, func(state domainmedia.ScheduleSlotState) bool {
		return state.State == domainmedia.ScheduleScheduled && state.EndsAt.After(from)
	})
}
func (s *ScheduleStore) ListAwaitingReplay(_ context.Context, locale string, now time.Time, limit int) ([]domainmedia.ScheduleSlot, error) {
	return s.list(locale, limit, func(state domainmedia.ScheduleSlotState) bool {
		return state.State == domainmedia.ScheduleScheduled && state.IsLive && !state.EndsAt.After(now)
	})
}
func (s *ScheduleStore) ListReplays(_ context.Context, locale string, limit int) ([]domainmedia.ScheduleSlot, error) {
	return s.list(locale, limit, func(state domainmedia.ScheduleSlotState) bool {
		return state.State == domainmedia.ScheduleCompleted && state.ReplayAssetID != nil && state.CaptionAssetID != nil
	})
}
func (s *ScheduleStore) list(locale string, limit int, include func(domainmedia.ScheduleSlotState) bool) ([]domainmedia.ScheduleSlot, error) {
	if s.Err != nil {
		return nil, s.Err
	}
	out := []domainmedia.ScheduleSlot{}
	for _, item := range s.Items {
		state := item.State()
		if state.Locale == locale && include(state) {
			out = append(out, item)
		}
	}
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}
func (s *ScheduleStore) Save(_ context.Context, item domainmedia.ScheduleSlot) error {
	if s.Err != nil {
		return s.Err
	}
	s.Items[item.ID()] = item
	return nil
}
