package revenue

import (
	"context"

	"github.com/kurasikapa/api/internal/domain/identity"
	domainrevenue "github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type SubmitAdvertiserProposal struct{ deps Deps }

func NewSubmitAdvertiserProposal(deps Deps) SubmitAdvertiserProposal {
	return SubmitAdvertiserProposal{deps: deps}
}
func (u SubmitAdvertiserProposal) Execute(ctx context.Context, actor identity.Actor, input domainrevenue.AdvertiserProposalState) (domainrevenue.AdvertiserProposal, error) {
	input.ID = shared.AdvertiserProposalID(u.deps.IDs.NewID())
	proposal, err := domainrevenue.NewAdvertiserProposal(actor, input, u.deps.Clock.Now())
	if err != nil {
		return domainrevenue.AdvertiserProposal{}, err
	}
	return proposal, u.deps.AdvertiserProposals.Save(ctx, proposal)
}

type ListOwnAdvertiserProposals struct{ deps Deps }

func NewListOwnAdvertiserProposals(deps Deps) ListOwnAdvertiserProposals {
	return ListOwnAdvertiserProposals{deps: deps}
}
func (u ListOwnAdvertiserProposals) Execute(ctx context.Context, actor identity.Actor) ([]domainrevenue.AdvertiserProposal, error) {
	if err := actor.Require(identity.PermCampaignViewOwn); err != nil {
		return nil, err
	}
	return u.deps.AdvertiserProposals.ListForOwner(ctx, actor.ID(), 100)
}

type ListAdvertiserProposalQueue struct{ deps Deps }

func NewListAdvertiserProposalQueue(deps Deps) ListAdvertiserProposalQueue {
	return ListAdvertiserProposalQueue{deps: deps}
}
func (u ListAdvertiserProposalQueue) Execute(ctx context.Context, actor identity.Actor) ([]domainrevenue.AdvertiserProposal, error) {
	if err := actor.Require(identity.PermRevenueRead); err != nil {
		return nil, err
	}
	return u.deps.AdvertiserProposals.ListSubmitted(ctx, 250)
}

type ApproveAdvertiserProposal struct{ deps Deps }

func NewApproveAdvertiserProposal(deps Deps) ApproveAdvertiserProposal {
	return ApproveAdvertiserProposal{deps: deps}
}
func (u ApproveAdvertiserProposal) Execute(ctx context.Context, actor identity.Actor, id shared.AdvertiserProposalID) (domainrevenue.AdvertiserProposal, error) {
	proposal, err := u.deps.AdvertiserProposals.FindByID(ctx, id)
	if err != nil {
		return domainrevenue.AdvertiserProposal{}, err
	}
	at := u.deps.Clock.Now()
	input := proposal.State().Campaign
	input.ID = shared.AdCampaignID(u.deps.IDs.NewID())
	campaign, err := domainrevenue.NewAdCampaign(actor, input)
	if err != nil {
		return domainrevenue.AdvertiserProposal{}, err
	}
	campaign, err = campaign.Activate(actor, at)
	if err != nil {
		return domainrevenue.AdvertiserProposal{}, err
	}
	proposal, err = proposal.Approve(actor, campaign.ID(), at)
	if err != nil {
		return domainrevenue.AdvertiserProposal{}, err
	}
	return proposal, u.deps.AdvertiserProposals.ApproveWithCampaign(ctx, proposal, campaign)
}

type RejectAdvertiserProposal struct{ deps Deps }

func NewRejectAdvertiserProposal(deps Deps) RejectAdvertiserProposal {
	return RejectAdvertiserProposal{deps: deps}
}
func (u RejectAdvertiserProposal) Execute(ctx context.Context, actor identity.Actor, id shared.AdvertiserProposalID, note string) (domainrevenue.AdvertiserProposal, error) {
	proposal, err := u.deps.AdvertiserProposals.FindByID(ctx, id)
	if err != nil {
		return domainrevenue.AdvertiserProposal{}, err
	}
	proposal, err = proposal.Reject(actor, note, u.deps.Clock.Now())
	if err != nil {
		return domainrevenue.AdvertiserProposal{}, err
	}
	return proposal, u.deps.AdvertiserProposals.Save(ctx, proposal)
}
