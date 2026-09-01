package http_test

import (
	"bytes"
	"net/http"
	"testing"

	"github.com/kurasikapa/api/internal/app/ports"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
	kurahttp "github.com/kurasikapa/api/internal/http"
)

func revenueServer() http.Handler {
	return routed(emptyEditorial(), map[shared.UserID][]identity.Role{"manager": {identity.RoleAdministrator}})
}

func TestMembershipPlanLifecycleAndCheckout(t *testing.T) {
	handler := revenueServer()
	created := request(handler, http.MethodPost, "/revenue/membership-plans", `{"name":"Supporter","slug":"supporter","description":"Fund independent reporting","interval":"monthly","price":{"minor":3500,"currency":"GHS"},"benefits":["Member briefings"]}`, true)
	if created.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", created.Code, created.Body.String())
	}
	activated := request(handler, http.MethodPost, "/revenue/membership-plans/id_1/activate", `{}`, true)
	if activated.Code != http.StatusOK {
		t.Fatalf("activate: %d %s", activated.Code, activated.Body.String())
	}
	listed := request(handler, http.MethodGet, "/public/en/membership-plans", "", false)
	if listed.Code != http.StatusOK || !bytes.Contains(listed.Body.Bytes(), []byte("Supporter")) {
		t.Fatalf("list: %d %s", listed.Code, listed.Body.String())
	}
	checkout := request(handler, http.MethodPost, "/revenue/subscriptions", `{"planID":"id_1","email":"reader@example.com","returnURL":"https://kurasikapa.tv/en/support"}`, true)
	if checkout.Code != http.StatusCreated || !bytes.Contains(checkout.Body.Bytes(), []byte("https://pay.example/checkout")) {
		t.Fatalf("checkout: %d %s", checkout.Code, checkout.Body.String())
	}
	entitlement := request(handler, http.MethodGet, "/revenue/entitlement", "", true)
	if entitlement.Code != http.StatusOK || !bytes.Contains(entitlement.Body.Bytes(), []byte(`"entitled":false`)) {
		t.Fatalf("entitlement: %d %s", entitlement.Code, entitlement.Body.String())
	}
}

func TestDonationCheckoutAndRevenueAuthorization(t *testing.T) {
	handler := revenueServer()
	donation := request(handler, http.MethodPost, "/public/donations", `{"amount":{"minor":5000,"currency":"GHS"},"email":"reader@example.com","returnURL":"https://kurasikapa.tv/en/support"}`, false)
	if donation.Code != http.StatusCreated {
		t.Fatalf("donation: %d %s", donation.Code, donation.Body.String())
	}
	if response := request(handler, http.MethodPost, "/revenue/membership-plans", `{}`, false); response.Code != http.StatusForbidden {
		t.Fatalf("unauthorised plan create: %d", response.Code)
	}
	if response := request(handler, http.MethodPost, "/revenue/subscriptions", `{}`, false); response.Code != http.StatusForbidden {
		t.Fatalf("unauthorised membership: %d", response.Code)
	}
}

func TestVerifiedWebhookConfirmsPendingDonation(t *testing.T) {
	deps := httpDeps(emptyEditorial(), map[shared.UserID][]identity.Role{"manager": {identity.RoleAdministrator}})
	deps.PaymentWebhooks = faketesting.PaymentWebhookFake{Event: ports.VerifiedPayment{Purpose: "donation", ResourceID: "id_1", PaymentRef: "payment_1"}}
	handler := kurahttp.NewRouter(deps)
	if response := request(handler, http.MethodPost, "/public/donations", `{"amount":{"minor":5000,"currency":"GHS"},"email":"reader@example.com","returnURL":"https://kurasikapa.tv/en/support"}`, false); response.Code != http.StatusCreated {
		t.Fatalf("donation: %d %s", response.Code, response.Body.String())
	}
	confirmed := request(handler, http.MethodPost, "/webhooks/payments/paystack", `{}`, false)
	if confirmed.Code != http.StatusNoContent {
		t.Fatalf("webhook: %d %s", confirmed.Code, confirmed.Body.String())
	}
	deps.PaymentWebhooks = faketesting.PaymentWebhookFake{Event: ports.VerifiedPayment{Purpose: "unknown"}}
	if response := request(kurahttp.NewRouter(deps), http.MethodPost, "/webhooks/payments/paystack", `{}`, false); response.Code != http.StatusUnauthorized {
		t.Fatalf("unknown event: %d %s", response.Code, response.Body.String())
	}
}

