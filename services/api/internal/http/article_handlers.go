package http

import (
	"net/http"
	"time"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type createDraftBody struct {
	Locale     string `json:"locale"`
	Title      string `json:"title"`
	Body       string `json:"body"`
	CategoryID string `json:"categoryId"`
	FamilyID   string `json:"familyId"`
}

func (d Deps) handleCreateDraft(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}

	var body createDraftBody
	if err := decode(r, &body); err != nil {
		writeProblem(w, d.Log, err)

		return
	}

	article, err := d.CreateDraft.Execute(r.Context(), appeditorial.CreateDraftInput{
		Actor:    actor,
		Locale:   body.Locale,
		Title:    body.Title,
		Body:     body.Body,
		Category: shared.CategoryID(body.CategoryID),
		FamilyID: shared.FamilyID(body.FamilyID),
	})
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}

	writeJSON(w, d.Log, http.StatusCreated, articleView(article))
}

func (d Deps) handlePublish(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}

	article, err := d.PublishArticle.Execute(r.Context(), appeditorial.PublishArticleInput{
		Actor:     actor,
		ArticleID: shared.ArticleID(r.PathValue("id")),
	})
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}

	writeJSON(w, d.Log, http.StatusOK, articleView(article))
}

type updateDraftBody struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

func (d Deps) handleUpdateDraft(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}

	var body updateDraftBody
	if err := decode(r, &body); err != nil {
		writeProblem(w, d.Log, err)

		return
	}

	result, err := d.UpdateDraft.Execute(r.Context(), appeditorial.UpdateDraftInput{
		Actor:     actor,
		ArticleID: shared.ArticleID(r.PathValue("id")),
		Title:     body.Title,
		Body:      body.Body,
	})
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}

	writeJSON(w, d.Log, http.StatusOK, result)
}

func (d Deps) handleSubmit(w http.ResponseWriter, r *http.Request) {
	d.withActor(w, r, func(actor identity.Actor) {
		result, err := d.SubmitForReview.Execute(r.Context(), appeditorial.SubmitInput{
			Actor: actor, ArticleID: shared.ArticleID(r.PathValue("id")),
		})
		if err != nil {
			writeProblem(w, d.Log, err)

			return
		}
		writeJSON(w, d.Log, http.StatusOK, result)
	})
}

type approveBody struct {
	RevisionID string `json:"revisionId"`
}

func (d Deps) handleApprove(w http.ResponseWriter, r *http.Request) {
	d.withActor(w, r, func(actor identity.Actor) {
		var body approveBody
		if err := decode(r, &body); err != nil {
			writeProblem(w, d.Log, err)

			return
		}

		result, err := d.ApproveArticle.Execute(r.Context(), appeditorial.ApproveInput{
			Actor:      actor,
			ArticleID:  shared.ArticleID(r.PathValue("id")),
			RevisionID: shared.RevisionID(body.RevisionID),
		})
		if err != nil {
			writeProblem(w, d.Log, err)

			return
		}
		writeJSON(w, d.Log, http.StatusOK, result)
	})
}

type rejectBody struct {
	Note string `json:"note"`
}

func (d Deps) handleReject(w http.ResponseWriter, r *http.Request) {
	d.withActor(w, r, func(actor identity.Actor) {
		var body rejectBody
		if err := decode(r, &body); err != nil {
			writeProblem(w, d.Log, err)

			return
		}

		result, err := d.RejectArticle.Execute(r.Context(), appeditorial.RejectInput{
			Actor: actor, ArticleID: shared.ArticleID(r.PathValue("id")), Note: body.Note,
		})
		if err != nil {
			writeProblem(w, d.Log, err)

			return
		}
		writeJSON(w, d.Log, http.StatusOK, result)
	})
}

type scheduleBody struct {
	At time.Time `json:"at"`
}

func (d Deps) handleSchedule(w http.ResponseWriter, r *http.Request) {
	d.withActor(w, r, func(actor identity.Actor) {
		var body scheduleBody
		if err := decode(r, &body); err != nil {
			writeProblem(w, d.Log, err)

			return
		}

		result, err := d.SchedulePublication.Execute(r.Context(), appeditorial.ScheduleInput{
			Actor: actor, ArticleID: shared.ArticleID(r.PathValue("id")), At: body.At,
		})
		if err != nil {
			writeProblem(w, d.Log, err)

			return
		}
		writeJSON(w, d.Log, http.StatusOK, result)
	})
}

type unpublishBody struct {
	Reason string `json:"reason"`
}

func (d Deps) handleUnpublish(w http.ResponseWriter, r *http.Request) {
	d.withActor(w, r, func(actor identity.Actor) {
		var body unpublishBody
		if err := decode(r, &body); err != nil {
			writeProblem(w, d.Log, err)

			return
		}

		result, err := d.UnpublishArticle.Execute(r.Context(), appeditorial.UnpublishInput{
			Actor: actor, ArticleID: shared.ArticleID(r.PathValue("id")), Reason: body.Reason,
		})
		if err != nil {
			writeProblem(w, d.Log, err)

			return
		}
		writeJSON(w, d.Log, http.StatusOK, result)
	})
}

func (d Deps) withActor(w http.ResponseWriter, r *http.Request, next func(identity.Actor)) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)

		return
	}
	next(actor)
}
