// Package payments implements checkout creation without leaking provider types.
package payments

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/revenue"
)

var (
	ErrProviderNotConfigured = errors.New("payment provider is not configured")
	ErrCheckoutRejected      = errors.New("payment provider rejected checkout")
)

type Gateway struct {
	client                 *http.Client
	paystackKey, stripeKey string
	paystackURL, stripeURL string
}

func NewGateway(client *http.Client, paystackKey, stripeKey string) *Gateway {
	return NewTestGateway(client, paystackKey, stripeKey,
		"https://api.paystack.co/transaction/initialize",
		"https://api.stripe.com/v1/checkout/sessions")
}

func NewTestGateway(client *http.Client, paystackKey, stripeKey, paystackURL, stripeURL string) *Gateway {
	return &Gateway{client: client, paystackKey: paystackKey, stripeKey: stripeKey,
		paystackURL: paystackURL, stripeURL: stripeURL}
}

func (g *Gateway) StartCheckout(ctx context.Context, request ports.CheckoutRequest) (ports.CheckoutSession, error) {
	if request.Amount.Currency == revenue.CurrencyGHS {
		return g.startPaystack(ctx, request)
	}
	if request.Amount.Currency == revenue.CurrencyEUR {
		return g.startStripe(ctx, request)
	}
	return ports.CheckoutSession{}, revenue.ErrUnsupportedCurrency
}

func (g *Gateway) startPaystack(ctx context.Context, input ports.CheckoutRequest) (ports.CheckoutSession, error) {
	if g.paystackKey == "" {
		return ports.CheckoutSession{}, fmt.Errorf("%w: paystack", ErrProviderNotConfigured)
	}
	body, err := json.Marshal(map[string]any{
		"email": input.Email, "amount": input.Amount.Minor, "currency": "GHS",
		"reference": input.Reference, "callback_url": input.ReturnURL,
		"metadata": map[string]string{"purpose": input.Purpose},
	})
	if err != nil {
		return ports.CheckoutSession{}, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, g.paystackURL, bytes.NewReader(body))
	if err != nil {
		return ports.CheckoutSession{}, err
	}
	request.Header.Set("Authorization", "Bearer "+g.paystackKey)
	request.Header.Set("Content-Type", "application/json")
	var response struct {
		Status bool `json:"status"`
		Data   struct {
			Reference        string `json:"reference"`
			AuthorizationURL string `json:"authorization_url"`
		} `json:"data"`
	}
	if err = g.do(request, &response); err != nil {
		return ports.CheckoutSession{}, err
	}
	if !response.Status || response.Data.Reference == "" || response.Data.AuthorizationURL == "" {
		return ports.CheckoutSession{}, ErrCheckoutRejected
	}
	return ports.CheckoutSession{Provider: revenue.ProviderPaystack,
		ProviderRef: response.Data.Reference, CheckoutURL: response.Data.AuthorizationURL}, nil
}

func (g *Gateway) startStripe(ctx context.Context, input ports.CheckoutRequest) (ports.CheckoutSession, error) {
	if g.stripeKey == "" {
		return ports.CheckoutSession{}, fmt.Errorf("%w: stripe", ErrProviderNotConfigured)
	}
	form := stripeForm(input)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, g.stripeURL, strings.NewReader(form.Encode()))
	if err != nil {
		return ports.CheckoutSession{}, err
	}
	request.SetBasicAuth(g.stripeKey, "")
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var response struct {
		ID  string `json:"id"`
		URL string `json:"url"`
	}
	if err = g.do(request, &response); err != nil {
		return ports.CheckoutSession{}, err
	}
	if response.ID == "" || response.URL == "" {
		return ports.CheckoutSession{}, ErrCheckoutRejected
	}
	return ports.CheckoutSession{Provider: revenue.ProviderStripe,
		ProviderRef: response.ID, CheckoutURL: response.URL}, nil
}

func stripeForm(input ports.CheckoutRequest) url.Values {
	form := url.Values{"success_url": {input.ReturnURL}, "cancel_url": {input.ReturnURL},
		"client_reference_id": {input.Reference}, "customer_email": {input.Email},
		"line_items[0][quantity]": {"1"}, "line_items[0][price_data][currency]": {"eur"},
		"line_items[0][price_data][unit_amount]": {strconv.FormatInt(input.Amount.Minor, 10)},
		"metadata[purpose]":                      {input.Purpose}}
	if input.Purpose == "subscription" {
		interval := "month"
		if input.Interval == revenue.IntervalYearly {
			interval = "year"
		}
		form.Set("mode", "subscription")
		form.Set("line_items[0][price_data][product_data][name]", "Kurasikapa membership")
		form.Set("line_items[0][price_data][recurring][interval]", interval)
	} else {
		form.Set("mode", "payment")
		form.Set("line_items[0][price_data][product_data][name]", "Kurasikapa contribution")
	}
	return form
}

func (g *Gateway) do(request *http.Request, into any) error {
	response, err := g.client.Do(request)
	if err != nil {
		return err
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 1<<20))
		return fmt.Errorf("%w: status %d", ErrCheckoutRejected, response.StatusCode)
	}
	if err = json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(into); err != nil {
		return fmt.Errorf("%w: invalid response", ErrCheckoutRejected)
	}
	return nil
}
