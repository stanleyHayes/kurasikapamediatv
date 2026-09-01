package http_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

const advertiserProposalJSON = `{"contactName":"Ama Mensah","contactEmail":"ama@example.com","campaign":{"name":"September launch","advertiser":"Acme Ghana","locale":"en","slot":"home_leaderboard","creativeURL":"https://cdn.example/ad.jpg","altText":"Acme solar systems","landingURL":"https://example.com","budget":{"minor":10000,"currency":"GHS"},"cpmMinor":1000,"priority":90,"startsAt":"2026-08-08T12:00:00Z","endsAt":"2026-08-10T12:00:00Z"}}`

func advertiserServer() http.Handler {
	return routed(emptyEditorial(), map[shared.UserID][]identity.Role{
		"advertiser-1": {identity.RoleAdvertiser},
		"advertiser-2": {identity.RoleAdvertiser},
		"manager":      {identity.RoleAdministrator},
	})
}

func advertiserRequest(handler http.Handler, method, path, body, user string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	if user != "" {
		request.Header.Set("X-Kurasikapa-User", user)
	}
	return do(handler, request)
}

func TestAdvertiserProposalLifecycleActivatesOnlyAfterManagerApproval(t *testing.T) {
	handler := advertiserServer()
	created := advertiserRequest(handler, http.MethodPost, "/advertiser/proposals", advertiserProposalJSON, "advertiser-1")
	if created.Code != http.StatusCreated || !bytes.Contains(created.Body.Bytes(), []byte(`"status":"submitted"`)) {
		t.Fatal(created.Code, created.Body.String())
	}
	owned := advertiserRequest(handler, http.MethodGet, "/advertiser/proposals", "", "advertiser-1")
	if owned.Code != http.StatusOK || !bytes.Contains(owned.Body.Bytes(), []byte("September launch")) {
		t.Fatal(owned.Code, owned.Body.String())
	}
	other := advertiserRequest(handler, http.MethodGet, "/advertiser/proposals", "", "advertiser-2")
	if other.Code != http.StatusOK || bytes.Contains(other.Body.Bytes(), []byte("September launch")) {
		t.Fatal(other.Code, other.Body.String())
	}
	queue := advertiserRequest(handler, http.MethodGet, "/revenue/advertiser-proposals", "", "manager")
	if queue.Code != http.StatusOK || !bytes.Contains(queue.Body.Bytes(), []byte("ama@example.com")) {
		t.Fatal(queue.Code, queue.Body.String())
	}
	if denied := advertiserRequest(handler, http.MethodPost, "/revenue/advertiser-proposals/id_1/approve", `{}`, "advertiser-1"); denied.Code != http.StatusForbidden {
		t.Fatal(denied.Code, denied.Body.String())
	}
	approved := advertiserRequest(handler, http.MethodPost, "/revenue/advertiser-proposals/id_1/approve", `{}`, "manager")
	if approved.Code != http.StatusOK || !bytes.Contains(approved.Body.Bytes(), []byte(`"campaignId":"id_3"`)) {
		t.Fatal(approved.Code, approved.Body.String())
	}
	placement := advertiserRequest(handler, http.MethodGet, "/public/en/ads/home_leaderboard", "", "")
	if placement.Code != http.StatusOK || !bytes.Contains(placement.Body.Bytes(), []byte(`"advertiser":"Acme Ghana"`)) {
		t.Fatal(placement.Code, placement.Body.String())
	}
	repeated := advertiserRequest(handler, http.MethodPost, "/revenue/advertiser-proposals/id_1/approve", `{}`, "manager")
	if repeated.Code != http.StatusConflict {
		t.Fatal(repeated.Code, repeated.Body.String())
	}
}

func TestAdvertiserProposalRejectAndInputGuards(t *testing.T) {
	handler := advertiserServer()
	for _, test := range []struct {
		user, body string
		want       int
	}{
		{"", advertiserProposalJSON, http.StatusForbidden},
		{"manager", advertiserProposalJSON, http.StatusCreated},
		{"advertiser-1", `{`, http.StatusBadRequest},
		{"advertiser-1", `{"contactName":"Ama","contactEmail":"bad"}`, http.StatusBadRequest},
	} {
		response := advertiserRequest(handler, http.MethodPost, "/advertiser/proposals", test.body, test.user)
		if response.Code != test.want {
			t.Errorf("user %q: got %d want %d: %s", test.user, response.Code, test.want, response.Body.String())
		}
	}
	created := advertiserRequest(handler, http.MethodPost, "/advertiser/proposals", advertiserProposalJSON, "advertiser-1")
	if created.Code != http.StatusCreated {
		t.Fatal(created.Code, created.Body.String())
	}
	rejected := advertiserRequest(handler, http.MethodPost, "/revenue/advertiser-proposals/id_3/reject", `{"note":"Please revise the campaign timing."}`, "manager")
	if rejected.Code != http.StatusOK || !bytes.Contains(rejected.Body.Bytes(), []byte(`"status":"rejected"`)) {
		t.Fatal(rejected.Code, rejected.Body.String())
	}
	if unsigned := advertiserRequest(handler, http.MethodGet, "/advertiser/proposals", "", ""); unsigned.Code != http.StatusForbidden {
		t.Fatal(unsigned.Code, unsigned.Body.String())
	}
}
