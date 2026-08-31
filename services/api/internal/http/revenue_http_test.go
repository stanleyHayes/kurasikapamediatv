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
	}
	for _, tc := range cases {
		authorized := tc.path != "/public/donations"
		if response := request(handler, tc.method, tc.path, tc.body, authorized); response.Code != tc.want {
			t.Errorf("%s: got %d, want %d: %s", tc.path, response.Code, tc.want, response.Body.String())
		}
	}
	if response := request(handler, http.MethodGet, "/revenue/entitlement", "", false); response.Code != http.StatusForbidden {
		t.Fatalf("unsigned entitlement: %d %s", response.Code, response.Body.String())
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