func TestRevenueHandlersRejectMalformedAndMissingResources(t *testing.T) {
	handler := revenueServer()
	cases := []struct {
		method, path, body string
		want               int
	}{
		{http.MethodPost, "/revenue/membership-plans", `{`, http.StatusBadRequest},
		{http.MethodPost, "/revenue/membership-plans", `{}`, http.StatusBadRequest},
		{http.MethodPost, "/revenue/subscriptions", `{`, http.StatusBadRequest},
		{http.MethodPost, "/revenue/subscriptions", `{}`, http.StatusNotFound},
		{http.MethodPost, "/public/donations", `{`, http.StatusBadRequest},
		{http.MethodPost, "/public/donations", `{}`, http.StatusBadRequest},
		{http.MethodPost, "/revenue/membership-plans/missing/activate", `{}`, http.StatusNotFound},
		{http.MethodPost, "/revenue/ad-campaigns", `{`, http.StatusBadRequest},
		{http.MethodPost, "/revenue/ad-campaigns", `{}`, http.StatusBadRequest},
		{http.MethodPost, "/revenue/ad-campaigns/missing/activate", `{}`, http.StatusNotFound},
		{http.MethodPost, "/public/ads/missing/events", `{`, http.StatusBadRequest},
		{http.MethodPost, "/public/ads/missing/events", `{"kind":"click"}`, http.StatusNotFound},
		{http.MethodPost, "/revenue/affiliate-links", `{`, http.StatusBadRequest},
		{http.MethodPost, "/revenue/affiliate-links/missing/activate", `{}`, http.StatusNotFound},
		{http.MethodPost, "/public/affiliate-links/missing/follow", `{}`, http.StatusNotFound},
	}
	for _, tc := range cases {
		authorized := tc.path != "/public/donations" && tc.path != "/public/ads/missing/events"
		if response := request(handler, tc.method, tc.path, tc.body, authorized); response.Code != tc.want {
			t.Errorf("%s: got %d, want %d: %s", tc.path, response.Code, tc.want, response.Body.String())
		}
	}
	if response := request(handler, http.MethodGet, "/revenue/entitlement", "", false); response.Code != http.StatusForbidden {
		t.Fatalf("unsigned entitlement: %d %s", response.Code, response.Body.String())
	}
	if response := request(handler, http.MethodGet, "/revenue/ad-report", "", false); response.Code != http.StatusForbidden {
		t.Fatalf("unsigned ad report: %d %s", response.Code, response.Body.String())
	}
	if response := request(handler, http.MethodGet, "/public/en/ads/article_inline", "", false); response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"placement":null`)) {
		t.Fatalf("empty placement: %d %s", response.Code, response.Body.String())
	}
}

func TestAffiliateLinkLifecycleDisclosureAndAnonymousFollow(t *testing.T) {
	handler := revenueServer()
	body := `{"partner":"Akwaaba Books","title":"Ghanaian history collection","category":"Books","description":"A carefully selected collection from Ghanaian writers.","disclosure":"Kurasikapa may earn a commission from this link.","imageURL":"https://cdn.example.com/books.jpg","imageAlt":"A collection of Ghanaian books","destinationURL":"https://partner.example.com/ghana-books","commissionNote":"Ten percent"}`
	created := request(handler, http.MethodPost, "/revenue/affiliate-links", body, true)
	if created.Code != http.StatusCreated {
		t.Fatal(created.Code, created.Body.String())
	}
	if response := request(handler, http.MethodPost, "/public/affiliate-links/id_1/follow", `{}`, false); response.Code != http.StatusConflict {
		t.Fatal(response.Code, response.Body.String())
	}
	activated := request(handler, http.MethodPost, "/revenue/affiliate-links/id_1/activate", `{}`, true)
	if activated.Code != http.StatusOK {
		t.Fatal(activated.Code, activated.Body.String())
	}
	listed := request(handler, http.MethodGet, "/public/affiliate-links", "", false)
	if listed.Code != http.StatusOK || !bytes.Contains(listed.Body.Bytes(), []byte(`"disclosure":"Kurasikapa may earn`)) {
		t.Fatal(listed.Code, listed.Body.String())
	}
	followed := request(handler, http.MethodPost, "/public/affiliate-links/id_1/follow", `{}`, false)
	if followed.Code != http.StatusOK || !bytes.Contains(followed.Body.Bytes(), []byte(`"destinationURL":"https://partner.example.com/ghana-books"`)) {
		t.Fatal(followed.Code, followed.Body.String())
	}
	managed := request(handler, http.MethodGet, "/revenue/affiliate-links", "", true)
	if managed.Code != http.StatusOK || !bytes.Contains(managed.Body.Bytes(), []byte(`"clicks":0`)) {
		t.Fatal(managed.Code, managed.Body.String())
	}
}

