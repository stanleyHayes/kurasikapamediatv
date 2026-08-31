package mongo_test

import (
	"context"
	"errors"
	"testing"
	"time"

	adapter "github.com/kurasikapa/api/internal/adapter/mongo"
	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestRevenueRepositoriesRoundTripAndResolveEntitlement(t *testing.T) {
	t.Parallel()
	h := newHarness(t)
	ctx := context.Background()
	plans := adapter.NewMembershipPlanRepository(h.DB)
	subscriptions := adapter.NewSubscriptionRepository(h.DB)
	donations := adapter.NewDonationRepository(h.DB)

	activated := testNow.Add(-time.Hour)
	plan := revenue.ReconstituteMembershipPlan(revenue.MembershipPlanState{ID: "supporter", Name: "Supporter", Slug: "supporter", Interval: revenue.IntervalMonthly, Price: revenue.Money{Minor: 3500, Currency: revenue.CurrencyGHS}, Benefits: []string{"Member briefings"}, Active: true, ActivatedAt: &activated, CreatedBy: "admin"})
	if err := plans.Save(ctx, plan); err != nil {
		t.Fatal(err)
	}
	listed, err := plans.ListActive(ctx)
	if err != nil || len(listed) != 1 || listed[0].State().Benefits[0] != "Member briefings" {
		t.Fatal(listed, err)
	}

	paidThrough := testNow.Add(30 * 24 * time.Hour)
	paidAt := testNow.Add(-time.Hour)
	sub := revenue.ReconstituteSubscription(revenue.SubscriptionState{ID: "sub_1", PlanID: plan.ID(), ReaderID: "reader", Price: plan.State().Price, Provider: revenue.ProviderPaystack, ProviderRef: "checkout_1", PaymentRef: "payment_1", Status: revenue.SubscriptionActive, StartedAt: testNow.Add(-2 * time.Hour), PaidAt: &paidAt, PaidThrough: &paidThrough})
	if err = subscriptions.Save(ctx, sub); err != nil {
		t.Fatal(err)
	}
	got, err := subscriptions.FindEntitledForReader(ctx, "reader", testNow)
	if err != nil || got.ID() != "sub_1" {
		t.Fatal(got, err)
	}
	if _, err = subscriptions.FindEntitledForReader(ctx, "reader", paidThrough); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal(err)
	}

	donation := revenue.ReconstituteDonation(revenue.DonationState{ID: "don_1", Amount: revenue.Money{Minor: 5000, Currency: revenue.CurrencyGHS}, Provider: revenue.ProviderPaystack, ProviderRef: "don_checkout_1", PaymentRef: "don_payment_1", Email: "reader@example.com", Status: revenue.PaymentSucceeded, StartedAt: paidAt, PaidAt: &testNow})
	if err = donations.Save(ctx, donation); err != nil {
		t.Fatal(err)
	}
	gotDonation, err := donations.FindByID(ctx, shared.DonationID("don_1"))
	if err != nil || gotDonation.State().PaymentRef != "don_payment_1" {
		t.Fatal(err)
	}
}

func TestRevenueIndexesAreNamedAndProviderReferencesUnique(t *testing.T) {
	t.Parallel()
	h := newHarness(t)
	ctx := context.Background()
	plans := adapter.NewMembershipPlanRepository(h.DB)
	subscriptions := adapter.NewSubscriptionRepository(h.DB)
	donations := adapter.NewDonationRepository(h.DB)
	for _, ensure := range []func(context.Context) error{plans.EnsureIndexes, subscriptions.EnsureIndexes, donations.EnsureIndexes} {
		if err := ensure(ctx); err != nil {
			t.Fatal(err)
		}
	}
	checks := map[string][]string{
		adapter.CollMembershipPlans: {"membership_slug_unique", "active_membership_plans"},
		adapter.CollSubscriptions:   {"subscription_provider_ref_unique", "reader_entitlement"},
		adapter.CollDonations:       {"donation_provider_ref_unique", "donation_revenue_recent"},
	}
	for collection, expected := range checks {
		names := indexNames(t, h, collection)
		for _, name := range expected {
			if !names[name] {
				t.Errorf("%s missing %s", collection, name)
			}
		}
	}
	base := revenue.ReconstituteDonation(revenue.DonationState{ID: "don_a", Amount: revenue.Money{Minor: 1000, Currency: revenue.CurrencyGHS}, Provider: revenue.ProviderPaystack, ProviderRef: "same", Status: revenue.PaymentPending, StartedAt: testNow})
	if err := donations.Save(ctx, base); err != nil {
		t.Fatal(err)
	}
	state := base.State()
	state.ID = "don_b"
	if err := donations.Save(ctx, revenue.ReconstituteDonation(state)); err == nil {
		t.Fatal("duplicate provider reference accepted")
	}
}
