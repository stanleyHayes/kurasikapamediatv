package revenue

import (
	"errors"
	"strings"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type ClassifiedStatus string

const (
	ClassifiedAwaitingPayment ClassifiedStatus = "awaiting_payment"
	ClassifiedAwaitingReview  ClassifiedStatus = "awaiting_review"
	ClassifiedPublished       ClassifiedStatus = "published"
)

var ErrInvalidClassified = errors.New("classified requires title, category, description, location and contact")

type ClassifiedState struct {
	ID                                                                                        shared.ClassifiedID `json:"id"`
	Title, Category, Description, Location, ContactName, ContactEmail, ContactPhone, ImageURL string
	AskingPrice, PlacementFee                                                                 Money
	Provider                                                                                  PaymentProvider
	ProviderRef, PaymentRef                                                                   string
	Status                                                                                    ClassifiedStatus
	SubmittedAt                                                                               time.Time
	PaidAt, PublishedAt, ExpiresAt                                                            *time.Time
}
type Classified struct{ state ClassifiedState }

func StartClassified(state ClassifiedState, at time.Time) (Classified, error) {
	if state.ID == "" {
		return Classified{}, shared.ErrEmptyID
	}
	state.Title, state.Category, state.Description = trim3(state.Title, state.Category, state.Description)
	state.Location, state.ContactName, state.ContactEmail = trim3(state.Location, state.ContactName, state.ContactEmail)
	state.ContactPhone, state.ImageURL = strings.TrimSpace(state.ContactPhone), strings.TrimSpace(state.ImageURL)
	if state.Title == "" || state.Category == "" || state.Description == "" || state.Location == "" || state.ContactName == "" || state.ContactEmail == "" {
		return Classified{}, ErrInvalidClassified
	}
	if err := validateMoney(state.AskingPrice); err != nil {
		return Classified{}, err
	}
	if err := validateMoney(state.PlacementFee); err != nil {
		return Classified{}, err
	}
	if err := validateProvider(state.Provider, state.ProviderRef); err != nil {
		return Classified{}, err
	}
	state.Status, state.SubmittedAt = ClassifiedAwaitingPayment, at
	state.PaymentRef, state.PaidAt, state.PublishedAt, state.ExpiresAt = "", nil, nil, nil
	return Classified{state: state}, nil
}
func ReconstituteClassified(state ClassifiedState) Classified { return Classified{state: state} }
func (c Classified) ID() shared.ClassifiedID                  { return c.state.ID }
func (c Classified) State() ClassifiedState                   { return c.state }
func (c Classified) ConfirmPayment(ref string, at time.Time) (Classified, error) {
	if c.state.Status != ClassifiedAwaitingPayment {
		return Classified{}, ErrPaymentAlreadyFinal
	}
	if strings.TrimSpace(ref) == "" {
		return Classified{}, ErrMissingProviderRef
	}
	c.state.Status, c.state.PaymentRef, c.state.PaidAt = ClassifiedAwaitingReview, strings.TrimSpace(ref), &at
	return c, nil
}
func (c Classified) Publish(actor identity.Actor, at time.Time) (Classified, error) {
	if err := actor.Require(identity.PermRevenueManage); err != nil {
		return Classified{}, err
	}
	if c.state.Status != ClassifiedAwaitingReview {
		return Classified{}, errors.New("classified must be paid before publication")
	}
	expires := at.AddDate(0, 0, 30)
	c.state.Status, c.state.PublishedAt, c.state.ExpiresAt = ClassifiedPublished, &at, &expires
	return c, nil
}
