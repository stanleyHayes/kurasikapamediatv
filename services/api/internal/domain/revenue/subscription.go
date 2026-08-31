package revenue

import (
	"errors"
	"time"

	"github.com/kurasikapa/api/internal/domain/shared"
)

type PaymentProvider string
type SubscriptionStatus string

const (
	ProviderPaystack PaymentProvider = "paystack"
	ProviderStripe   PaymentProvider = "stripe"

	SubscriptionPending  SubscriptionStatus = "pending"
	SubscriptionActive   SubscriptionStatus = "active"
	SubscriptionCanceled SubscriptionStatus = "canceled"
	SubscriptionPastDue  SubscriptionStatus = "past_due"
)

var (
	ErrInvalidProvider        = errors.New("payment provider must be paystack or stripe")
	ErrMissingProviderRef     = errors.New("payment provider reference cannot be empty")
	ErrSubscriptionNotPending = errors.New("only a pending subscription can be confirmed")
	ErrSubscriptionNotActive  = errors.New("only an active subscription can be canceled")
	ErrInvalidPaidThrough     = errors.New("paid-through time must follow payment time")
)

type SubscriptionState struct {
	ID          shared.SubscriptionID
	PlanID      shared.MembershipPlanID
	ReaderID    shared.UserID
	Price       Money
	Provider    PaymentProvider
	ProviderRef string
	PaymentRef  string
	Status      SubscriptionStatus
	StartedAt   time.Time
	PaidAt      *time.Time
	PaidThrough *time.Time
	CanceledAt  *time.Time
}

type Subscription struct{ state SubscriptionState }

func StartSubscription(state SubscriptionState, at time.Time) (Subscription, error) {
	if state.ID == "" || state.PlanID == "" || state.ReaderID == "" {
		return Subscription{}, shared.ErrEmptyID
	}
	if err := validateMoney(state.Price); err != nil {
		return Subscription{}, err
	}
	if err := validateProvider(state.Provider, state.ProviderRef); err != nil {
		return Subscription{}, err
	}
	state.Status, state.StartedAt = SubscriptionPending, at
	state.PaymentRef, state.PaidAt, state.PaidThrough, state.CanceledAt = "", nil, nil, nil
	return Subscription{state: state}, nil
}

func ReconstituteSubscription(state SubscriptionState) Subscription {
	return Subscription{state: state}
}
func (s Subscription) ID() shared.SubscriptionID { return s.state.ID }
func (s Subscription) State() SubscriptionState  { return s.state }
func (s Subscription) ConfirmPayment(ref string, at, through time.Time) (Subscription, error) {
	if s.state.Status != SubscriptionPending {
		return Subscription{}, ErrSubscriptionNotPending
	}
	if ref == "" {
		return Subscription{}, ErrMissingProviderRef
	}
	if !through.After(at) {
		return Subscription{}, ErrInvalidPaidThrough
	}
	s.state.Status, s.state.PaymentRef = SubscriptionActive, ref
	s.state.PaidAt, s.state.PaidThrough = &at, &through
	return s, nil
}
func (s Subscription) Cancel(at time.Time) (Subscription, error) {
	if s.state.Status != SubscriptionActive {
		return Subscription{}, ErrSubscriptionNotActive
	}
	s.state.Status, s.state.CanceledAt = SubscriptionCanceled, &at
	return s, nil
}
func (s Subscription) EntitledAt(at time.Time) bool {
	if s.state.Status != SubscriptionActive && s.state.Status != SubscriptionCanceled {
		return false
	}
	return s.state.PaidThrough != nil && at.Before(*s.state.PaidThrough)
}

func validateProvider(provider PaymentProvider, ref string) error {
	if provider != ProviderPaystack && provider != ProviderStripe {
		return ErrInvalidProvider
	}
	if ref == "" {
		return ErrMissingProviderRef
	}
	return nil
}
