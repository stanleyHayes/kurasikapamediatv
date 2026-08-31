package http_test

import (
	"bytes"
	"net/http"
	"testing"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestArticleHeroAttachmentUsesVerifiedMedia(t *testing.T) {
	handler := routed(emptyEditorial(), map[shared.UserID][]identity.Role{
		"manager": {identity.RoleAdministrator},
	})

	created := request(handler, http.MethodPost, "/articles", `{"locale":"en","title":"Market report","body":"Verified reporting.","categoryId":"business"}`, true)
	if created.Code != http.StatusCreated {
		t.Fatalf("article: %d %s", created.Code, created.Body.String())
	}
	upload := request(handler, http.MethodPost, "/media/assets/uploads", `{"kind":"image","filename":"market.jpg","mimeType":"image/jpeg","locale":"en","altText":"A reporter interviewing traders"}`, true)
	if upload.Code != http.StatusCreated {
		t.Fatalf("upload: %d %s", upload.Code, upload.Body.String())
	}
	completed := request(handler, http.MethodPost, "/media/assets/id_1/complete", `{"publicID":"kurasikapa/media/id_1","secureURL":"https://res.cloudinary.test/market.jpg","signature":"signed","version":1,"bytes":4096,"width":1600,"height":900}`, true)
	if completed.Code != http.StatusOK {
		t.Fatalf("complete: %d %s", completed.Code, completed.Body.String())
	}
	attached := request(handler, http.MethodPut, "/articles/id_1/hero", `{"assetId":"id_1","caption":"Traders discuss food prices.","credit":"Kurasikapa / Ama Mensah"}`, true)
	if attached.Code != http.StatusOK || !bytes.Contains(attached.Body.Bytes(), []byte(`"credit":"Kurasikapa / Ama Mensah"`)) {
		t.Fatalf("attach: %d %s", attached.Code, attached.Body.String())
	}
}
