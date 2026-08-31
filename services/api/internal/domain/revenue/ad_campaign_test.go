package revenue_test

import (
	"errors"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var at = time.Date(2026, time.August, 31, 12, 0, 0, 0, time.UTC)

func campaignState() revenue.AdCampaignState {
	return revenue.AdCampaignState{ID: "campaign_1", Name: "Launch campaign", Advertiser: "Acme Ghana", Locale: "en", Slot: revenue.SlotHomeLeaderboard, CreativeURL: "https://cdn.example.com/ad.jpg", AltText: "Acme solar systems", LandingURL: "https://example.com/solar", Budget: revenue.Money{Minor: 100000, Currency: revenue.CurrencyGHS}, CPMMinor: 2500, Priority: 80, StartsAt: at, EndsAt: at.Add(30 * 24 * time.Hour)}
}

func TestAdCampaignRequiresTrustedAccessibleCommercialInput(t *testing.T) {
	admin := identity.NewActor("admin", []identity.Role{identity.RoleAdministrator})
	campaign, err := revenue.NewAdCampaign(admin, campaignState())
	if err != nil || campaign.State().Active {
		t.Fatal(campaign, err)
	}
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err = revenue.NewAdCampaign(guest, campaignState()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	invalid := campaignState()
	invalid.CreativeURL = "http://example.com/ad.jpg"
	if _, err = revenue.NewAdCampaign(admin, invalid); !errors.Is(err, revenue.ErrInvalidAdURL) {
		t.Fatal(err)
	}
}

func TestAdCampaignActivationEligibilityAndBudget(t *testing.T) {
	admin := identity.NewActor("admin", []identity.Role{identity.RoleAdministrator})
	campaign, _ := revenue.NewAdCampaign(admin, campaignState())
	campaign, err := campaign.Activate(admin, at)
	if err != nil || !campaign.Eligible(revenue.SlotHomeLeaderboard, "en", at, 1000) {
		t.Fatal(err)
	}
	if campaign.Eligible(revenue.SlotHomeLeaderboard, "fr", at, 1000) {
		t.Fatal("wrong locale served")
	}
	if campaign.EstimatedSpend(1000) != 2500 {
		t.Fatal(campaign.EstimatedSpend(1000))
	}
	if campaign.Eligible(revenue.SlotHomeLeaderboard, "en", at, 40000) {
		t.Fatal("exhausted campaign served")
	}
}

func TestAdEventsAreTypedAndImmutableValues(t *testing.T) {
	event, err := revenue.NewAdEvent("event_1", "campaign_1", revenue.AdImpression, at)
	if err != nil || event.Kind != revenue.AdImpression {
		t.Fatal(event, err)
	}
	if _, err = revenue.NewAdEvent("event_2", "campaign_1", "view", at); !errors.Is(err, revenue.ErrInvalidAdEvent) {
		t.Fatal(err)
	}
}

func TestAdCampaignValidationBranchesAndReconstitution(t *testing.T) {
	admin := identity.NewActor("admin", []identity.Role{identity.RoleAdministrator})
	tests := []struct {
		name string
		edit func(*revenue.AdCampaignState)
		want error
	}{
		{"empty id", func(s *revenue.AdCampaignState) { s.ID = "" }, shared.ErrEmptyID},
		{"incomplete", func(s *revenue.AdCampaignState) { s.Name = " " }, revenue.ErrIncompleteCampaign},
		{"slot", func(s *revenue.AdCampaignState) { s.Slot = "sidebar" }, revenue.ErrInvalidAdSlot},
		{"locale", func(s *revenue.AdCampaignState) { s.Locale = "de" }, nil},
		{"money", func(s *revenue.AdCampaignState) { s.Budget.Minor = 0 }, revenue.ErrInvalidAmount},
		{"rate", func(s *revenue.AdCampaignState) { s.CPMMinor = 100001 }, revenue.ErrInvalidAdRate},
		{"window", func(s *revenue.AdCampaignState) { s.EndsAt = s.StartsAt }, revenue.ErrInvalidAdWindow},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			state := campaignState()
			tc.edit(&state)
			_, err := revenue.NewAdCampaign(admin, state)
			if tc.want == nil {
				if err == nil {
					t.Fatal("expected validation error")
				}
				return
			}
			if !errors.Is(err, tc.want) {
				t.Fatal(err)
			}
		})
	}
	state := campaignState()
	state.Priority = 0
	campaign, err := revenue.NewAdCampaign(admin, state)
	if err != nil || campaign.State().Priority != 50 {
		t.Fatal(campaign.State(), err)
	}
	restored := revenue.ReconstituteAdCampaign(campaign.State())
	if restored.ID() != campaign.ID() {
		t.Fatal(restored.ID())
	}
}

func TestAdCampaignActivationRejectsUnauthorizedAndEndedCampaigns(t *testing.T) {
	admin := identity.NewActor("admin", []identity.Role{identity.RoleAdministrator})
	campaign, _ := revenue.NewAdCampaign(admin, campaignState())
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err := campaign.Activate(guest, at); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	if _, err := campaign.Activate(admin, campaign.State().EndsAt); !errors.Is(err, revenue.ErrCampaignEnded) {
		t.Fatal(err)
	}
	if _, err := revenue.NewAdEvent("", campaign.ID(), revenue.AdClick, at); !errors.Is(err, shared.ErrEmptyID) {
		t.Fatal(err)
	}
}
