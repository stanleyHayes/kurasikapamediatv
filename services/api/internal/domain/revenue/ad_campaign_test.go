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

/*
 * Campaigns were create-and-activate only: no way to correct a budget, a CPM,
 * a slot or a creative once saved. A placeholder figure was therefore
 * permanent, and the only remedy was editing Mongo by hand.
 */
func TestAdCampaignUpdate(t *testing.T) {
	start := time.Date(2026, 9, 9, 0, 0, 0, 0, time.UTC)
	original := revenue.AdCampaignState{
		ID: "adc_1", Name: "Benmar launch", Advertiser: "Benmar Cassava Foods",
		Locale: "*", Slot: revenue.SlotHomeLeaderboard,
		CreativeURL: "https://cdn.test/benmar.jpg", AltText: "Cassava flour carton",
		LandingURL: "https://www.tiktok.com/@benmar", Budget: revenue.Money{Minor: 10_000, Currency: revenue.CurrencyEUR},
		CPMMinor: 200, Priority: 50, StartsAt: start, EndsAt: start.Add(90 * 24 * time.Hour),
	}
	manager := identity.NewActor("admin", []identity.Role{identity.RoleAdministrator})
	outsider := identity.NewActor("reader", []identity.Role{identity.RoleGuest})
	campaign, err := revenue.NewAdCampaign(manager, original)
	if err != nil {
		t.Fatal(err)
	}

	t.Run("refuses an actor without revenue:manage", func(t *testing.T) {
		if _, updateErr := campaign.Update(outsider, original); !errors.Is(updateErr, identity.ErrNotPermitted) {
			t.Fatalf("got %v, want ErrNotPermitted", updateErr)
		}
	})

	t.Run("corrects the commercial terms", func(t *testing.T) {
		next := original
		next.Budget = revenue.Money{Minor: 250_000, Currency: revenue.CurrencyEUR}
		next.CPMMinor = 3_500
		updated, updateErr := campaign.Update(manager, next)
		if updateErr != nil {
			t.Fatal(updateErr)
		}
		state := updated.State()
		if state.Budget.Minor != 250_000 || state.CPMMinor != 3_500 {
			t.Fatalf("terms = %+v", state)
		}
	})

	t.Run("re-validates, so an edit cannot save what create would refuse", func(t *testing.T) {
		next := original
		next.CPMMinor = next.Budget.Minor + 1 // CPM above budget
		if _, updateErr := campaign.Update(manager, next); !errors.Is(updateErr, revenue.ErrInvalidAdRate) {
			t.Fatalf("got %v, want ErrInvalidAdRate", updateErr)
		}
		insecure := original
		insecure.LandingURL = "http://example.org"
		if _, updateErr := campaign.Update(manager, insecure); !errors.Is(updateErr, revenue.ErrInvalidAdURL) {
			t.Fatalf("got %v, want ErrInvalidAdURL", updateErr)
		}
	})

	/*
	 * An edit must not be a back door to going live. Activation has its own
	 * use case and its own already-ended check; letting a PATCH body set
	 * `active` would route around both.
	 */
	t.Run("never lets an edit change identity or activation", func(t *testing.T) {
		next := original
		now := start
		next.ID, next.CreatedBy = "hijacked", "someone-else"
		next.Active, next.ActivatedAt = true, &now
		updated, updateErr := campaign.Update(manager, next)
		if updateErr != nil {
			t.Fatal(updateErr)
		}
		state := updated.State()
		if state.ID != "adc_1" || state.Active || state.ActivatedAt != nil {
			t.Fatalf("identity or activation moved: %+v", state)
		}
	})

	t.Run("an already-active campaign keeps running while its terms are corrected", func(t *testing.T) {
		live, activateErr := campaign.Activate(manager, start)
		if activateErr != nil {
			t.Fatal(activateErr)
		}
		next := original
		next.Budget = revenue.Money{Minor: 500_000, Currency: revenue.CurrencyEUR}
		updated, updateErr := live.Update(manager, next)
		if updateErr != nil {
			t.Fatal(updateErr)
		}
		if !updated.State().Active || updated.State().Budget.Minor != 500_000 {
			t.Fatalf("state = %+v", updated.State())
		}
	})
}
