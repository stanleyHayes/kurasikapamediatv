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
	sub := revenue.ReconstituteSubscription(revenue.SubscriptionState{ID: "sub_1", PlanID: plan.ID(), ReaderID: "reader", Email: "reader@example.com", Price: plan.State().Price, Provider: revenue.ProviderPaystack, ProviderRef: "checkout_1", PaymentRef: "payment_1", Status: revenue.SubscriptionActive, StartedAt: testNow.Add(-2 * time.Hour), PaidAt: &paidAt, PaidThrough: &paidThrough})
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
	recentSubscriptions, err := subscriptions.ListRecent(ctx, testNow.Add(-24*time.Hour), 10)
	if err != nil || len(recentSubscriptions) != 1 || recentSubscriptions[0].State().Email != "reader@example.com" {
		t.Fatal(recentSubscriptions, err)
	}

	donation := revenue.ReconstituteDonation(revenue.DonationState{ID: "don_1", Amount: revenue.Money{Minor: 5000, Currency: revenue.CurrencyGHS}, Provider: revenue.ProviderPaystack, ProviderRef: "don_checkout_1", PaymentRef: "don_payment_1", Email: "reader@example.com", Status: revenue.PaymentSucceeded, StartedAt: paidAt, PaidAt: &testNow})
	if err = donations.Save(ctx, donation); err != nil {
		t.Fatal(err)
	}
	gotDonation, err := donations.FindByID(ctx, shared.DonationID("don_1"))
	if err != nil || gotDonation.State().PaymentRef != "don_payment_1" {
		t.Fatal(err)
	}
	recentDonations, err := donations.ListRecent(ctx, testNow.Add(-24*time.Hour), 10)
	if err != nil || len(recentDonations) != 1 {
		t.Fatal(recentDonations, err)
	}
}

