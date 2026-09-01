package http

import "net/http"

func (d Deps) handleSEOReport(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	report, err := d.BuildSEOReport.Execute(r.Context(), actor)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, report)
}
