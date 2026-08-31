package payments_test

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"strconv"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/adapter/payments"
	"github.com/kurasikapa/api/internal/domain/revenue"
)

var webhookNow = time.Date(2026, 8, 31, 20, 0, 0, 0, time.UTC)

func TestPaystackWebhookRequiresHMACAndMapsSuccessfulCharge(t *testing.T) {
	body := []byte(`{"event":"charge.success","data":{"id":12345,"reference":"don_1","metadata":{"purpose":"donation"}}}`)
	mac := hmac.New(sha512.New, []byte("paystack-webhook"))
	_, _ = mac.Write(body)
	verifier := payments.NewWebhookVerifier("paystack-webhook", "stripe-webhook")
	event, err := verifier.Verify(revenue.ProviderPaystack, hex.EncodeToString(mac.Sum(nil)), body, webhookNow)
	if err != nil || event.ResourceID != "don_1" || event.PaymentRef != "12345" {
		t.Fatal(event, err)
	}
	if _, err = verifier.Verify(revenue.ProviderPaystack, "bad", body, webhookNow); err == nil {
		t.Fatal("forged webhook accepted")
	}
}

func TestStripeWebhookRequiresFreshSignedCheckoutCompletion(t *testing.T) {
	body := []byte(`{"type":"checkout.session.completed","data":{"object":{"id":"cs_1","client_reference_id":"sub_1","subscription":"stripe_sub_1","metadata":{"purpose":"subscription"}}}}`)
	payload := strconv.FormatInt(webhookNow.Unix(), 10) + "." + string(body)
	mac := hmac.New(sha256.New, []byte("stripe-webhook"))
	_, _ = mac.Write([]byte(payload))
	signature := "t=" + strconv.FormatInt(webhookNow.Unix(), 10) + ",v1=" + hex.EncodeToString(mac.Sum(nil))
	verifier := payments.NewWebhookVerifier("paystack-webhook", "stripe-webhook")
	event, err := verifier.Verify(revenue.ProviderStripe, signature, body, webhookNow)
	if err != nil || event.ResourceID != "sub_1" || event.PaymentRef != "stripe_sub_1" {
		t.Fatal(event, err)
	}
	if _, err = verifier.Verify(revenue.ProviderStripe, signature, body, webhookNow.Add(10*time.Minute)); err == nil {
		t.Fatal("stale webhook accepted")
	}
}
