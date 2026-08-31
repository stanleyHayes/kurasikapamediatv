package http

import (
	"net/http"

	"github.com/kurasikapa/api/internal/domain/shared"
)

func (d Deps) handleRequestArticleNarration(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	view, err := d.RequestArticleNarration.Execute(r.Context(), actor, shared.ArticleID(r.PathValue("id")))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusAccepted, view)
}

func (d Deps) handleGetLatestNarration(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	view, err := d.GetLatestNarration.Execute(r.Context(), actor, shared.ArticleID(r.PathValue("id")))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, view)
}

func (d Deps) handleAttachArticleNarration(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	view, err := d.AttachArticleNarration.Execute(
		r.Context(), actor, shared.ArticleID(r.PathValue("id")), shared.NarrationJobID(r.PathValue("jobId")),
	)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, view)
}

func (d Deps) handleProcessNarrations(w http.ResponseWriter, r *http.Request) {
	if !d.requireCron(r) {
		http.NotFound(w, r)
		return
	}
	result, err := d.ProcessNarrationJobs.Execute(r.Context(), systemActor())
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	status := http.StatusOK
	if len(result.Failed) > 0 {
		status = http.StatusMultiStatus
	}
	writeJSON(w, d.Log, status, result)
}
