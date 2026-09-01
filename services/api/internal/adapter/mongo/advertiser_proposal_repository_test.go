package mongo_test

import (
	"context"
	"errors"
	"testing"
	"time"

	adapter "github.com/kurasikapa/api/internal/adapter/mongo"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func advertiserProposalInput() revenue.AdvertiserProposalState {
	return revenue.AdvertiserProposalState{
		ID: "proposal-1", ContactName: "Ama Mensah", ContactEmail: "ama@example.com",
		Campaign: revenue.AdCampaignState{
			Name: "Launch", Advertiser: "Acme Ghana", Locale: "en",
			Slot: revenue.SlotHomeLeaderboard, CreativeURL: "https://cdn.example/ad.jpg",
			AltText: "Acme solar systems", LandingURL: "https://example.com",
			Budget: revenue.Money{Minor: 10000, Currency: revenue.CurrencyGHS}, CPMMinor: 1000,
			Priority: 90, StartsAt: testNow.Add(-time.Hour), EndsAt: testNow.Add(24 * time.Hour),
		},
	}
}

func TestAdvertiserProposalRepositoryRoundTripAndAtomicApproval(t *testing.T) {
	t.Parallel()
	h := newHarness(t)
	ctx := context.Background()
	repository := adapter.NewAdvertiserProposalRepository(h.DB)
	campaigns := adapter.NewAdCampaignRepository(h.DB)
	actor := identity.NewActor("advertiser-1", []identity.Role{identity.RoleAdvertiser})
	manager := identity.NewActor("manager", []identity.Role{identity.RoleAdministrator})
	proposal, err := revenue.NewAdvertiserProposal(actor, advertiserProposalInput(), testNow)
	if err != nil || repository.Save(ctx, proposal) != nil {
		t.Fatal(err)
	}
	owned, err := repository.ListForOwner(ctx, actor.ID(), 10)
	if err != nil || len(owned) != 1 || owned[0].State().ContactEmail != "ama@example.com" {
		t.Fatal(owned, err)
	}
	queue, err := repository.ListSubmitted(ctx, 10)
	if err != nil || len(queue) != 1 {
		t.Fatal(queue, err)
	}
	campaignState := proposal.State().Campaign
	campaignState.ID = "campaign-1"
	campaign, _ := revenue.NewAdCampaign(manager, campaignState)
	campaign, _ = campaign.Activate(manager, testNow)
	approved, _ := proposal.Approve(manager, campaign.ID(), testNow)
	if err = repository.ApproveWithCampaign(ctx, approved, campaign); err != nil {
		t.Fatal(err)
	}
	got, err := repository.FindByID(ctx, proposal.ID())
	if err != nil || got.State().Status != revenue.ProposalApproved {
		t.Fatal(got.State(), err)
	}
	if stored, findErr := campaigns.FindByID(ctx, campaign.ID()); findErr != nil || !stored.State().Active {
		t.Fatal(stored.State(), findErr)
	}
	if err = repository.ApproveWithCampaign(ctx, approved, revenue.ReconstituteAdCampaign(withCampaignID(campaign.State(), "campaign-2"))); !errors.Is(err, revenue.ErrProposalReviewed) {
		t.Fatal(err)
	}
	if _, err = campaigns.FindByID(ctx, "campaign-2"); err == nil {
		t.Fatal("failed transaction left an orphan campaign")
	}
}

func TestAdvertiserProposalRepositoryRejectUsesSubmittedGuard(t *testing.T) {
	t.Parallel()
	h := newHarness(t)
	ctx := context.Background()
	repository := adapter.NewAdvertiserProposalRepository(h.DB)
	actor := identity.NewActor("advertiser-1", []identity.Role{identity.RoleAdvertiser})
	manager := identity.NewActor("manager", []identity.Role{identity.RoleAdministrator})
	proposal, _ := revenue.NewAdvertiserProposal(actor, advertiserProposalInput(), testNow)
	if err := repository.Save(ctx, proposal); err != nil {
		t.Fatal(err)
	}
	rejected, _ := proposal.Reject(manager, "Revise targeting.", testNow)
	if err := repository.Save(ctx, rejected); err != nil {
		t.Fatal(err)
	}
	if err := repository.Save(ctx, rejected); !errors.Is(err, revenue.ErrProposalReviewed) {
		t.Fatal(err)
	}
	if _, err := repository.FindByID(ctx, shared.AdvertiserProposalID("missing")); err == nil {
		t.Fatal("missing proposal found")
	}
}

func withCampaignID(state revenue.AdCampaignState, id shared.AdCampaignID) revenue.AdCampaignState {
	state.ID = id
	return state
}
