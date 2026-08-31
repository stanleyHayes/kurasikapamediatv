package revenue_test

import (
	"context"
	"errors"
	"sort"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	apprevenue "github.com/kurasikapa/api/internal/app/revenue"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainrevenue "github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type campaignStore struct {
	rows map[shared.AdCampaignID]domainrevenue.AdCampaign
	err  error
}

func (s *campaignStore) FindByID(_ context.Context, id shared.AdCampaignID) (domainrevenue.AdCampaign, error) {
	if s.err != nil {
		return domainrevenue.AdCampaign{}, s.err
	}
	value, ok := s.rows[id]
	if !ok {
		return domainrevenue.AdCampaign{}, ports.ErrNotFound
	}
	return value, nil
}
func (s *campaignStore) ListEligible(_ context.Context, slot domainrevenue.AdSlot, locale string, now time.Time, limit int) ([]domainrevenue.AdCampaign, error) {
	if s.err != nil {
		return nil, s.err
	}
	out := make([]domainrevenue.AdCampaign, 0, limit)
	for _, value := range s.rows {
		state := value.State()
		if state.Active && state.Slot == slot && (state.Locale == locale || state.Locale == "*") && !now.Before(state.StartsAt) && now.Before(state.EndsAt) {
			out = append(out, value)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].State().Priority > out[j].State().Priority })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}
func (s *campaignStore) ListAll(_ context.Context, limit int) ([]domainrevenue.AdCampaign, error) {
	if s.err != nil {
		return nil, s.err
	}
	out := make([]domainrevenue.AdCampaign, 0, limit)
	for _, value := range s.rows {
		out = append(out, value)
	}
	return out, nil
}
func (s *campaignStore) Save(_ context.Context, value domainrevenue.AdCampaign) error {
	if s.err != nil {
		return s.err
	}
	s.rows[value.ID()] = value
	return nil
}

type eventStore struct {
	rows []domainrevenue.AdEvent
	err  error
}

func (s *eventStore) CountForCampaign(_ context.Context, id shared.AdCampaignID, kind domainrevenue.AdEventKind) (int64, error) {
	if s.err != nil {
		return 0, s.err
	}
	var count int64
	for _, event := range s.rows {
		if event.CampaignID == id && event.Kind == kind {
			count++
		}
	}
	return count, nil
}
func (s *eventStore) Append(_ context.Context, event domainrevenue.AdEvent) error {
	if s.err != nil {
		return s.err
	}
	s.rows = append(s.rows, event)
	return nil
}

func advertisingDeps() (apprevenue.Deps, *campaignStore, *eventStore) {
	campaigns := &campaignStore{rows: map[shared.AdCampaignID]domainrevenue.AdCampaign{}}
	events := &eventStore{}
	return apprevenue.Deps{AdCampaigns: campaigns, AdEvents: events, Clock: fixedClock{}, IDs: &ids{}}, campaigns, events
}

func adInput() domainrevenue.AdCampaignState {
	return domainrevenue.AdCampaignState{Name: "Launch", Advertiser: "Acme Ghana", Locale: "en", Slot: domainrevenue.SlotHomeLeaderboard, CreativeURL: "https://cdn.example/ad.jpg", AltText: "Acme solar systems", LandingURL: "https://example.com", Budget: domainrevenue.Money{Minor: 10000, Currency: domainrevenue.CurrencyGHS}, CPMMinor: 1000, Priority: 90, StartsAt: at.Add(-time.Hour), EndsAt: at.Add(24 * time.Hour)}
}

func TestAdvertisingLifecyclePlacementEventsAndReport(t *testing.T) {
	d, campaigns, events := advertisingDeps()
	campaign, err := apprevenue.NewCreateAdCampaign(d).Execute(context.Background(), admin(), adInput())
	if err != nil {
		t.Fatal(err)
	}
	campaign, err = apprevenue.NewActivateAdCampaign(d).Execute(context.Background(), admin(), campaign.ID())
	if err != nil || !campaign.State().Active {
		t.Fatal(err)
	}
	placement, err := apprevenue.NewResolveAdPlacement(d).Execute(context.Background(), domainrevenue.SlotHomeLeaderboard, "en")
	if err != nil || placement == nil || len(campaigns.rows) != 1 {
		t.Fatal(placement, err)
	}
	if _, err = apprevenue.NewRecordAdEvent(d).Execute(context.Background(), campaign.ID(), domainrevenue.AdImpression); err != nil {
		t.Fatal(err)
	}
	if _, err = apprevenue.NewRecordAdEvent(d).Execute(context.Background(), campaign.ID(), domainrevenue.AdClick); err != nil {
		t.Fatal(err)
	}
	report, err := apprevenue.NewBuildAdReport(d).Execute(context.Background(), admin())
	if err != nil || len(report) != 1 || report[0].CTR != 100 || len(events.rows) != 2 {
		t.Fatal(report, err)
	}
}

func TestAdvertisingRejectsUnauthorizedReportsAndMissingCampaignEvents(t *testing.T) {
	d, _, _ := advertisingDeps()
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err := apprevenue.NewCreateAdCampaign(d).Execute(context.Background(), guest, adInput()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	if _, err := apprevenue.NewActivateAdCampaign(d).Execute(context.Background(), admin(), "missing"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal(err)
	}
	if _, err := apprevenue.NewBuildAdReport(d).Execute(context.Background(), guest); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	if _, err := apprevenue.NewRecordAdEvent(d).Execute(context.Background(), "missing", domainrevenue.AdClick); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal(err)
	}
	campaign, _ := apprevenue.NewCreateAdCampaign(d).Execute(context.Background(), admin(), adInput())
	if _, err := apprevenue.NewRecordAdEvent(d).Execute(context.Background(), campaign.ID(), "view"); !errors.Is(err, domainrevenue.ErrInvalidAdEvent) {
		t.Fatal(err)
	}
}

func TestAdvertisingPropagatesRepositoryFailures(t *testing.T) {
	d, campaigns, events := advertisingDeps()
	failure := errors.New("store unavailable")
	campaigns.err = failure
	if _, err := apprevenue.NewCreateAdCampaign(d).Execute(context.Background(), admin(), adInput()); !errors.Is(err, failure) {
		t.Fatal(err)
	}
	if _, err := apprevenue.NewResolveAdPlacement(d).Execute(context.Background(), domainrevenue.SlotHomeLeaderboard, "en"); !errors.Is(err, failure) {
		t.Fatal(err)
	}
	if _, err := apprevenue.NewBuildAdReport(d).Execute(context.Background(), admin()); !errors.Is(err, failure) {
		t.Fatal(err)
	}
	campaigns.err = nil
	campaign, _ := apprevenue.NewCreateAdCampaign(d).Execute(context.Background(), admin(), adInput())
	campaign, _ = apprevenue.NewActivateAdCampaign(d).Execute(context.Background(), admin(), campaign.ID())
	events.err = failure
	if _, err := apprevenue.NewResolveAdPlacement(d).Execute(context.Background(), domainrevenue.SlotHomeLeaderboard, "en"); !errors.Is(err, failure) {
		t.Fatal(err)
	}
	if _, err := apprevenue.NewRecordAdEvent(d).Execute(context.Background(), campaign.ID(), domainrevenue.AdClick); !errors.Is(err, failure) {
		t.Fatal(err)
	}
	if _, err := apprevenue.NewBuildAdReport(d).Execute(context.Background(), admin()); !errors.Is(err, failure) {
		t.Fatal(err)
	}
}
