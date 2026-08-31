package payments_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kurasikapa/api/internal/adapter/payments"
	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/revenue"
)

func TestPaystackCheckoutUsesMinorUnitsAndBearerAuthentication(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer paystack-secret" {
			t.Error("missing bearer secret")
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["amount"] != float64(3500) || body["reference"] != "sub_1" {
			t.Errorf("unexpected body: %#v", body)
		}
		_, _ = w.Write([]byte(`{"status":true,"data":{"reference":"ps_ref","authorization_url":"https://pay.example/ps"}}`))
	}))
	defer server.Close()
	gateway := payments.NewTestGateway(server.Client(), "paystack-secret", "stripe-secret", server.URL, server.URL)
	result, err := gateway.StartCheckout(context.Background(), ports.CheckoutRequest{Reference: "sub_1", Purpose: "subscription", Amount: revenue.Money{Minor: 3500, Currency: revenue.CurrencyGHS}, Email: "reader@example.com"})
	if err != nil || result.Provider != revenue.ProviderPaystack || result.CheckoutURL == "" {
		t.Fatal(result, err)
	}
}

func TestStripeCheckoutUsesRecurringPriceDataForMembership(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		username, _, ok := r.BasicAuth()
		if !ok || username != "stripe-secret" {
			t.Error("missing basic auth")
		}
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		if r.Form.Get("mode") != "subscription" || r.Form.Get("line_items[0][price_data][unit_amount]") != "1200" || r.Form.Get("line_items[0][price_data][recurring][interval]") != "year" {
			t.Errorf("unexpected form: %#v", r.Form)
		}
		_, _ = w.Write([]byte(`{"id":"cs_1","url":"https://pay.example/stripe"}`))
	}))
	defer server.Close()
	gateway := payments.NewTestGateway(server.Client(), "paystack-secret", "stripe-secret", server.URL, server.URL)
	result, err := gateway.StartCheckout(context.Background(), ports.CheckoutRequest{Reference: "sub_1", Purpose: "subscription", Amount: revenue.Money{Minor: 1200, Currency: revenue.CurrencyEUR}, Interval: revenue.IntervalYearly, Email: "reader@example.com"})
	if err != nil || result.Provider != revenue.ProviderStripe {
		t.Fatal(result, err)
	}
}

func TestCheckoutFailsClosedWithoutCredentialsOrOnProviderFailure(t *testing.T) {
	gateway := payments.NewGateway(http.DefaultClient, "", "")
	request := ports.CheckoutRequest{Amount: revenue.Money{Minor: 1000, Currency: revenue.CurrencyGHS}}
	if _, err := gateway.StartCheckout(context.Background(), request); !errors.Is(err, payments.ErrProviderNotConfigured) {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "no", http.StatusBadGateway)
	}))
	defer server.Close()
	gateway = payments.NewTestGateway(server.Client(), "key", "key", server.URL, server.URL)
	if _, err := gateway.StartCheckout(context.Background(), request); !errors.Is(err, payments.ErrCheckoutRejected) {
		t.Fatal(err)
	}
}
