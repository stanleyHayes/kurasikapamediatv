package revenue_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	apprevenue "github.com/kurasikapa/api/internal/app/revenue"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainrevenue "github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var at = time.Date(2026, 8, 31, 19, 0, 0, 0, time.UTC)

type fixedClock struct{}

func (fixedClock) Now() time.Time { return at }

type ids struct{ next int }

func (i *ids) NewID() string { i.next++; return "id_" + string(rune('0'+i.next)) }

type planStore struct {
	rows map[shared.MembershipPlanID]domainrevenue.MembershipPlan
}

func (s *planStore) FindByID(_ context.Context, id shared.MembershipPlanID) (domainrevenue.MembershipPlan, error) {
	value, ok := s.rows[id]
	if !ok {
		return domainrevenue.MembershipPlan{}, ports.ErrNotFound
	}
	return value, nil
}
func (s *planStore) ListActive(context.Context) ([]domainrevenue.MembershipPlan, error) {
	out := []domainrevenue.MembershipPlan{}
	for _, value := range s.rows {
		if value.State().Active {
			out = append(out, value)
		}
	}
	return out, nil
}
func (s *planStore) Save(_ context.Context, value domainrevenue.MembershipPlan) error {
	s.rows[value.ID()] = value
	return nil
}

type subStore struct {
	rows map[shared.SubscriptionID]domainrevenue.Subscription
}

func (s *subStore) FindByID(_ context.Context, id shared.SubscriptionID) (domainrevenue.Subscription, error) {
	value, ok := s.rows[id]
	if !ok {
		return domainrevenue.Subscription{}, ports.ErrNotFound
	}
	return value, nil
}
func (s *subStore) FindEntitledForReader(_ context.Context, reader shared.UserID, now time.Time) (domainrevenue.Subscription, error) {
	for _, value := range s.rows {
		if value.State().ReaderID == reader && value.EntitledAt(now) {
			return value, nil
		}
	}
	return domainrevenue.Subscription{}, ports.ErrNotFound
}
func (s *subStore) Save(_ context.Context, value domainrevenue.Subscription) error {
	s.rows[value.ID()] = value
	return nil
}

type donationStore struct {
	rows map[shared.DonationID]domainrevenue.Donation
}

func (s *donationStore) FindByID(_ context.Context, id shared.DonationID) (domainrevenue.Donation, error) {
	value, ok := s.rows[id]
	if !ok {
		return domainrevenue.Donation{}, ports.ErrNotFound
	}
	return value, nil
}
func (s *donationStore) Save(_ context.Context, value domainrevenue.Donation) error {
	s.rows[value.ID()] = value
	return nil
}

type gateway struct {
	fail     bool
	requests []ports.CheckoutRequest
}

func (g *gateway) StartCheckout(_ context.Context, request ports.CheckoutRequest) (ports.CheckoutSession, error) {
	g.requests = append(g.requests, request)
	if g.fail {
		return ports.CheckoutSession{}, errors.New("gateway unavailable")
	}
	provider := domainrevenue.ProviderPaystack
	if request.Amount.Currency == domainrevenue.CurrencyEUR {
		provider = domainrevenue.ProviderStripe
	}
	return ports.CheckoutSession{Provider: provider, ProviderRef: "checkout_" + request.Reference, CheckoutURL: "https://pay.example/" + request.Reference}, nil
}

func deps() (apprevenue.Deps, *planStore, *subStore, *donationStore, *gateway) {
	plans := &planStore{rows: map[shared.MembershipPlanID]domainrevenue.MembershipPlan{}}
	subs := &subStore{rows: map[shared.SubscriptionID]domainrevenue.Subscription{}}
	donations := &donationStore{rows: map[shared.DonationID]domainrevenue.Donation{}}
	payments := &gateway{}
	return apprevenue.Deps{Plans: plans, Subscriptions: subs, Donations: donations, Payments: payments, Clock: fixedClock{}, IDs: &ids{}}, plans, subs, donations, payments
}

func admin() identity.Actor {
	return identity.NewActor("admin", []identity.Role{identity.RoleAdministrator})
}

