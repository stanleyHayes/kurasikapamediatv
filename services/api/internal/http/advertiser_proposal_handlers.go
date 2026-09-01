package http

import (
	"context"
	"net/http"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func (d Deps) handleSubmitAdvertiserProposal(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input revenue.AdvertiserProposalState
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	proposal, err := d.SubmitAdvertiserProposal.Execute(r.Context(), actor, input)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, advertiserProposalView(proposal))
}

func (d Deps) handleListOwnAdvertiserProposals(w http.ResponseWriter, r *http.Request) {
	d.writeAdvertiserProposals(w, r, d.ListOwnAdvertiserProposals.Execute)
}
func (d Deps) handleListAdvertiserProposalQueue(w http.ResponseWriter, r *http.Request) {
	d.writeAdvertiserProposals(w, r, d.ListAdvertiserProposalQueue.Execute)
}
func (d Deps) writeAdvertiserProposals(w http.ResponseWriter, r *http.Request, list func(context.Context, identity.Actor) ([]revenue.AdvertiserProposal, error)) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	items, err := list(r.Context(), actor)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	views := make([]map[string]any, len(items))
	for index, item := range items {
		views[index] = advertiserProposalView(item)
	}
	writeJSON(w, d.Log, http.StatusOK, map[string]any{"items": views})
}

func (d Deps) handleApproveAdvertiserProposal(w http.ResponseWriter, r *http.Request) {
	d.reviewAdvertiserProposal(w, r, true)
}
func (d Deps) handleRejectAdvertiserProposal(w http.ResponseWriter, r *http.Request) {
	d.reviewAdvertiserProposal(w, r, false)
}
func (d Deps) reviewAdvertiserProposal(w http.ResponseWriter, r *http.Request, approve bool) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	id := shared.AdvertiserProposalID(r.PathValue("id"))
	var proposal revenue.AdvertiserProposal
	if approve {
		proposal, err = d.ApproveAdvertiserProposal.Execute(r.Context(), actor, id)
	} else {
		var input struct {
			Note string `json:"note"`
		}
		if err = decode(r, &input); err == nil {
			proposal, err = d.RejectAdvertiserProposal.Execute(r.Context(), actor, id, input.Note)
		}
	}
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, advertiserProposalView(proposal))
}

func advertiserProposalView(proposal revenue.AdvertiserProposal) map[string]any {
	s := proposal.State()
	c := s.Campaign
	return map[string]any{
		"id": s.ID.String(), "ownerId": s.OwnerID.String(), "contactName": s.ContactName,
		"contactEmail": s.ContactEmail, "status": s.Status, "submittedAt": s.SubmittedAt,
		"reviewedAt": s.ReviewedAt, "reviewedBy": s.ReviewedBy.String(),
		"campaignId": s.CampaignID.String(), "reviewNote": s.ReviewNote,
		"campaign": map[string]any{"name": c.Name, "advertiser": c.Advertiser, "locale": c.Locale,
			"slot": c.Slot, "creativeURL": c.CreativeURL, "altText": c.AltText,
			"landingURL": c.LandingURL, "budget": c.Budget, "cpmMinor": c.CPMMinor,
			"priority": c.Priority, "startsAt": c.StartsAt, "endsAt": c.EndsAt},
	}
}
