package http_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

const recordingEvent = `{
  "source":"aws.ivs",
  "detail-type":"IVS Recording State Change",
  "resources":["arn:aws:ivs:eu-west-1:123456789012:channel/channel_1"],
  "detail":{
    "channel_name":"en: Evening News",
    "recording_session_id":"session_1",
    "recording_status":"Recording End",
    "recording_s3_bucket_name":"ivs-source",
    "recording_s3_key_prefix":"ivs/v1/123/channel/date/session_1",
    "recording_duration_ms":60000
  }
}`

func TestIVSRecordingWebhookAndProcessingAreAuthenticatedAndIdempotent(t *testing.T) {
	handler := televisionServer()

	missing := httptest.NewRequest(http.MethodPost, "/webhooks/ivs/recordings", bytes.NewBufferString(recordingEvent))
	if response := do(handler, missing); response.Code != http.StatusNotFound {
		t.Fatalf("missing secret: %d %s", response.Code, response.Body.String())
	}
	first := httptest.NewRequest(http.MethodPost, "/webhooks/ivs/recordings", bytes.NewBufferString(recordingEvent))
	first.Header.Set("X-Kurasikapa-IVS-Secret", "ivs-secret-value-of-known-length")
	response := do(handler, first)
	if response.Code != http.StatusAccepted || !bytes.Contains(response.Body.Bytes(), []byte(`"status":"processing"`)) {
		t.Fatalf("first event: %d %s", response.Code, response.Body.String())
	}
	duplicate := httptest.NewRequest(http.MethodPost, "/webhooks/ivs/recordings", bytes.NewBufferString(recordingEvent))
	duplicate.Header.Set("X-Kurasikapa-IVS-Secret", "ivs-secret-value-of-known-length")
	response = do(handler, duplicate)
	if response.Code != http.StatusAccepted || !bytes.Contains(response.Body.Bytes(), []byte(`"id":"id_1"`)) {
		t.Fatalf("duplicate event: %d %s", response.Code, response.Body.String())
	}

	unauthorisedCron := httptest.NewRequest(http.MethodPost, "/internal/process-recordings", nil)
	if response = do(handler, unauthorisedCron); response.Code != http.StatusNotFound {
		t.Fatalf("open cron: %d %s", response.Code, response.Body.String())
	}
	cron := httptest.NewRequest(http.MethodPost, "/internal/process-recordings", nil)
	cron.Header.Set("Authorization", "Bearer s3cret-value-of-known-length-0000")
	if response = do(handler, cron); response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"processing":1`)) {
		t.Fatalf("cron: %d %s", response.Code, response.Body.String())
	}
}

func TestIVSRecordingWebhookRejectsMalformedAndUntrustedEvents(t *testing.T) {
	handler := televisionServer()
	for _, body := range []string{`{`, `{"source":"someone.else"}`} {
		request := httptest.NewRequest(http.MethodPost, "/webhooks/ivs/recordings", bytes.NewBufferString(body))
		request.Header.Set("X-Kurasikapa-IVS-Secret", "ivs-secret-value-of-known-length")
		response := do(handler, request)
		if response.Code != http.StatusBadRequest {
			t.Fatalf("body=%s status=%d response=%s", body, response.Code, response.Body.String())
		}
	}
}
