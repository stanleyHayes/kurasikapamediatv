package testing

import (
	"context"
	"sort"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type StaffProfileStore struct {
	Items map[shared.StaffProfileID]identity.StaffProfile
	Err   error
}

func NewStaffProfileStore(seed ...identity.StaffProfile) *StaffProfileStore {
	store := &StaffProfileStore{Items: map[shared.StaffProfileID]identity.StaffProfile{}}
	for _, item := range seed {
		store.Items[item.ID()] = item
	}
	return store
}

func (s *StaffProfileStore) FindByID(_ context.Context, id shared.StaffProfileID) (identity.StaffProfile, error) {
	if s.Err != nil {
		return identity.StaffProfile{}, s.Err
	}
	item, ok := s.Items[id]
	if !ok {
		return identity.StaffProfile{}, ports.ErrNotFound
	}
	return item, nil
}

func (s *StaffProfileStore) FindByUserID(_ context.Context, id shared.UserID, locale string) (identity.StaffProfile, error) {
	if s.Err != nil {
		return identity.StaffProfile{}, s.Err
	}
	for _, item := range s.Items {
		if state := item.State(); state.UserID == id && state.Locale == locale {
			return item, s.Err
		}
	}
	return identity.StaffProfile{}, ports.ErrNotFound
}

func (s *StaffProfileStore) FindPublishedBySlug(_ context.Context, locale, slug string) (identity.StaffProfile, error) {
	if s.Err != nil {
		return identity.StaffProfile{}, s.Err
	}
	for _, item := range s.Items {
		state := item.State()
		if state.Published && state.Locale == locale && state.Slug.String() == slug {
			return item, s.Err
		}
	}
	return identity.StaffProfile{}, ports.ErrNotFound
}

func (s *StaffProfileStore) ListPublished(_ context.Context, locale string) ([]identity.StaffProfile, error) {
	if s.Err != nil {
		return nil, s.Err
	}
	out := []identity.StaffProfile{}
	for _, item := range s.Items {
		state := item.State()
		if state.Published && state.Locale == locale {
			out = append(out, item)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].State().DisplayName < out[j].State().DisplayName })
	return out, nil
}

func (s *StaffProfileStore) Save(_ context.Context, item identity.StaffProfile) error {
	if s.Err != nil {
		return s.Err
	}
	s.Items[item.ID()] = item
	return nil
}
