package http_test

import (
	"bytes"
	"net/http"
	"testing"
)

func TestVideoGalleryLifecycleAndPublicLibrary(t *testing.T) {
	handler := televisionServer()
	createReadyAsset(t, handler, "video", "dispatch.mp4", "id_1")
	createReadyAsset(t, handler, "caption", "dispatch.vtt", "id_2")
	gallery := request(handler, http.MethodPost, "/media/galleries", `{"kind":"video","title":"Accra dispatch","slug":"accra-dispatch","locale":"en","summary":"Original reporting from the capital","items":[{"assetID":"id_1","captionAssetID":"id_2","caption":"Reporting from central Accra","credit":"Kurasikapa Newsroom"}]}`, true)
	if gallery.Code != http.StatusCreated {
		t.Fatalf("gallery: %d %s", gallery.Code, gallery.Body.String())
	}
	published := request(handler, http.MethodPost, "/media/galleries/id_3/publish", `{}`, true)
	if published.Code != http.StatusOK {
		t.Fatalf("publish: %d %s", published.Code, published.Body.String())
	}
	library := request(handler, http.MethodGet, "/public/en/galleries", "", false)
	if library.Code != http.StatusOK || !bytes.Contains(library.Body.Bytes(), []byte(`"captionUrl"`)) || !bytes.Contains(library.Body.Bytes(), []byte(`"posterUrl"`)) || !bytes.Contains(library.Body.Bytes(), []byte("report.m3u8")) || !bytes.Contains(library.Body.Bytes(), []byte("Accra dispatch")) {
		t.Fatalf("library: %d %s", library.Code, library.Body.String())
	}
}

func TestGalleryEndpointsRejectUnsafePublication(t *testing.T) {
	handler := televisionServer()
	if response := request(handler, http.MethodPost, "/media/galleries", `{}`, false); response.Code != http.StatusForbidden {
		t.Fatalf("unauthorised: %d", response.Code)
	}
	if response := request(handler, http.MethodPost, "/media/galleries", `{"kind":"video","title":"","summary":""}`, true); response.Code != http.StatusBadRequest {
		t.Fatalf("invalid: %d %s", response.Code, response.Body.String())
	}
	if response := request(handler, http.MethodPost, "/media/galleries/missing/publish", `{}`, true); response.Code != http.StatusNotFound {
		t.Fatalf("missing: %d %s", response.Code, response.Body.String())
	}
	if response := request(handler, http.MethodPost, "/media/galleries/missing/publish", `{}`, false); response.Code != http.StatusForbidden {
		t.Fatalf("unauthorised publish: %d", response.Code)
	}
	if response := request(handler, http.MethodPost, "/media/galleries", `{`, true); response.Code != http.StatusBadRequest {
		t.Fatalf("malformed: %d %s", response.Code, response.Body.String())
	}
}