func TestVerifiedWebhookRejectsMissingRevenueResources(t *testing.T) {
	for _, purpose := range []string{"subscription", "donation"} {
		deps := httpDeps(emptyEditorial(), nil)
		deps.PaymentWebhooks = faketesting.PaymentWebhookFake{Event: ports.VerifiedPayment{
			Purpose: purpose, ResourceID: "missing", PaymentRef: "payment_missing",
		}}
		response := request(kurahttp.NewRouter(deps), http.MethodPost, "/webhooks/payments/paystack", `{}`, false)
		if response.Code != http.StatusNotFound {
			t.Errorf("%s: got %d, want %d: %s", purpose, response.Code, http.StatusNotFound, response.Body.String())
		}
	}
}

func TestVerifiedSubscriptionWebhookIsIdempotent(t *testing.T) {
	deps := httpDeps(emptyEditorial(), map[shared.UserID][]identity.Role{"manager": {identity.RoleAdministrator}})
	handler := kurahttp.NewRouter(deps)
	if response := request(handler, http.MethodPost, "/revenue/membership-plans", `{"name":"Supporter","slug":"supporter","interval":"monthly","price":{"minor":3500,"currency":"GHS"},"benefits":["Member briefings"]}`, true); response.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", response.Code, response.Body.String())
	}
	if response := request(handler, http.MethodPost, "/revenue/membership-plans/id_1/activate", `{}`, true); response.Code != http.StatusOK {
		t.Fatalf("activate: %d %s", response.Code, response.Body.String())
	}
	if response := request(handler, http.MethodPost, "/revenue/subscriptions", `{"planID":"id_1","email":"reader@example.com","returnURL":"https://kurasikapa.tv/en/support"}`, true); response.Code != http.StatusCreated {
		t.Fatalf("subscription: %d %s", response.Code, response.Body.String())
	}
	deps.PaymentWebhooks = faketesting.PaymentWebhookFake{Event: ports.VerifiedPayment{
		Purpose: "subscription", ResourceID: "id_2", PaymentRef: "payment_2",
	}}
	handler = kurahttp.NewRouter(deps)
	for attempt := 1; attempt <= 2; attempt++ {
		response := request(handler, http.MethodPost, "/webhooks/payments/paystack", `{}`, false)
		if response.Code != http.StatusNoContent {
			t.Fatalf("webhook attempt %d: %d %s", attempt, response.Code, response.Body.String())
		}
	}
}