func TestRevenueIndexesAreNamedAndProviderReferencesUnique(t *testing.T) {
	t.Parallel()
	h := newHarness(t)
	ctx := context.Background()
	plans := adapter.NewMembershipPlanRepository(h.DB)
	subscriptions := adapter.NewSubscriptionRepository(h.DB)
	donations := adapter.NewDonationRepository(h.DB)
	adCampaigns := adapter.NewAdCampaignRepository(h.DB)
	adEvents := adapter.NewAdEventRepository(h.DB)
	products := adapter.NewProductRepository(h.DB)
	orders := adapter.NewProductOrderRepository(h.DB)
	classifieds := adapter.NewClassifiedRepository(h.DB)
	affiliates := adapter.NewAffiliateLinkRepository(h.DB)
	proposals := adapter.NewAdvertiserProposalRepository(h.DB)
	for _, ensure := range []func(context.Context) error{plans.EnsureIndexes, subscriptions.EnsureIndexes, donations.EnsureIndexes, adCampaigns.EnsureIndexes, adEvents.EnsureIndexes, products.EnsureIndexes, orders.EnsureIndexes, classifieds.EnsureIndexes, affiliates.EnsureIndexes, proposals.EnsureIndexes} {
		if err := ensure(ctx); err != nil {
			t.Fatal(err)
		}
	}
	checks := map[string][]string{
		adapter.CollMembershipPlans:     {"membership_slug_unique", "active_membership_plans"},
		adapter.CollSubscriptions:       {"subscription_provider_ref_unique", "reader_entitlement", "revenue_subscribers_recent"},
		adapter.CollDonations:           {"donation_provider_ref_unique", "donation_revenue_recent", "donation_checkout_recent"},
		adapter.CollAdCampaigns:         {"eligible_ad_campaigns"},
		adapter.CollAdEvents:            {"campaign_event_counts"},
		adapter.CollProducts:            {"product_slug_unique", "product_sku_unique", "active_product_inventory"},
		adapter.CollProductOrders:       {"product_order_provider_ref_unique", "product_orders_recent"},
		adapter.CollClassifieds:         {"published_classified_expiry", "classified_provider_ref_unique"},
		adapter.CollAffiliateLinks:      {"affiliate_destination_unique", "active_affiliate_category"},
		adapter.CollAdvertiserProposals: {"advertiser_proposals_owner", "advertiser_proposal_queue"},
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

func TestAdRepositoriesResolveEligibleCampaignsAndCountEvents(t *testing.T) {
	t.Parallel()
	h := newHarness(t)
	ctx := context.Background()
	campaigns := adapter.NewAdCampaignRepository(h.DB)
	events := adapter.NewAdEventRepository(h.DB)
	activated := testNow.Add(-time.Hour)
	campaign := revenue.ReconstituteAdCampaign(revenue.AdCampaignState{ID: "ad_1", Name: "Launch", Advertiser: "Acme", Locale: "*", Slot: revenue.SlotHomeLeaderboard, CreativeURL: "https://cdn.example/ad.jpg", AltText: "Solar panels", LandingURL: "https://example.com", Budget: revenue.Money{Minor: 10000, Currency: revenue.CurrencyGHS}, CPMMinor: 1000, Priority: 90, StartsAt: testNow.Add(-time.Hour), EndsAt: testNow.Add(time.Hour), Active: true, ActivatedAt: &activated, CreatedBy: "admin"})
	if err := campaigns.Save(ctx, campaign); err != nil {
		t.Fatal(err)
	}
	listed, err := campaigns.ListEligible(ctx, revenue.SlotHomeLeaderboard, "fr", testNow, 10)
	if err != nil || len(listed) != 1 || listed[0].State().AltText != "Solar panels" {
		t.Fatal(listed, err)
	}
	event, _ := revenue.NewAdEvent("event_1", campaign.ID(), revenue.AdImpression, testNow)
	if err = events.Append(ctx, event); err != nil {
		t.Fatal(err)
	}
	count, err := events.CountForCampaign(ctx, campaign.ID(), revenue.AdImpression)
	if err != nil || count != 1 {
		t.Fatal(count, err)
	}
}

func TestCommerceRepositoriesRoundTripPublicInventory(t *testing.T) {
	t.Parallel()
	h := newHarness(t)
	ctx := context.Background()
	products := adapter.NewProductRepository(h.DB)
	orders := adapter.NewProductOrderRepository(h.DB)
	classifieds := adapter.NewClassifiedRepository(h.DB)
	activeAt, expires := testNow.Add(-time.Hour), testNow.Add(24*time.Hour)
	product := revenue.ReconstituteProduct(revenue.ProductState{ID: "product_1", Name: "Annual", Slug: "annual", SKU: "ANN-01", Description: "Year in review", ImageURL: "https://cdn.test/annual.jpg", ImageAlt: "Annual cover", Price: revenue.Money{Minor: 2000, Currency: revenue.CurrencyEUR}, Stock: 8, Active: true, ActivatedAt: &activeAt, CreatedBy: "admin"})
	if err := products.Save(ctx, product); err != nil {
		t.Fatal(err)
	}
	if rows, err := products.ListActive(ctx, 10); err != nil || len(rows) != 1 || rows[0].ID() != product.ID() {
		t.Fatal(rows, err)
	}
	if rows, err := products.ListAll(ctx, 10); err != nil || len(rows) != 1 {
		t.Fatal(rows, err)
	}
	if got, err := products.FindByID(ctx, product.ID()); err != nil || got.State().SKU != "ANN-01" {
		t.Fatal(got, err)
	}
	order := revenue.ReconstituteProductOrder(revenue.ProductOrderState{ID: "order_1", ProductID: product.ID(), Quantity: 2, Total: revenue.Money{Minor: 4000, Currency: revenue.CurrencyEUR}, Email: "buyer@example.com", DeliveryName: "Buyer", DeliveryAddress: "France", Provider: revenue.ProviderStripe, ProviderRef: "checkout_order", Status: revenue.PaymentPending, StartedAt: testNow})
	if err := orders.Save(ctx, order); err != nil {
		t.Fatal(err)
	}
	if got, err := orders.FindByID(ctx, order.ID()); err != nil || got.State().Quantity != 2 {
		t.Fatal(got, err)
	}
	listing := revenue.ReconstituteClassified(revenue.ClassifiedState{ID: "classified_1", Title: "Camera", Category: "Equipment", Description: "Broadcast camera", Location: "Accra", ContactName: "Ama", ContactEmail: "ama@example.com", AskingPrice: revenue.Money{Minor: 50000, Currency: revenue.CurrencyGHS}, PlacementFee: revenue.Money{Minor: 5000, Currency: revenue.CurrencyGHS}, Provider: revenue.ProviderPaystack, ProviderRef: "checkout_listing", PaymentRef: "paid", Status: revenue.ClassifiedPublished, SubmittedAt: activeAt, PaidAt: &activeAt, PublishedAt: &activeAt, ExpiresAt: &expires})
	if err := classifieds.Save(ctx, listing); err != nil {
		t.Fatal(err)
	}
	if rows, err := classifieds.ListPublished(ctx, testNow, 10); err != nil || len(rows) != 1 {
		t.Fatal(rows, err)
	}
	if rows, err := classifieds.ListAll(ctx, 10); err != nil || len(rows) != 1 {
		t.Fatal(rows, err)
	}
	if got, err := classifieds.FindByID(ctx, listing.ID()); err != nil || got.State().Status != revenue.ClassifiedPublished {
		t.Fatal(got, err)
	}
}

func TestAffiliateRepositoryPublishesAndCountsAnonymousClicks(t *testing.T) {
	t.Parallel()
	h := newHarness(t)
	ctx := context.Background()
	links := adapter.NewAffiliateLinkRepository(h.DB)
	activeAt := testNow.Add(-time.Hour)
	link := revenue.ReconstituteAffiliateLink(revenue.AffiliateLinkState{ID: "affiliate_1", Partner: "Akwaaba Books", Title: "History collection", Category: "Books", Description: "Selected Ghanaian writing", Disclosure: "We may earn a commission.", ImageURL: "https://cdn.test/books.jpg", ImageAlt: "Ghanaian books", DestinationURL: "https://partner.test/books", CommissionNote: "Ten percent", Active: true, ActivatedAt: &activeAt, CreatedBy: "admin"})
	if err := links.Save(ctx, link); err != nil {
		t.Fatal(err)
	}
	if rows, err := links.ListActive(ctx, 10); err != nil || len(rows) != 1 {
		t.Fatal(rows, err)
	}
	if err := links.RecordClick(ctx, link.ID(), testNow); err != nil {
		t.Fatal(err)
	}
	got, err := links.FindByID(ctx, link.ID())
	if err != nil || got.State().Clicks != 1 {
		t.Fatal(got.State(), err)
	}
	if rows, err := links.ListAll(ctx, 10); err != nil || len(rows) != 1 {
		t.Fatal(rows, err)
	}
	if err := links.RecordClick(ctx, "missing", testNow); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal(err)
	}
}
