package revenue_test

import (
	"errors"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var now = time.Date(2026, 8, 31, 18, 0, 0, 0, time.UTC)

func manager() identity.Actor {
	return identity.NewActor("finance", []identity.Role{identity.RoleAdministrator})
}

func TestMoneyAcceptsSupportedCurrenciesAndPositiveMinorUnits(t *testing.T) {
	if _, err := revenue.NewMoney(0, revenue.CurrencyGHS); !errors.Is(err, revenue.ErrInvalidAmount) {
		t.Fatal(err)
	}
	if _, err := revenue.NewMoney(100, "USD"); !errors.Is(err, revenue.ErrUnsupportedCurrency) {
		t.Fatal(err)
	}
	money, err := revenue.NewMoney(3500, revenue.CurrencyGHS)
	if err != nil || money.Minor != 3500 || money.Currency != revenue.CurrencyGHS {
		t.Fatal(money, err)
	}
}

func TestMembershipPlanRequiresPermissionAndUsefulMetadata(t *testing.T) {
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	input := revenue.MembershipPlanState{ID: "supporter", Name: "Supporter", Slug: "supporter", Interval: revenue.IntervalMonthly, Price: revenue.Money{Minor: 3500, Currency: revenue.CurrencyGHS}, Benefits: []string{"Ad-light reading"}}
	if _, err := revenue.NewMembershipPlan(guest, input); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	input.Name = " "
	if _, err := revenue.NewMembershipPlan(manager(), input); !errors.Is(err, revenue.ErrEmptyPlanName) {
		t.Fatal(err)
	}
	input.Name = "Supporter"
	plan, err := revenue.NewMembershipPlan(manager(), input)
	if err != nil || plan.State().Active || plan.State().CreatedBy != "finance" {
		t.Fatal(err)
	}
	plan, err = plan.Activate(manager(), now)
	if err != nil || !plan.State().Active || plan.State().ActivatedAt == nil {
		t.Fatal(err)
	}
}

func TestMembershipPlanRejectsEveryIncompleteCommercialRule(t *testing.T) {
	base := revenue.MembershipPlanState{ID: "supporter", Name: "Supporter", Slug: "supporter", Interval: revenue.IntervalMonthly, Price: revenue.Money{Minor: 3500, Currency: revenue.CurrencyGHS}, Benefits: []string{"Briefings"}}
	cases := []struct {
		mutate func(*revenue.MembershipPlanState)
		want   error
	}{
		{func(s *revenue.MembershipPlanState) { s.Slug = " " }, revenue.ErrEmptyPlanSlug},
		{func(s *revenue.MembershipPlanState) { s.Interval = "weekly" }, revenue.ErrInvalidInterval},
		{func(s *revenue.MembershipPlanState) { s.Price.Minor = 0 }, revenue.ErrInvalidAmount},
		{func(s *revenue.MembershipPlanState) { s.Benefits = []string{" "} }, revenue.ErrPlanNeedsBenefits},
	}
	for _, tc := range cases {
		state := base
		tc.mutate(&state)
		if _, err := revenue.NewMembershipPlan(manager(), state); !errors.Is(err, tc.want) {
			t.Errorf("got %v, want %v", err, tc.want)
		}
	}
	plan := revenue.ReconstituteMembershipPlan(base)
	if plan.ID() != "supporter" {
		t.Fatal(plan.ID())
	}
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err := plan.Activate(guest, now); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
}

func TestSubscriptionActivatesOnlyAfterPaymentAndControlsEntitlement(t *testing.T) {
	state := revenue.SubscriptionState{ID: "sub_1", PlanID: "supporter", ReaderID: "reader", Price: revenue.Money{Minor: 3500, Currency: revenue.CurrencyGHS}, Provider: revenue.ProviderPaystack, ProviderRef: "checkout_1"}
	sub, err := revenue.StartSubscription(state, now)
	if err != nil || sub.State().Status != revenue.SubscriptionPending {
		t.Fatal(err)
	}
	if sub.EntitledAt(now) {
		t.Fatal("pending subscription must not grant entitlement")
	}
	sub, err = sub.ConfirmPayment("payment_1", now, now.Add(31*24*time.Hour))
	if err != nil || !sub.EntitledAt(now.Add(time.Hour)) {
		t.Fatal(err)
	}
	sub, err = sub.Cancel(now.Add(24 * time.Hour))
	if err != nil || sub.State().Status != revenue.SubscriptionCanceled || !sub.EntitledAt(now.Add(48*time.Hour)) {
		t.Fatal(err)
	}
	if sub.EntitledAt(now.Add(32 * 24 * time.Hour)) {
		t.Fatal("canceled subscription must expire at its paid-through date")
	}
}

func TestSubscriptionRejectsInvalidCheckoutAndTransitions(t *testing.T) {
	base := revenue.SubscriptionState{ID: "sub_1", PlanID: "supporter", ReaderID: "reader", Price: revenue.Money{Minor: 3500, Currency: revenue.CurrencyGHS}, Provider: revenue.ProviderPaystack, ProviderRef: "checkout_1"}
	cases := []struct {
		mutate func(*revenue.SubscriptionState)
		want   error
	}{
		{func(s *revenue.SubscriptionState) { s.ID = "" }, shared.ErrEmptyID},
		{func(s *revenue.SubscriptionState) { s.Price.Minor = 0 }, revenue.ErrInvalidAmount},
		{func(s *revenue.SubscriptionState) { s.Provider = "unknown" }, revenue.ErrInvalidProvider},
		{func(s *revenue.SubscriptionState) { s.ProviderRef = "" }, revenue.ErrMissingProviderRef},
	}
	for _, tc := range cases {
		state := base
		tc.mutate(&state)
		if _, err := revenue.StartSubscription(state, now); !errors.Is(err, tc.want) {
			t.Errorf("got %v, want %v", err, tc.want)
		}
	}
	base.Status = revenue.SubscriptionPending
	sub := revenue.ReconstituteSubscription(base)
	if sub.ID() != "sub_1" {
		t.Fatal(sub.ID())
	}
	if _, err := sub.ConfirmPayment("", now, now.Add(time.Hour)); !errors.Is(err, revenue.ErrMissingProviderRef) {
		t.Fatal(err)
	}
	if _, err := sub.ConfirmPayment("payment", now, now); !errors.Is(err, revenue.ErrInvalidPaidThrough) {
		t.Fatal(err)
	}
	if _, err := sub.Cancel(now); !errors.Is(err, revenue.ErrSubscriptionNotActive) {
		t.Fatal(err)
	}
	state := base
	state.Status = revenue.SubscriptionActive
	active := revenue.ReconstituteSubscription(state)
	if _, err := active.ConfirmPayment("payment", now, now.Add(time.Hour)); !errors.Is(err, revenue.ErrSubscriptionNotPending) {
		t.Fatal(err)
	}
}

func TestDonationIsPendingUntilAProviderConfirmsIt(t *testing.T) {
	donation, err := revenue.StartDonation(revenue.DonationState{ID: "don_1", Amount: revenue.Money{Minor: 5000, Currency: revenue.CurrencyGHS}, Provider: revenue.ProviderPaystack, ProviderRef: "checkout_1", Email: "reader@example.com"}, now)
	if err != nil || donation.State().Status != revenue.PaymentPending {
		t.Fatal(err)
	}
	donation, err = donation.Confirm("payment_1", now.Add(time.Minute))
	if err != nil || donation.State().Status != revenue.PaymentSucceeded || donation.State().PaidAt == nil {
		t.Fatal(err)
	}
	if _, err = donation.Confirm("payment_2", now.Add(2*time.Minute)); !errors.Is(err, revenue.ErrPaymentAlreadyFinal) {
		t.Fatal(err)
	}
}

func TestDonationRejectsInvalidCheckoutAndConfirmation(t *testing.T) {
	base := revenue.DonationState{ID: "don_1", Amount: revenue.Money{Minor: 5000, Currency: revenue.CurrencyGHS}, Provider: revenue.ProviderPaystack, ProviderRef: "checkout_1"}
	cases := []struct {
		mutate func(*revenue.DonationState)
		want   error
	}{
		{func(s *revenue.DonationState) { s.ID = "" }, shared.ErrEmptyID},
		{func(s *revenue.DonationState) { s.Amount.Minor = 0 }, revenue.ErrInvalidAmount},
		{func(s *revenue.DonationState) { s.Provider = "unknown" }, revenue.ErrInvalidProvider},
		{func(s *revenue.DonationState) { s.ProviderRef = "" }, revenue.ErrMissingProviderRef},
	}
	for _, tc := range cases {
		state := base
		tc.mutate(&state)
		if _, err := revenue.StartDonation(state, now); !errors.Is(err, tc.want) {
			t.Errorf("got %v, want %v", err, tc.want)
		}
	}
	base.Status = revenue.PaymentPending
	donation := revenue.ReconstituteDonation(base)
	if donation.ID() != "don_1" {
		t.Fatal(donation.ID())
	}
	if _, err := donation.Confirm("", now); !errors.Is(err, revenue.ErrMissingProviderRef) {
		t.Fatal(err)
	}
}

func TestEntitlementIsDomainOwned(t *testing.T) {
	article := shared.ArticleID("premium-story")
	access := revenue.ArticleAccess{ArticleID: article, Premium: true}
	if access.Allows(revenue.ReaderEntitlement{}, now) {
		t.Fatal("anonymous reader must not pass a premium rule")
	}
	if !access.Allows(revenue.ReaderEntitlement{SubscriptionActiveUntil: ptr(now.Add(time.Hour))}, now) {
		t.Fatal("paid reader should pass a premium rule")
	}
	if !(revenue.ArticleAccess{ArticleID: article}).Allows(revenue.ReaderEntitlement{}, now) {
		t.Fatal("free journalism must remain public")
	}
}

func ptr(value time.Time) *time.Time { return &value }
