package http_test

import (
	"bytes"
	"net/http"
	"testing"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func staffServer() http.Handler {
	return routed(emptyEditorial(), map[shared.UserID][]identity.Role{"manager": {identity.RoleAdministrator}})
}

func TestStaffProfileEndpointsPublishCredibleDirectory(t *testing.T) {
	handler := staffServer()
	body := `{"locale":"en","displayName":"Ama Mensah","jobTitle":"Senior reporter","biography":"Ama reports on public policy and local government.","portraitAssetId":"portrait","socialLinks":[{"label":"LinkedIn","url":"https://linkedin.com/in/ama"}]}`
	created := request(handler, http.MethodPut, "/staff/profiles/journalist", body, true)
	if created.Code != http.StatusOK {
		t.Fatalf("create: %d %s", created.Code, created.Body.String())
	}
	published := request(handler, http.MethodPost, "/staff/profiles/id_1/publish", "", true)
	if published.Code != http.StatusOK {
		t.Fatalf("publish: %d %s", published.Code, published.Body.String())
	}
	for _, path := range []string{"/public/en/team", "/public/en/team/ama-mensah", "/public/en/team/by-user/journalist"} {
		response := request(handler, http.MethodGet, path, "", false)
		if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte("https://cdn.test/portrait.jpg")) {
			t.Fatalf("%s: %d %s", path, response.Code, response.Body.String())
		}
	}
}

func TestStaffProfileEndpointsRejectUnsafeRequests(t *testing.T) {
	handler := staffServer()
	invalid := `{"locale":"en","displayName":"Ama","jobTitle":"Reporter","biography":"Biography","portraitAssetId":"portrait","socialLinks":[{"label":"Site","url":"http://unsafe.test"}]}`
	tests := []struct {
		method, path, body string
		auth               bool
		want               int
	}{
		{http.MethodPut, "/staff/profiles/journalist", `{}`, false, http.StatusForbidden},
		{http.MethodPut, "/staff/profiles/journalist", `{`, true, http.StatusBadRequest},
		{http.MethodPut, "/staff/profiles/journalist", invalid, true, http.StatusBadRequest},
		{http.MethodGet, "/public/en/team/missing", "", false, http.StatusNotFound},
	}
	for _, tt := range tests {
		response := request(handler, tt.method, tt.path, tt.body, tt.auth)
		if response.Code != tt.want {
			t.Errorf("%s %s = %d, want %d: %s", tt.method, tt.path, response.Code, tt.want, response.Body.String())
		}
	}
}
