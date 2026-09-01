package http

import (
	"net/http"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func (d Deps) handleCreateAffiliateLink(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input revenue.AffiliateLinkState
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	link, err := d.CreateAffiliateLink.Execute(r.Context(), actor, input)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, link.State())
}
func (d Deps) handleActivateAffiliateLink(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	link, err := d.ActivateAffiliateLink.Execute(r.Context(), actor, shared.AffiliateLinkID(r.PathValue("id")))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, link.State())
}
func (d Deps) handleListAffiliateLinks(w http.ResponseWriter, r *http.Request) {
	d.writeAffiliateLinks(w, r, nil)
}
func (d Deps) handleManageAffiliateLinks(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	d.writeAffiliateLinks(w, r, &actor)
}
func (d Deps) writeAffiliateLinks(w http.ResponseWriter, r *http.Request, actor *identity.Actor) {
	items, err := d.ListAffiliateLinks.Execute(r.Context(), actor)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	if actor == nil {
		views := make([]affiliatePublicView, len(items))
		for i, item := range items {
			views[i] = publicAffiliate(item.State())
		}
		writeJSON(w, d.Log, http.StatusOK, map[string]any{"items": views})
		return
	}
	views := make([]revenue.AffiliateLinkState, len(items))
	for i, item := range items {
		views[i] = item.State()
	}
	writeJSON(w, d.Log, http.StatusOK, map[string]any{"items": views})
}

type affiliatePublicView struct {
	ID          string `json:"id"`
	Partner     string `json:"partner"`
	Title       string `json:"title"`
	Category    string `json:"category"`
	Description string `json:"description"`
	Disclosure  string `json:"disclosure"`
	ImageURL    string `json:"imageURL"`
	ImageAlt    string `json:"imageAlt"`
}

func publicAffiliate(state revenue.AffiliateLinkState) affiliatePublicView {
	return affiliatePublicView{ID: state.ID.String(), Partner: state.Partner, Title: state.Title, Category: state.Category, Description: state.Description, Disclosure: state.Disclosure, ImageURL: state.ImageURL, ImageAlt: state.ImageAlt}
}
func (d Deps) handleFollowAffiliateLink(w http.ResponseWriter, r *http.Request) {
	destination, err := d.FollowAffiliateLink.Execute(r.Context(), shared.AffiliateLinkID(r.PathValue("id")))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, map[string]string{"destinationURL": destination})
}
