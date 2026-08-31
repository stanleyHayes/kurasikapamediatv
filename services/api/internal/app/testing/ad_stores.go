package testing

import (
	"context"
	"sort"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type AdCampaignStore struct {
	Items map[shared.AdCampaignID]revenue.AdCampaign
}

func NewAdCampaignStore() *AdCampaignStore {
	return &AdCampaignStore{Items: map[shared.AdCampaignID]revenue.AdCampaign{}}
}
func (s *AdCampaignStore) FindByID(_ context.Context, id shared.AdCampaignID) (revenue.AdCampaign, error) {
	value, ok := s.Items[id]
	if !ok {
		return revenue.AdCampaign{}, ports.ErrNotFound
	}
	return value, nil
}
func (s *AdCampaignStore) ListEligible(_ context.Context, slot revenue.AdSlot, locale string, at time.Time, limit int) ([]revenue.AdCampaign, error) {
	items := make([]revenue.AdCampaign, 0, limit)
	for _, item := range s.Items {
		state := item.State()
		if state.Active && state.Slot == slot && (state.Locale == locale || state.Locale == "*") && !at.Before(state.StartsAt) && at.Before(state.EndsAt) {
			items = append(items, item)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].State().Priority > items[j].State().Priority })
	if len(items) > limit {
		items = items[:limit]
	}
	return items, nil
}
func (s *AdCampaignStore) ListAll(_ context.Context, limit int) ([]revenue.AdCampaign, error) {
	items := make([]revenue.AdCampaign, 0, limit)
	for _, item := range s.Items {
		items = append(items, item)
	}
	return items, nil
}
func (s *AdCampaignStore) Save(_ context.Context, value revenue.AdCampaign) error {
	s.Items[value.ID()] = value
	return nil
}

type AdEventStore struct{ Items []revenue.AdEvent }

func (s *AdEventStore) CountForCampaign(_ context.Context, id shared.AdCampaignID, kind revenue.AdEventKind) (int64, error) {
	var count int64
	for _, event := range s.Items {
		if event.CampaignID == id && event.Kind == kind {
			count++
		}
	}
	return count, nil
}
func (s *AdEventStore) Append(_ context.Context, event revenue.AdEvent) error {
	s.Items = append(s.Items, event)
	return nil
}
