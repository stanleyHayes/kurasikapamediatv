package http_test

import (
	"bytes"
	"net/http"
	"testing"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
	kurahttp "github.com/kurasikapa/api/internal/http"
)

func eventServer() http.Handler {
	deps := httpDeps(emptyEditorial(), map[shared.UserID][]identity.Role{"manager": {identity.RoleEditor}})
	return kurahttp.NewRouter(deps)
}

func TestEventLifecycleAndPublicListing(t *testing.T) {
	handler := eventServer()
	created := request(handler, http.MethodPost, "/media/events", `{"type":"summit","mode":"hybrid","title":"Media Futures Summit","slug":"media-futures-summit","locale":"en","summary":"A newsroom-led forum for trusted journalism and broadcasting.","timezone":"Africa/Accra","venue":"National Theatre","city":"Accra","registrationURL":"https://events.example.org/summit","startsAt":"2026-08-10T12:00:00Z","endsAt":"2026-08-10T18:00:00Z","speakers":["Ama Mensah"],"featured":true}`, true)
	if created.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", created.Code, created.Body.String())
	}
	published := request(handler, http.MethodPost, "/media/events/id_1/publish", `{}`, true)
	if published.Code != http.StatusOK {
		t.Fatalf("publish: %d %s", published.Code, published.Body.String())
	}
	listed := request(handler, http.MethodGet, "/public/en/events", "", false)
	if listed.Code != http.StatusOK || !bytes.Contains(listed.Body.Bytes(), []byte("Media Futures Summit")) || !bytes.Contains(listed.Body.Bytes(), []byte(`"featured":true`)) {
		t.Fatalf("list: %d %s", listed.Code, listed.Body.String())
	}
}

func TestEventEndpointsRejectUnsafeInput(t *testing.T) {
	handler := eventServer()
	if rec := request(handler, http.MethodPost, "/media/events", `{}`, false); rec.Code != http.StatusForbidden {
		t.Fatalf("unauthorised = %d", rec.Code)
	}
	if rec := request(handler, http.MethodPost, "/media/events", `{}`, true); rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid = %d %s", rec.Code, rec.Body.String())
	}
	if rec := request(handler, http.MethodPost, "/media/events/missing/publish", `{}`, true); rec.Code != http.StatusNotFound {
		t.Fatalf("missing = %d %s", rec.Code, rec.Body.String())
	}
}
