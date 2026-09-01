package http_test

import (
	"bytes"
	"net/http"
	"testing"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestSEOReportEndpointIsAuthorizedAndSerializable(t *testing.T) {
	t.Parallel()
	handler := routed(emptyEditorial(), map[shared.UserID][]identity.Role{
		"manager": {identity.RoleEditor},
	})

	response := request(handler, http.MethodGet, "/insight/seo-report", "", true)
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"totalPublished":0`)) {
		t.Fatalf("status = %d body = %s", response.Code, response.Body.String())
	}

	unsigned := request(handler, http.MethodGet, "/insight/seo-report", "", false)
	if unsigned.Code != http.StatusForbidden {
		t.Fatalf("unsigned status = %d", unsigned.Code)
	}
}
