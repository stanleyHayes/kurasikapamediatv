package http

import (
	"net/http"
	"strconv"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func (d Deps) handleProcessSemanticIndex(w http.ResponseWriter, r *http.Request) {
	if !d.requireCron(r) {
		http.NotFound(w, r)
		return
	}
	queued, err := d.QueueSemanticInventory.Execute(r.Context(), []string{"en", "fr"})
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	result, err := d.ProcessSemanticIndex.Execute(r.Context(), limit)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, struct {
		Queue   appeditorial.QueueSemanticResult   `json:"queue"`
		Process appeditorial.ProcessSemanticResult `json:"process"`
	}{Queue: queued, Process: result})
}

func (d Deps) handleSemanticSearch(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	result, err := d.SemanticSearch.Execute(r.Context(), appeditorial.SemanticSearchInput{
		Terms: r.URL.Query().Get("q"), Locale: r.PathValue("locale"), Limit: limit,
	})
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, struct {
		Items []appeditorial.ListedPublic `json:"items"`
	}{Items: result})
}

func (d Deps) handleSemanticRelated(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	result, err := d.SemanticRelated.Execute(r.Context(), shared.ArticleID(r.PathValue("id")), limit)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, struct {
		Items []appeditorial.ListedPublic `json:"items"`
	}{Items: result})
}