func TestCreateAndActivateMembershipPlan(t *testing.T) {
	d, plans, _, _, _ := deps()
	plan, err := apprevenue.NewCreateMembershipPlan(d).Execute(context.Background(), admin(), domainrevenue.MembershipPlanState{Name: "Supporter", Slug: "supporter", Interval: domainrevenue.IntervalMonthly, Price: domainrevenue.Money{Minor: 3500, Currency: domainrevenue.CurrencyGHS}, Benefits: []string{"Member briefings"}})
	if err != nil || plan.ID() != "id_1" {
		t.Fatal(err)
	}
	plan, err = apprevenue.NewActivateMembershipPlan(d).Execute(context.Background(), admin(), plan.ID())
	if err != nil || !plan.State().Active || len(plans.rows) != 1 {
		t.Fatal(err)
	}
}

func TestStartMembershipCreatesPendingCheckoutWithoutGrantingAccess(t *testing.T) {
	d, plans, subs, _, payments := deps()
	plan := domainrevenue.ReconstituteMembershipPlan(domainrevenue.MembershipPlanState{ID: "supporter", Name: "Supporter", Active: true, Interval: domainrevenue.IntervalMonthly, Price: domainrevenue.Money{Minor: 3500, Currency: domainrevenue.CurrencyGHS}})
	plans.rows[plan.ID()] = plan
	result, err := apprevenue.NewStartSubscription(d).Execute(context.Background(), apprevenue.StartSubscriptionInput{PlanID: plan.ID(), ReaderID: "reader", Email: "reader@example.com", ReturnURL: "https://kurasikapa.tv/account"})
	if err != nil || result.CheckoutURL == "" || len(subs.rows) != 1 || len(payments.requests) != 1 {
		t.Fatal(result, err)
	}
	allowed, err := apprevenue.NewCheckEntitlement(d).Execute(context.Background(), "reader", at)
	if err != nil || allowed {
		t.Fatal(allowed, err)
	}
}

func TestInactivePlanAndGatewayFailureDoNotPersistSubscription(t *testing.T) {
	d, plans, subs, _, payments := deps()
	plan := domainrevenue.ReconstituteMembershipPlan(domainrevenue.MembershipPlanState{ID: "draft", Name: "Draft", Price: domainrevenue.Money{Minor: 3500, Currency: domainrevenue.CurrencyGHS}})
	plans.rows[plan.ID()] = plan
	input := apprevenue.StartSubscriptionInput{PlanID: plan.ID(), ReaderID: "reader", Email: "reader@example.com", ReturnURL: "https://kurasikapa.tv/account"}
	if _, err := apprevenue.NewStartSubscription(d).Execute(context.Background(), input); !errors.Is(err, apprevenue.ErrPlanInactive) {
		t.Fatal(err)
	}
	state := plan.State()
	state.Active = true
	plans.rows[plan.ID()] = domainrevenue.ReconstituteMembershipPlan(state)
	payments.fail = true
	if _, err := apprevenue.NewStartSubscription(d).Execute(context.Background(), input); err == nil || len(subs.rows) != 0 {
		t.Fatal(err)
	}
}

func TestStartDonationUsesProviderCheckoutAndPersistsPendingOnlyAfterSuccess(t *testing.T) {
	d, _, _, donations, payments := deps()
	result, err := apprevenue.NewRecordDonation(d).Execute(context.Background(), apprevenue.RecordDonationInput{Amount: domainrevenue.Money{Minor: 1000, Currency: domainrevenue.CurrencyEUR}, Email: "reader@example.com", ReturnURL: "https://kurasikapa.tv/support"})
	if err != nil || result.Provider != domainrevenue.ProviderStripe || len(donations.rows) != 1 {
		t.Fatal(result, err)
	}
	payments.fail = true
	if _, err = apprevenue.NewRecordDonation(d).Execute(context.Background(), apprevenue.RecordDonationInput{Amount: domainrevenue.Money{Minor: 5000, Currency: domainrevenue.CurrencyGHS}}); err == nil || len(donations.rows) != 1 {
		t.Fatal(err)
	}
}

