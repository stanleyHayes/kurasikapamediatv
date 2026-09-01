package revenue_test

import (
	"errors"
	"testing"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func advertiser() identity.Actor {
	return identity.NewActor("advertiser-1", []identity.Role{identity.RoleAdvertiser})
}

func proposalState() revenue.AdvertiserProposalState {
	return revenue.AdvertiserProposalState{
		ID: "proposal-1", ContactName: "Ama Mensah", ContactEmail: "ama@example.com",
		Campaign: campaignState(),
	}
}

func TestAdvertiserProposalOwnsAndSanitisesSubmission(t *testing.T) {
	state := proposalState()
	state.Campaign.ID, state.Campaign.Active = "forged", true
	proposal, err := revenue.NewAdvertiserProposal(advertiser(), state, now)
	if err != nil {
		t.Fatal(err)
	}
	got := proposal.State()
	if got.OwnerID != "advertiser-1" || got.Status != revenue.ProposalSubmitted || got.Campaign.ID != "" || got.Campaign.Active {
		t.Fatal(got)
	}
	if err = proposal.OwnedBy(advertiser()); err != nil {
		t.Fatal(err)
	}
	other := identity.NewActor("advertiser-2", []identity.Role{identity.RoleAdvertiser})
	if err = proposal.OwnedBy(other); !errors.Is(err, revenue.ErrProposalNotOwned) {
		t.Fatal(err)
	}
}

func TestAdvertiserProposalRejectsUnauthorizedOrInvalidSubmission(t *testing.T) {
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err := revenue.NewAdvertiserProposal(guest, proposalState(), now); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	cases := []struct {
		name string
		edit func(*revenue.AdvertiserProposalState)
		want error
	}{
		{"id", func(s *revenue.AdvertiserProposalState) { s.ID = "" }, shared.ErrEmptyID},
		{"name", func(s *revenue.AdvertiserProposalState) { s.ContactName = " " }, revenue.ErrAdvertiserContact},
		{"email", func(s *revenue.AdvertiserProposalState) { s.ContactEmail = "not-an-email" }, revenue.ErrAdvertiserContact},
		{"campaign", func(s *revenue.AdvertiserProposalState) { s.Campaign.Locale = "de" }, revenue.ErrInvalidAdLocale},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			state := proposalState()
			tc.edit(&state)
			_, err := revenue.NewAdvertiserProposal(advertiser(), state, now)
			if !errors.Is(err, tc.want) {
				t.Fatalf("got %v, want %v", err, tc.want)
			}
		})
	}
}

func TestAdvertiserProposalReviewIsFinalAndAuthorized(t *testing.T) {
	proposal, _ := revenue.NewAdvertiserProposal(advertiser(), proposalState(), now)
	if _, err := proposal.Approve(advertiser(), "campaign-1", now); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	if _, err := proposal.Approve(manager(), "", now); !errors.Is(err, shared.ErrEmptyID) {
		t.Fatal(err)
	}
	approved, err := proposal.Approve(manager(), "campaign-1", now)
	if err != nil || approved.State().CampaignID != "campaign-1" || approved.State().ReviewedAt == nil {
		t.Fatal(approved.State(), err)
	}
	if _, err = approved.Reject(manager(), "late", now); !errors.Is(err, revenue.ErrProposalReviewed) {
		t.Fatal(err)
	}
	rejected, err := proposal.Reject(manager(), "  Adjust targeting.  ", now)
	if err != nil || rejected.State().ReviewNote != "Adjust targeting." || rejected.State().CampaignID != "" {
		t.Fatal(rejected.State(), err)
	}
	restored := revenue.ReconstituteAdvertiserProposal(rejected.State())
	if restored.ID() != proposal.ID() {
		t.Fatal(restored.ID())
	}
}
