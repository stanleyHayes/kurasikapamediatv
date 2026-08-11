package http

import (
	"net/http"
	"strconv"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func (d Deps) handleGetDraft(w http.ResponseWriter, r *http.Request) {
	d.withActor(w, r, func(actor identity.Actor) {
		got, err := d.GetDraft.Execute(r.Context(), appeditorial.GetDraftInput{
			Actor: actor, ArticleID: shared.ArticleID(r.PathValue("id")),
		})
		if err != nil {
			writeProblem(w, d.Log, err)

			return
		}
		writeJSON(w, d.Log, http.StatusOK, got)
	})
}

func (d Deps) handleListRevisions(w http.ResponseWriter, r *http.Request) {
	d.withActor(w, r, func(actor identity.Actor) {
		got, err := d.ListRevisions.Execute(r.Context(), appeditorial.HistoryInput{
			Actor: actor, ArticleID: shared.ArticleID(r.PathValue("id")),
		})
		if err != nil {
			writeProblem(w, d.Log, err)

			return
		}
		writeJSON(w, d.Log, http.StatusOK, got)
	})
}

func (d Deps) handleRestore(w http.ResponseWriter, r *http.Request) {
	d.withActor(w, r, func(actor identity.Actor) {
		got, err := d.RestoreRevision.Execute(r.Context(), appeditorial.RestoreInput{
			Actor:      actor,
			ArticleID:  shared.ArticleID(r.PathValue("id")),
			RevisionID: shared.RevisionID(r.PathValue("rid")),
		})
		if err != nil {
			writeProblem(w, d.Log, err)

			return
		}
		writeJSON(w, d.Log, http.StatusOK, got)
	})
}

func (d Deps) handleListAuthored(w http.ResponseWriter, r *http.Request) {
	d.withActor(w, r, func(actor identity.Actor) {
		got, err := d.ListAuthoredArticles.Execute(r.Context(), listInput(r, actor))
		if err != nil {
			writeProblem(w, d.Log, err)

			return
		}
		writeJSON(w, d.Log, http.StatusOK, got)
	})
}

func (d Deps) handleListReview(w http.ResponseWriter, r *http.Request) {
	d.withActor(w, r, func(actor identity.Actor) {
		got, err := d.ListAwaitingReview.Execute(r.Context(), listInput(r, actor))
		if err != nil {
			writeProblem(w, d.Log, err)

			return
		}
		writeJSON(w, d.Log, http.StatusOK, got)
	})
}

func listInput(r *http.Request, actor identity.Actor) appeditorial.ListInput {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	return appeditorial.ListInput{
		Actor: actor,
		After: r.URL.Query().Get("after"),
		Limit: limit,
	}
}