func TestConfirmedPaymentsBecomeEntitlementsAndAreIdempotent(t *testing.T) {
	d, plans, subs, donations, _ := deps()
	plan := domainrevenue.ReconstituteMembershipPlan(domainrevenue.MembershipPlanState{ID: "supporter", Name: "Supporter", Active: true, Interval: domainrevenue.IntervalMonthly, Price: domainrevenue.Money{Minor: 3500, Currency: domainrevenue.CurrencyGHS}})
	plans.rows[plan.ID()] = plan
	pending, _ := domainrevenue.StartSubscription(domainrevenue.SubscriptionState{ID: "sub_1", PlanID: plan.ID(), ReaderID: "reader", Price: plan.State().Price, Provider: domainrevenue.ProviderPaystack, ProviderRef: "checkout_1"}, at)
	subs.rows[pending.ID()] = pending
	confirmed, err := apprevenue.NewConfirmSubscriptionPayment(d).Execute(context.Background(), pending.ID(), "payment_1")
	if err != nil || !confirmed.EntitledAt(at.Add(20*24*time.Hour)) {
		t.Fatal(err)
	}
	if _, err = apprevenue.NewConfirmSubscriptionPayment(d).Execute(context.Background(), pending.ID(), "payment_1"); err != nil {
		t.Fatal(err)
	}
	donation, _ := domainrevenue.StartDonation(domainrevenue.DonationState{ID: "don_1", Amount: domainrevenue.Money{Minor: 5000, Currency: domainrevenue.CurrencyGHS}, Provider: domainrevenue.ProviderPaystack, ProviderRef: "don_checkout"}, at)
	donations.rows[donation.ID()] = donation
	if _, err = apprevenue.NewConfirmDonationPayment(d).Execute(context.Background(), donation.ID(), "don_payment"); err != nil {
		t.Fatal(err)
	}
	if _, err = apprevenue.NewConfirmDonationPayment(d).Execute(context.Background(), donation.ID(), "don_payment"); err != nil {
		t.Fatal(err)
	}
}

func TestRevenueQueriesAndMissingResourcesPropagateHonestly(t *testing.T) {
	d, plans, subs, _, _ := deps()
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	input := domainrevenue.MembershipPlanState{Name: "Supporter", Slug: "supporter", Interval: domainrevenue.IntervalMonthly, Price: domainrevenue.Money{Minor: 3500, Currency: domainrevenue.CurrencyGHS}, Benefits: []string{"Briefings"}}
	if _, err := apprevenue.NewCreateMembershipPlan(d).Execute(context.Background(), guest, input); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	if _, err := apprevenue.NewActivateMembershipPlan(d).Execute(context.Background(), admin(), "missing"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal(err)
	}
	plan := domainrevenue.ReconstituteMembershipPlan(domainrevenue.MembershipPlanState{ID: "supporter", Name: "Supporter", Active: true, Interval: domainrevenue.IntervalMonthly, Price: input.Price})
	plans.rows[plan.ID()] = plan
	listed, err := apprevenue.NewListMembershipPlans(d).Execute(context.Background())
	if err != nil || len(listed) != 1 {
		t.Fatal(listed, err)
	}
	if _, err = apprevenue.NewConfirmSubscriptionPayment(d).Execute(context.Background(), "missing", "payment"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal(err)
	}
	if _, err = apprevenue.NewConfirmDonationPayment(d).Execute(context.Background(), "missing", "payment"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal(err)
	}
	pending, _ := domainrevenue.StartSubscription(domainrevenue.SubscriptionState{ID: "orphan", PlanID: "missing-plan", ReaderID: "reader", Price: input.Price, Provider: domainrevenue.ProviderPaystack, ProviderRef: "orphan-checkout"}, at)
	subs.rows[pending.ID()] = pending
	if _, err = apprevenue.NewConfirmSubscriptionPayment(d).Execute(context.Background(), pending.ID(), "payment"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal(err)
	}
	if _, err = apprevenue.NewRecordDonation(d).Execute(context.Background(), apprevenue.RecordDonationInput{Amount: domainrevenue.Money{Minor: 0, Currency: domainrevenue.CurrencyGHS}}); !errors.Is(err, domainrevenue.ErrInvalidAmount) {
		t.Fatal(err)
	}
	paidThrough := at.Add(time.Hour)
	paidAt := at.Add(-time.Hour)
	subs.rows["active"] = domainrevenue.ReconstituteSubscription(domainrevenue.SubscriptionState{ID: "active", PlanID: plan.ID(), ReaderID: "reader", Price: input.Price, Provider: domainrevenue.ProviderPaystack, ProviderRef: "checkout", PaymentRef: "payment", Status: domainrevenue.SubscriptionActive, PaidAt: &paidAt, PaidThrough: &paidThrough})
	allowed, err := apprevenue.NewCheckEntitlement(d).Execute(context.Background(), "reader", at)
	if err != nil || !allowed {
		t.Fatal(allowed, err)
	}
}
