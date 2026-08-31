package revenue

import (
	"errors"
	"strings"
	"time"

	"github.com/kurasikapa/api/internal/domain/shared"
)

type PaymentStatus string

const (
	PaymentPending   PaymentStatus = "pending"
	PaymentSucceeded PaymentStatus = "succeeded"
	PaymentFailed    PaymentStatus = "failed"
)

var ErrPaymentAlreadyFinal = errors.New("payment is already final")

type DonationState struct {
	ID          shared.DonationID
	Amount      Money
	Provider    PaymentProvider
	ProviderRef string
	PaymentRef  string
	Email       string
	Message     string
	Anonymous   bool
	Status      PaymentStatus
	StartedAt   time.Time
	PaidAt      *time.Time
}

type Donation struct{ state DonationState }

func StartDonation(state DonationState, at time.Time) (Donation, error) {
	if state.ID == "" {
		return Donation{}, shared.ErrEmptyID
	}
	if err := validateMoney(state.Amount); err != nil {
		return Donation{}, err
	}
	if err := validateProvider(state.Provider, state.ProviderRef); err != nil {
		return Donation{}, err
	}
	state.Email, state.Message = strings.TrimSpace(state.Email), strings.TrimSpace(state.Message)
	state.Status, state.StartedAt, state.PaymentRef, state.PaidAt = PaymentPending, at, "", nil
	return Donation{state: state}, nil
}

func ReconstituteDonation(state DonationState) Donation { return Donation{state: state} }
func (d Donation) ID() shared.DonationID                { return d.state.ID }
func (d Donation) State() DonationState                 { return d.state }
func (d Donation) Confirm(ref string, at time.Time) (Donation, error) {
	if d.state.Status != PaymentPending {
		return Donation{}, ErrPaymentAlreadyFinal
	}
	if ref == "" {
		return Donation{}, ErrMissingProviderRef
	}
	d.state.Status, d.state.PaymentRef, d.state.PaidAt = PaymentSucceeded, ref, &at
	return d, nil
}
