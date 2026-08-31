package payments

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/revenue"
)

var (
	ErrWebhookNotConfigured = errors.New("payment webhook is not configured")
	ErrInvalidWebhook       = ports.ErrInvalidPaymentWebhook
)

type WebhookVerifier struct{ paystackSecret, stripeSecret string }

func NewWebhookVerifier(paystackSecret, stripeSecret string) *WebhookVerifier {
	return &WebhookVerifier{paystackSecret: paystackSecret, stripeSecret: stripeSecret}
}

func (v *WebhookVerifier) Verify(provider revenue.PaymentProvider, signature string, body []byte, now time.Time) (ports.VerifiedPayment, error) {
	switch provider {
	case revenue.ProviderPaystack:
		return v.verifyPaystack(signature, body)
	case revenue.ProviderStripe:
		return v.verifyStripe(signature, body, now)
	default:
		return ports.VerifiedPayment{}, revenue.ErrInvalidProvider
	}
}

func (v *WebhookVerifier) verifyPaystack(signature string, body []byte) (ports.VerifiedPayment, error) {
	if v.paystackSecret == "" {
		return ports.VerifiedPayment{}, fmt.Errorf("%w: paystack", ErrWebhookNotConfigured)
	}
	mac := hmac.New(sha512.New, []byte(v.paystackSecret))
	_, _ = mac.Write(body)
	if !sameHex(signature, mac.Sum(nil)) {
		return ports.VerifiedPayment{}, ErrInvalidWebhook
	}
	var event struct {
		Event string `json:"event"`
		Data  struct {
			ID        json.Number       `json:"id"`
			Reference string            `json:"reference"`
			Metadata  map[string]string `json:"metadata"`
		} `json:"data"`
	}
	decoder := json.NewDecoder(strings.NewReader(string(body)))
	decoder.UseNumber()
	if err := decoder.Decode(&event); err != nil || event.Event != "charge.success" || event.Data.Reference == "" {
		return ports.VerifiedPayment{}, ErrInvalidWebhook
	}
	return ports.VerifiedPayment{Purpose: event.Data.Metadata["purpose"], ResourceID: event.Data.Reference, PaymentRef: event.Data.ID.String()}, nil
}

func (v *WebhookVerifier) verifyStripe(signature string, body []byte, now time.Time) (ports.VerifiedPayment, error) {
	if v.stripeSecret == "" {
		return ports.VerifiedPayment{}, fmt.Errorf("%w: stripe", ErrWebhookNotConfigured)
	}
	timestamp, presented, ok := stripeSignature(signature)
	if !ok || timestamp.Before(now.Add(-5*time.Minute)) || timestamp.After(now.Add(5*time.Minute)) {
		return ports.VerifiedPayment{}, ErrInvalidWebhook
	}
	mac := hmac.New(sha256.New, []byte(v.stripeSecret))
	_, _ = mac.Write([]byte(strconv.FormatInt(timestamp.Unix(), 10) + "." + string(body)))
	if !sameHex(presented, mac.Sum(nil)) {
		return ports.VerifiedPayment{}, ErrInvalidWebhook
	}
	var event struct {
		Type string `json:"type"`
		Data struct {
			Object struct {
				ID                string            `json:"id"`
				ClientReferenceID string            `json:"client_reference_id"`
				PaymentIntent     string            `json:"payment_intent"`
				Subscription      string            `json:"subscription"`
				Metadata          map[string]string `json:"metadata"`
			} `json:"object"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &event); err != nil || event.Type != "checkout.session.completed" || event.Data.Object.ClientReferenceID == "" {
		return ports.VerifiedPayment{}, ErrInvalidWebhook
	}
	ref := event.Data.Object.PaymentIntent
	if ref == "" {
		ref = event.Data.Object.Subscription
	}
	if ref == "" {
		ref = event.Data.Object.ID
	}
	return ports.VerifiedPayment{Purpose: event.Data.Object.Metadata["purpose"], ResourceID: event.Data.Object.ClientReferenceID, PaymentRef: ref}, nil
}

func stripeSignature(header string) (time.Time, string, bool) {
	values := map[string]string{}
	for _, part := range strings.Split(header, ",") {
		key, value, ok := strings.Cut(part, "=")
		if ok {
			values[key] = value
		}
	}
	seconds, err := strconv.ParseInt(values["t"], 10, 64)
	return time.Unix(seconds, 0).UTC(), values["v1"], err == nil && values["v1"] != ""
}

func sameHex(presented string, expected []byte) bool {
	decoded, err := hex.DecodeString(presented)
	return err == nil && hmac.Equal(decoded, expected)
}
