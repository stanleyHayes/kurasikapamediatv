package http_test

import (
	"bytes"
	"net/http"
	"testing"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestMediaLibraryUploadLifecycle(t *testing.T) {
	handler := televisionServer()
	created := request(handler, http.MethodPost, "/media/assets/uploads", `{"kind":"video","filename":"market-report.mp4","mimeType":"video/mp4","locale":"en","caption":"Market report"}`, true)
	if created.Code != http.StatusCreated || !bytes.Contains(created.Body.Bytes(), []byte(`"signature"`)) {
		t.Fatalf("created: %d %s", created.Code, created.Body.String())
	}
	completed := request(handler, http.MethodPost, "/media/assets/id_1/complete", `{"publicID":"kurasikapa/media/id_1","secureURL":"https://res.cloudinary.test/video.mp4","signature":"provider-signature","version":1,"bytes":4096,"width":1280,"height":720,"durationSeconds":95}`, true)
	if completed.Code != http.StatusOK || !bytes.Contains(completed.Body.Bytes(), []byte(`"ready"`)) {
		t.Fatalf("completed: %d %s", completed.Code, completed.Body.String())
	}
	listed := request(handler, http.MethodGet, "/media/assets?locale=en&limit=20", "", true)
	if listed.Code != http.StatusOK || !bytes.Contains(listed.Body.Bytes(), []byte("market-report.mp4")) {
		t.Fatalf("listed: %d %s", listed.Code, listed.Body.String())
	}
}

func TestMediaLibraryRequiresPermissionAndAccessibleImageMetadata(t *testing.T) {
	handler := televisionServer()
	unauthorised := request(handler, http.MethodGet, "/media/assets", "", false)
	if unauthorised.Code != http.StatusForbidden {
		t.Fatalf("unauthorised: %d", unauthorised.Code)
	}
	image := request(handler, http.MethodPost, "/media/assets/uploads", `{"kind":"image","filename":"newsroom.jpg","mimeType":"image/jpeg","locale":"en"}`, true)
	if image.Code != http.StatusForbidden {
		t.Fatalf("video editor image permission: %d %s", image.Code, image.Body.String())
	}
	admin := routed(emptyEditorial(), map[shared.UserID][]identity.Role{"manager": {identity.RoleAdministrator}})
	missingAlt := request(admin, http.MethodPost, "/media/assets/uploads", `{"kind":"image","filename":"newsroom.jpg","mimeType":"image/jpeg","locale":"en"}`, true)
	if missingAlt.Code != http.StatusBadRequest {
		t.Fatalf("missing alt: %d %s", missingAlt.Code, missingAlt.Body.String())
	}
}
