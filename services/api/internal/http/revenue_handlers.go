package http

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/kurasikapa/api/internal/app/ports"
	apprevenue "github.com/kurasikapa/api/internal/app/revenue"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type membershipPlanRequest struct {
	Name, Slug, Description string
	Interval                revenue.BillingInterval
	Price                   revenue.Money
	Benefits                []string
}

func (d Deps) handleCreateMembershipPlan(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input membershipPlanRequest
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	plan, err := d.CreateMembershipPlan.Execute(r.Context(), actor, revenue.MembershipPlanState{
		Name: input.Name, Slug: input.Slug, Description: input.Description,
		Interval: input.Interval, Price: input.Price, Benefits: input.Benefits,
	})
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, membershipPlanView(plan))
}

func (d Deps) handleActivateMembershipPlan(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	plan, err := d.ActivateMembershipPlan.Execute(r.Context(), actor, shared.MembershipPlanID(r.PathValue("id")))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, membershipPlanView(plan))
}

func (d Deps) handleListMembershipPlans(w http.ResponseWriter, r *http.Request) {
	plans, err := d.ListMembershipPlans.Execute(r.Context())
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	items := make([]map[string]any, len(plans))
	for i, plan := range plans {
		items[i] = membershipPlanView(plan)
	}
	writeJSON(w, d.Log, http.StatusOK, map[string]any{"items": items})
}

type subscriptionCheckoutRequest struct {
	PlanID, Email, ReturnURL string
}

func (d Deps) handleStartSubscription(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input subscriptionCheckoutRequest
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	result, err := d.StartSubscription.Execute(r.Context(), apprevenue.StartSubscriptionInput{
		PlanID: shared.MembershipPlanID(input.PlanID), ReaderID: actor.ID(),
		Email: input.Email, ReturnURL: input.ReturnURL,
	})
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, result)
}

func (d Deps) handleRecordDonation(w http.ResponseWriter, r *http.Request) {
	var input apprevenue.RecordDonationInput
	if err := decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	result, err := d.RecordDonation.Execute(r.Context(), input)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, result)
}

func (d Deps) handleCheckEntitlement(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	allowed, err := d.CheckEntitlement.Execute(r.Context(), actor.ID(), d.Clock.Now())
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, map[string]bool{"entitled": allowed})
}

func (d Deps) handleRevenueReport(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	report, err := d.BuildRevenueReport.Execute(r.Context(), actor, days)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, report)
}

func (d Deps) handleCreateAdCampaign(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input revenue.AdCampaignState
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	campaign, err := d.CreateAdCampaign.Execute(r.Context(), actor, input)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, campaign.State())
}

func (d Deps) handleActivateAdCampaign(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	campaign, err := d.ActivateAdCampaign.Execute(r.Context(), actor, shared.AdCampaignID(r.PathValue("id")))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, campaign.State())
}

func (d Deps) handleResolveAdPlacement(w http.ResponseWriter, r *http.Request) {
	campaign, err := d.ResolveAdPlacement.Execute(r.Context(), revenue.AdSlot(r.PathValue("slot")), r.PathValue("locale"))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	if campaign == nil {
		writeJSON(w, d.Log, http.StatusOK, map[string]any{"placement": nil})
		return
	}
	s := campaign.State()
	writeJSON(w, d.Log, http.StatusOK, map[string]any{"placement": map[string]any{"id": s.ID.String(), "advertiser": s.Advertiser, "creativeUrl": s.CreativeURL, "altText": s.AltText, "landingUrl": s.LandingURL}})
}

func (d Deps) handleRecordAdEvent(w http.ResponseWriter, r *http.Request) {
	var input struct{ Kind revenue.AdEventKind }
	if err := decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	if _, err := d.RecordAdEvent.Execute(r.Context(), shared.AdCampaignID(r.PathValue("id")), input.Kind); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (d Deps) handleAdReport(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	report, err := d.BuildAdReport.Execute(r.Context(), actor)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, map[string]any{"campaigns": report})
}

func membershipPlanView(plan revenue.MembershipPlan) map[string]any {
	s := plan.State()
	return map[string]any{"id": s.ID.String(), "name": s.Name, "slug": s.Slug,
		"description": s.Description, "interval": s.Interval, "price": s.Price,
		"benefits": s.Benefits, "active": s.Active, "activatedAt": s.ActivatedAt}
}

func (d Deps) handlePaymentWebhook(w http.ResponseWriter, r *http.Request) {
	provider := revenue.PaymentProvider(r.PathValue("provider"))
	signature := r.Header.Get("Stripe-Signature")
	if provider == revenue.ProviderPaystack {
		signature = r.Header.Get("X-Paystack-Signature")
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		writeProblem(w, d.Log, fmt.Errorf("%w: %v", errMalformedRequest, err))
		return
	}
	event, err := d.PaymentWebhooks.Verify(provider, signature, body, d.Clock.Now())
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	switch event.Purpose {
	case "subscription":
		_, err = d.ConfirmSubscriptionPayment.Execute(r.Context(), shared.SubscriptionID(event.ResourceID), event.PaymentRef)
	case "donation":
		_, err = d.ConfirmDonationPayment.Execute(r.Context(), shared.DonationID(event.ResourceID), event.PaymentRef)
	case "product":
		_, err = d.ConfirmProductOrder.Execute(r.Context(), shared.ProductOrderID(event.ResourceID), event.PaymentRef)
	case "classified":
		_, err = d.ConfirmClassified.Execute(r.Context(), shared.ClassifiedID(event.ResourceID), event.PaymentRef)
	default:
		err = ports.ErrInvalidPaymentWebhook
	}
	if err != nil && !errors.Is(err, revenue.ErrPaymentAlreadyFinal) {
		writeProblem(w, d.Log, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