func TestRevenueReportIsRoleProtectedAndReturnsLedger(t *testing.T) {
	handler := revenueServer()
	if response := request(handler, http.MethodGet, "/revenue/report?days=7", "", false); response.Code != http.StatusForbidden {
		t.Fatalf("unsigned report: %d %s", response.Code, response.Body.String())
	}
	response := request(handler, http.MethodGet, "/revenue/report?days=7", "", true)
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"days":7`)) || !bytes.Contains(response.Body.Bytes(), []byte(`"subscribers":[]`)) {
		t.Fatalf("report: %d %s", response.Code, response.Body.String())
	}
}

func TestAdvertisingCampaignLifecyclePlacementEventsAndReport(t *testing.T) {
	handler := revenueServer()
	body := `{"name":"Launch","advertiser":"Acme Ghana","locale":"en","slot":"home_leaderboard","creativeURL":"https://cdn.example/ad.jpg","altText":"Acme solar systems","landingURL":"https://example.com","budget":{"minor":10000,"currency":"GHS"},"cpmMinor":1000,"priority":90,"startsAt":"2026-08-08T12:00:00Z","endsAt":"2026-08-10T12:00:00Z"}`
	created := request(handler, http.MethodPost, "/revenue/ad-campaigns", body, true)
	if created.Code != http.StatusCreated {
		t.Fatal(created.Code, created.Body.String())
	}
	activated := request(handler, http.MethodPost, "/revenue/ad-campaigns/id_1/activate", `{}`, true)
	if activated.Code != http.StatusOK {
		t.Fatal(activated.Code, activated.Body.String())
	}
	placement := request(handler, http.MethodGet, "/public/en/ads/home_leaderboard", "", false)
	if placement.Code != http.StatusOK || !bytes.Contains(placement.Body.Bytes(), []byte(`"advertiser":"Acme Ghana"`)) {
		t.Fatal(placement.Code, placement.Body.String())
	}
	event := request(handler, http.MethodPost, "/public/ads/id_1/events", `{"kind":"impression"}`, false)
	if event.Code != http.StatusNoContent {
		t.Fatal(event.Code, event.Body.String())
	}
	report := request(handler, http.MethodGet, "/revenue/ad-report", "", true)
	if report.Code != http.StatusOK || !bytes.Contains(report.Body.Bytes(), []byte(`"Impressions":1`)) {
		t.Fatal(report.Code, report.Body.String())
	}
}

func TestProductAndClassifiedCommerceLifecycle(t *testing.T) {
	deps := httpDeps(emptyEditorial(), map[shared.UserID][]identity.Role{"manager": {identity.RoleAdministrator}})
	handler := kurahttp.NewRouter(deps)
	product := `{"name":"Annual","slug":"annual","sku":"ANN-01","description":"The Kurasikapa year in review.","imageURL":"https://cdn.test/annual.jpg","imageAlt":"Annual publication cover","price":{"minor":2000,"currency":"EUR"},"stock":8}`
	if response := request(handler, http.MethodPost, "/revenue/products", product, true); response.Code != http.StatusCreated {
		t.Fatal(response.Code, response.Body.String())
	}
	if response := request(handler, http.MethodPost, "/revenue/products/id_1/activate", `{}`, true); response.Code != http.StatusOK {
		t.Fatal(response.Code, response.Body.String())
	}
	for _, path := range []string{"/public/products", "/revenue/products"} {
		response := request(handler, http.MethodGet, path, "", path == "/revenue/products")
		if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte("Annual")) {
			t.Fatal(path, response.Code, response.Body.String())
		}
	}
	order := `{"productID":"id_1","quantity":2,"email":"buyer@example.com","deliveryName":"Ada Buyer","deliveryAddress":"4 Rue des Lys, France","returnURL":"https://site.test/shop"}`
	if response := request(handler, http.MethodPost, "/public/product-orders", order, false); response.Code != http.StatusCreated {
		t.Fatal(response.Code, response.Body.String())
	}
	deps.PaymentWebhooks = faketesting.PaymentWebhookFake{Event: ports.VerifiedPayment{Purpose: "product", ResourceID: "id_2", PaymentRef: "paid_2"}}
	handler = kurahttp.NewRouter(deps)
	if response := request(handler, http.MethodPost, "/webhooks/payments/stripe", `{}`, false); response.Code != http.StatusNoContent {
		t.Fatal(response.Code, response.Body.String())
	}

	listing := `{"title":"Broadcast camera","category":"Equipment","description":"Professionally maintained broadcast camera.","location":"Accra","contactName":"Ama","contactEmail":"ama@example.com","askingPrice":{"minor":450000,"currency":"GHS"},"returnURL":"https://site.test/classifieds"}`
	if response := request(handler, http.MethodPost, "/public/classifieds", listing, false); response.Code != http.StatusCreated {
		t.Fatal(response.Code, response.Body.String())
	}
	deps.PaymentWebhooks = faketesting.PaymentWebhookFake{Event: ports.VerifiedPayment{Purpose: "classified", ResourceID: "id_3", PaymentRef: "paid_3"}}
	handler = kurahttp.NewRouter(deps)
	if response := request(handler, http.MethodPost, "/webhooks/payments/paystack", `{}`, false); response.Code != http.StatusNoContent {
		t.Fatal(response.Code, response.Body.String())
	}
	if response := request(handler, http.MethodPost, "/revenue/classifieds/id_3/publish", `{}`, true); response.Code != http.StatusOK {
		t.Fatal(response.Code, response.Body.String())
	}
	for _, path := range []string{"/public/classifieds", "/revenue/classifieds"} {
		response := request(handler, http.MethodGet, path, "", path == "/revenue/classifieds")
		if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte("Broadcast camera")) {
			t.Fatal(path, response.Code, response.Body.String())
		}
	}
}

func TestCommerceHandlersRejectMalformedUnauthorizedAndMissingResources(t *testing.T) {
	handler := revenueServer()
	cases := []struct {
		method, path, body string
		auth               bool
		want               int
	}{
		{http.MethodPost, "/revenue/products", `{`, true, http.StatusBadRequest},
		{http.MethodPost, "/revenue/products", `{}`, false, http.StatusForbidden},
		{http.MethodPost, "/revenue/products/missing/activate", `{}`, true, http.StatusNotFound},
		{http.MethodGet, "/revenue/products", "", false, http.StatusForbidden},
		{http.MethodPost, "/public/product-orders", `{`, false, http.StatusBadRequest},
		{http.MethodPost, "/public/product-orders", `{}`, false, http.StatusNotFound},
		{http.MethodPost, "/public/classifieds", `{`, false, http.StatusBadRequest},
		{http.MethodPost, "/public/classifieds", `{}`, false, http.StatusBadRequest},
		{http.MethodGet, "/revenue/classifieds", "", false, http.StatusForbidden},
		{http.MethodPost, "/revenue/classifieds/missing/publish", `{}`, true, http.StatusNotFound},
	}
	for _, tc := range cases {
		response := request(handler, tc.method, tc.path, tc.body, tc.auth)
		if response.Code != tc.want {
			t.Errorf("%s: got %d want %d: %s", tc.path, response.Code, tc.want, response.Body.String())
		}
	}
}
