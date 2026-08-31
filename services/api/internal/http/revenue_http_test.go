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
