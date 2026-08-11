package http

import (
	"net/http"
	"strconv"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func (d Deps) handleGetPublished(w http.ResponseWriter, r *http.Request) {
	got, err := d.GetPublishedArticle.Execute(r.Context(), appeditorial.GetPublishedInput{
		Slug: r.PathValue("slug"), Locale: r.PathValue("locale"),
	})
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}
	writeJSON(w, d.Log, http.StatusOK, got)
}

func (d Deps) handleListPublished(w http.ResponseWriter, r *http.Request) {
	got, err := d.ListPublishedArticles.Execute(r.Context(), publicListInput(r))
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}
	writeJSON(w, d.Log, http.StatusOK, got)
}

func (d Deps) handleBrowseCategory(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	got, err := d.BrowseCategory.Execute(r.Context(), appeditorial.BrowseInput{
		Slug:   r.PathValue("slug"),
		Locale: r.PathValue("locale"),
		After:  r.URL.Query().Get("after"),
		Limit:  limit,
	})
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}
	writeJSON(w, d.Log, http.StatusOK, got)
}

func (d Deps) handleListSections(w http.ResponseWriter, r *http.Request) {
	got, err := d.ListSections.Execute(r.Context(), r.PathValue("locale"))
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}
	writeJSON(w, d.Log, http.StatusOK, struct {
		Items []appeditorial.SectionView `json:"items"`
	}{Items: got})
}

func publicListInput(r *http.Request) appeditorial.PublicListInput {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	return appeditorial.PublicListInput{
		Locale:     r.PathValue("locale"),
		CategoryID: shared.CategoryID(r.URL.Query().Get("categoryId")),
		After:      r.URL.Query().Get("after"),
		Limit:      limit,
	}
}
