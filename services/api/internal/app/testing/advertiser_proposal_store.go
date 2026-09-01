package testing

import (
	"context"
	"sort"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type AdvertiserProposalStore struct {
	Items     map[shared.AdvertiserProposalID]revenue.AdvertiserProposal
	Campaigns *AdCampaignStore
	Err       error
}

func NewAdvertiserProposalStore(campaigns *AdCampaignStore) *AdvertiserProposalStore {
	return &AdvertiserProposalStore{Items: map[shared.AdvertiserProposalID]revenue.AdvertiserProposal{}, Campaigns: campaigns}
}
func (s *AdvertiserProposalStore) FindByID(_ context.Context, id shared.AdvertiserProposalID) (revenue.AdvertiserProposal, error) {
	if s.Err != nil {
		return revenue.AdvertiserProposal{}, s.Err
	}
	value, ok := s.Items[id]
	if !ok {
		return revenue.AdvertiserProposal{}, ports.ErrNotFound
	}
	return value, nil
}
func (s *AdvertiserProposalStore) ListForOwner(_ context.Context, owner shared.UserID, limit int) ([]revenue.AdvertiserProposal, error) {
	return s.list(limit, func(state revenue.AdvertiserProposalState) bool { return state.OwnerID == owner })
}
func (s *AdvertiserProposalStore) ListSubmitted(_ context.Context, limit int) ([]revenue.AdvertiserProposal, error) {
	return s.list(limit, func(state revenue.AdvertiserProposalState) bool { return state.Status == revenue.ProposalSubmitted })
}
func (s *AdvertiserProposalStore) list(limit int, keep func(revenue.AdvertiserProposalState) bool) ([]revenue.AdvertiserProposal, error) {
	if s.Err != nil {
		return nil, s.Err
	}
	out := make([]revenue.AdvertiserProposal, 0, limit)
	for _, value := range s.Items {
		if keep(value.State()) {
			out = append(out, value)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].State().SubmittedAt.After(out[j].State().SubmittedAt) })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}
func (s *AdvertiserProposalStore) Save(_ context.Context, value revenue.AdvertiserProposal) error {
	if s.Err != nil {
		return s.Err
	}
	s.Items[value.ID()] = value
	return nil
}
func (s *AdvertiserProposalStore) ApproveWithCampaign(_ context.Context, proposal revenue.AdvertiserProposal, campaign revenue.AdCampaign) error {
	if s.Err != nil {
		return s.Err
	}
	s.Items[proposal.ID()] = proposal
	s.Campaigns.Items[campaign.ID()] = campaign
	return nil
}
