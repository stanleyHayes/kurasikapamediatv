package http

import (
	"net/http"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
)

const publicAPICache = "public, max-age=60, stale-while-revalidate=300"

type apiEnvelope struct {
	APIVersion string            `json:"apiVersion"`
	Data       any               `json:"data"`
	Pagination *apiPagination    `json:"pagination,omitempty"`
	Links      map[string]string `json:"links"`
}

type apiPagination struct {
	NextCursor string `json:"nextCursor,omitempty"`
}

func (d Deps) handlePublicAPIRoot(w http.ResponseWriter, _ *http.Request) {
	publicAPIHeaders(w)
	w.Header().Set("Cache-Control", "public, max-age=3600")
	writeJSON(w, d.Log, http.StatusOK, map[string]any{
		"name": "Kurasikapa Media public API", "version": "v1",
		"openapi":   "/v1/openapi.json",
		"resources": map[string]string{"articles": "/v1/{locale}/articles"},
	})
}

func (d Deps) handlePublicAPIList(w http.ResponseWriter, r *http.Request) {
	publicAPIHeaders(w)
	got, err := d.ListPublishedArticles.Execute(r.Context(), publicListInput(r))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	links := map[string]string{"self": r.URL.RequestURI()}
	if got.NextCursor != "" {
		query := r.URL.Query()
		query.Set("after", got.NextCursor)
		links["next"] = r.URL.Path + "?" + query.Encode()
	}
	writeJSON(w, d.Log, http.StatusOK, apiEnvelope{
		APIVersion: "v1", Data: got.Items,
		Pagination: &apiPagination{NextCursor: got.NextCursor}, Links: links,
	})
}

func (d Deps) handlePublicAPIArticle(w http.ResponseWriter, r *http.Request) {
	publicAPIHeaders(w)
	got, err := d.GetPublishedArticle.Execute(r.Context(), appeditorial.GetPublishedInput{
		Slug: r.PathValue("slug"), Locale: r.PathValue("locale"),
	})
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, apiEnvelope{
		APIVersion: "v1", Data: got, Links: map[string]string{"self": r.URL.Path},
	})
}

func handlePublicAPIPreflight(w http.ResponseWriter, _ *http.Request) {
	publicAPIHeaders(w)
	w.WriteHeader(http.StatusNoContent)
}

func publicAPIHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type")
	w.Header().Set("Cache-Control", publicAPICache)
	w.Header().Set("X-Content-Type-Options", "nosniff")
}
