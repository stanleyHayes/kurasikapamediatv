package revenue_test

import (
	"context"
	"errors"
	"testing"

	"github.com/kurasikapa/api/internal/app/ports"
	apprevenue "github.com/kurasikapa/api/internal/app/revenue"
	fakes "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainrevenue "github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func advertiserActor(id string) identity.Actor {
	return identity.NewActor(identityID(id), []identity.Role{identity.RoleAdvertiser})
}

func identityID(id string) shared.UserID { return shared.UserID(id) }

func proposalInput() domainrevenue.AdvertiserProposalState {
	return domainrevenue.AdvertiserProposalState{
		ContactName: "Ama Mensah", ContactEmail: "ama@example.com", Campaign: adInput(),
	}
}

func advertiserDeps() (apprevenue.Deps, *fakes.AdvertiserProposalStore, *fakes.AdCampaignStore) {
	campaigns := fakes.NewAdCampaignStore()
	proposals := fakes.NewAdvertiserProposalStore(campaigns)
	return apprevenue.Deps{AdvertiserProposals: proposals, AdCampaigns: campaigns, Clock: fixedClock{}, IDs: &ids{}}, proposals, campaigns
}

func TestAdvertiserSelfServiceSubmitListAndApprove(t *testing.T) {
	deps, proposals, campaigns := advertiserDeps()
	actor := advertiserActor("advertiser-1")
	proposal, err := apprevenue.NewSubmitAdvertiserProposal(deps).Execute(context.Background(), actor, proposalInput())
	if err != nil || proposal.State().OwnerID != actor.ID() {
		t.Fatal(proposal.State(), err)
	}
	owned, err := apprevenue.NewListOwnAdvertiserProposals(deps).Execute(context.Background(), actor)
	if err != nil || len(owned) != 1 {
		t.Fatal(owned, err)
	}
	queue, err := apprevenue.NewListAdvertiserProposalQueue(deps).Execute(context.Background(), admin())
	if err != nil || len(queue) != 1 {
		t.Fatal(queue, err)
	}
	approved, err := apprevenue.NewApproveAdvertiserProposal(deps).Execute(context.Background(), admin(), proposal.ID())
	if err != nil || approved.State().Status != domainrevenue.ProposalApproved || len(campaigns.Items) != 1 {
		t.Fatal(approved.State(), err)
	}
	for _, campaign := range campaigns.Items {
		if !campaign.State().Active || campaign.State().CreatedBy != admin().ID() {
			t.Fatal(campaign.State())
		}
	}
	if _, err = apprevenue.NewApproveAdvertiserProposal(deps).Execute(context.Background(), admin(), proposal.ID()); !errors.Is(err, domainrevenue.ErrProposalReviewed) || len(campaigns.Items) != 1 {
		t.Fatal(err, len(campaigns.Items))
	}
	if len(proposals.Items) != 1 {
		t.Fatal(proposals.Items)
	}
}

func TestAdvertiserSelfServiceRejectsUnauthorizedAndStorageFailures(t *testing.T) {
	deps, proposals, _ := advertiserDeps()
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err := apprevenue.NewSubmitAdvertiserProposal(deps).Execute(context.Background(), guest, proposalInput()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	if _, err := apprevenue.NewListOwnAdvertiserProposals(deps).Execute(context.Background(), guest); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	if _, err := apprevenue.NewListAdvertiserProposalQueue(deps).Execute(context.Background(), guest); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	actor := advertiserActor("advertiser-1")
	proposal, _ := apprevenue.NewSubmitAdvertiserProposal(deps).Execute(context.Background(), actor, proposalInput())
	rejected, err := apprevenue.NewRejectAdvertiserProposal(deps).Execute(context.Background(), admin(), proposal.ID(), "Update the creative.")
	if err != nil || rejected.State().Status != domainrevenue.ProposalRejected {
		t.Fatal(rejected.State(), err)
	}
	if _, err = apprevenue.NewRejectAdvertiserProposal(deps).Execute(context.Background(), admin(), "missing", "No"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal(err)
	}
	proposals.Err = errors.New("storage unavailable")
	if _, err = apprevenue.NewListOwnAdvertiserProposals(deps).Execute(context.Background(), actor); err == nil {
		t.Fatal("expected storage error")
	}
}
