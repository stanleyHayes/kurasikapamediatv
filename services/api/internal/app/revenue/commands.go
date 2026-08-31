// Package revenue coordinates provider-neutral membership and support flows.
package revenue

import (
	"context"
	"errors"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainrevenue "github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var ErrPlanInactive = errors.New("membership plan is not active")

type Deps struct {
	Plans         ports.MembershipPlanRepository
	Subscriptions ports.SubscriptionRepository
	Donations     ports.DonationRepository
	AdCampaigns   ports.AdCampaignRepository
	AdEvents      ports.AdEventRepository
	Payments      ports.PaymentGateway
	Clock         ports.Clock
	IDs           ports.IDs
}

type CreateMembershipPlan struct{ deps Deps }

func NewCreateMembershipPlan(deps Deps) CreateMembershipPlan { return CreateMembershipPlan{deps: deps} }
func (u CreateMembershipPlan) Execute(ctx context.Context, actor identity.Actor, input domainrevenue.MembershipPlanState) (domainrevenue.MembershipPlan, error) {
	input.ID = shared.MembershipPlanID(u.deps.IDs.NewID())
	plan, err := domainrevenue.NewMembershipPlan(actor, input)
	if err != nil {
		return domainrevenue.MembershipPlan{}, err
	}
	return plan, u.deps.Plans.Save(ctx, plan)
}

type ActivateMembershipPlan struct{ deps Deps }

func NewActivateMembershipPlan(deps Deps) ActivateMembershipPlan {
	return ActivateMembershipPlan{deps: deps}
}

type ListMembershipPlans struct{ deps Deps }

func NewListMembershipPlans(deps Deps) ListMembershipPlans { return ListMembershipPlans{deps: deps} }
func (u ListMembershipPlans) Execute(ctx context.Context) ([]domainrevenue.MembershipPlan, error) {
	return u.deps.Plans.ListActive(ctx)
}
func (u ActivateMembershipPlan) Execute(ctx context.Context, actor identity.Actor, id shared.MembershipPlanID) (domainrevenue.MembershipPlan, error) {
	plan, err := u.deps.Plans.FindByID(ctx, id)
	if err != nil {
		return domainrevenue.MembershipPlan{}, err
	}
	plan, err = plan.Activate(actor, u.deps.Clock.Now())
	if err != nil {
		return domainrevenue.MembershipPlan{}, err
	}
	return plan, u.deps.Plans.Save(ctx, plan)
}

type CheckoutResult struct {
	ID          string
	Provider    domainrevenue.PaymentProvider
	CheckoutURL string
}

type StartSubscriptionInput struct {
	PlanID    shared.MembershipPlanID
	ReaderID  shared.UserID
	Email     string
	ReturnURL string
}

type StartSubscription struct{ deps Deps }

func NewStartSubscription(deps Deps) StartSubscription { return StartSubscription{deps: deps} }
func (u StartSubscription) Execute(ctx context.Context, input StartSubscriptionInput) (CheckoutResult, error) {
	plan, err := u.deps.Plans.FindByID(ctx, input.PlanID)
	if err != nil {
		return CheckoutResult{}, err
	}
	if !plan.State().Active {
		return CheckoutResult{}, ErrPlanInactive
	}
	id := shared.SubscriptionID(u.deps.IDs.NewID())
	session, err := u.deps.Payments.StartCheckout(ctx, ports.CheckoutRequest{
		Reference: id.String(), Purpose: "subscription", Amount: plan.State().Price,
		Interval: plan.State().Interval, Email: input.Email, ReturnURL: input.ReturnURL,
	})
	if err != nil {
		return CheckoutResult{}, err
	}
	subscription, err := domainrevenue.StartSubscription(domainrevenue.SubscriptionState{
		ID: id, PlanID: plan.ID(), ReaderID: input.ReaderID, Email: input.Email, Price: plan.State().Price,
		Provider: session.Provider, ProviderRef: session.ProviderRef,
	}, u.deps.Clock.Now())
	if err != nil {
		return CheckoutResult{}, err
	}
	if err = u.deps.Subscriptions.Save(ctx, subscription); err != nil {
		return CheckoutResult{}, err
	}
	return CheckoutResult{ID: id.String(), Provider: session.Provider, CheckoutURL: session.CheckoutURL}, nil
}

type RecordDonationInput struct {
	Amount    domainrevenue.Money
	Email     string
	Message   string
	Anonymous bool
	ReturnURL string
}

type RecordDonation struct{ deps Deps }

func NewRecordDonation(deps Deps) RecordDonation { return RecordDonation{deps: deps} }
func (u RecordDonation) Execute(ctx context.Context, input RecordDonationInput) (CheckoutResult, error) {
	if _, err := domainrevenue.NewMoney(input.Amount.Minor, input.Amount.Currency); err != nil {
		return CheckoutResult{}, err
	}
	id := shared.DonationID(u.deps.IDs.NewID())
	session, err := u.deps.Payments.StartCheckout(ctx, ports.CheckoutRequest{
		Reference: id.String(), Purpose: "donation", Amount: input.Amount,
		Email: input.Email, ReturnURL: input.ReturnURL,
	})
	if err != nil {
		return CheckoutResult{}, err
	}
	donation, err := domainrevenue.StartDonation(domainrevenue.DonationState{
		ID: id, Amount: input.Amount, Provider: session.Provider,
		ProviderRef: session.ProviderRef, Email: input.Email, Message: input.Message,
		Anonymous: input.Anonymous,
	}, u.deps.Clock.Now())
	if err != nil {
		return CheckoutResult{}, err
	}
	if err = u.deps.Donations.Save(ctx, donation); err != nil {
		return CheckoutResult{}, err
	}
	return CheckoutResult{ID: id.String(), Provider: session.Provider, CheckoutURL: session.CheckoutURL}, nil
}

type CheckEntitlement struct{ deps Deps }

func NewCheckEntitlement(deps Deps) CheckEntitlement { return CheckEntitlement{deps: deps} }
func (u CheckEntitlement) Execute(ctx context.Context, reader shared.UserID, at time.Time) (bool, error) {
	_, err := u.deps.Subscriptions.FindEntitledForReader(ctx, reader, at)
	if errors.Is(err, ports.ErrNotFound) {
		return false, nil
	}
	return err == nil, err
}

type ConfirmSubscriptionPayment struct{ deps Deps }

func NewConfirmSubscriptionPayment(deps Deps) ConfirmSubscriptionPayment {
	return ConfirmSubscriptionPayment{deps: deps}
}
func (u ConfirmSubscriptionPayment) Execute(ctx context.Context, id shared.SubscriptionID, paymentRef string) (domainrevenue.Subscription, error) {
	subscription, err := u.deps.Subscriptions.FindByID(ctx, id)
	if err != nil {
		return domainrevenue.Subscription{}, err
	}
	if subscription.State().Status == domainrevenue.SubscriptionActive && subscription.State().PaymentRef == paymentRef {
		return subscription, nil
	}
	plan, err := u.deps.Plans.FindByID(ctx, subscription.State().PlanID)
	if err != nil {
		return domainrevenue.Subscription{}, err
	}
	paidAt := u.deps.Clock.Now()
	through := paidAt.AddDate(0, 1, 0)
	if plan.State().Interval == domainrevenue.IntervalYearly {
		through = paidAt.AddDate(1, 0, 0)
	}
	subscription, err = subscription.ConfirmPayment(paymentRef, paidAt, through)
	if err != nil {
		return domainrevenue.Subscription{}, err
	}
	return subscription, u.deps.Subscriptions.Save(ctx, subscription)
}

type ConfirmDonationPayment struct{ deps Deps }

func NewConfirmDonationPayment(deps Deps) ConfirmDonationPayment {
	return ConfirmDonationPayment{deps: deps}
}
func (u ConfirmDonationPayment) Execute(ctx context.Context, id shared.DonationID, paymentRef string) (domainrevenue.Donation, error) {
	donation, err := u.deps.Donations.FindByID(ctx, id)
	if err != nil {
		return domainrevenue.Donation{}, err
	}
	if donation.State().Status == domainrevenue.PaymentSucceeded && donation.State().PaymentRef == paymentRef {
		return donation, nil
	}
	donation, err = donation.Confirm(paymentRef, u.deps.Clock.Now())
	if err != nil {
		return domainrevenue.Donation{}, err
	}
	return donation, u.deps.Donations.Save(ctx, donation)
}
