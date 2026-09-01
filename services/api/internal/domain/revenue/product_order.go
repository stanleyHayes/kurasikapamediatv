package revenue

import (
	"errors"
	"strings"
	"time"

	"github.com/kurasikapa/api/internal/domain/shared"
)

var ErrInvalidQuantity = errors.New("quantity must be between 1 and 20")

type ProductOrderState struct {
	ID                                   shared.ProductOrderID `json:"id"`
	ProductID                            shared.ProductID      `json:"productId"`
	Quantity                             int                   `json:"quantity"`
	Total                                Money                 `json:"total"`
	Email, DeliveryName, DeliveryAddress string
	Provider                             PaymentProvider `json:"provider"`
	ProviderRef, PaymentRef              string
	Status                               PaymentStatus `json:"status"`
	StartedAt                            time.Time     `json:"startedAt"`
	PaidAt                               *time.Time    `json:"paidAt"`
}

type ProductOrder struct{ state ProductOrderState }

func StartProductOrder(state ProductOrderState, at time.Time) (ProductOrder, error) {
	if state.ID == "" || state.ProductID == "" {
		return ProductOrder{}, shared.ErrEmptyID
	}
	if state.Quantity < 1 || state.Quantity > 20 {
		return ProductOrder{}, ErrInvalidQuantity
	}
	if err := validateMoney(state.Total); err != nil {
		return ProductOrder{}, err
	}
	if err := validateProvider(state.Provider, state.ProviderRef); err != nil {
		return ProductOrder{}, err
	}
	state.Email, state.DeliveryName, state.DeliveryAddress = trim3(state.Email, state.DeliveryName, state.DeliveryAddress)
	if state.Email == "" || state.DeliveryName == "" || state.DeliveryAddress == "" {
		return ProductOrder{}, errors.New("delivery contact is required")
	}
	state.Status, state.StartedAt, state.PaymentRef, state.PaidAt = PaymentPending, at, "", nil
	return ProductOrder{state: state}, nil
}
func ReconstituteProductOrder(state ProductOrderState) ProductOrder {
	return ProductOrder{state: state}
}
func (o ProductOrder) ID() shared.ProductOrderID { return o.state.ID }
func (o ProductOrder) State() ProductOrderState  { return o.state }
func (o ProductOrder) Confirm(ref string, at time.Time) (ProductOrder, error) {
	if o.state.Status != PaymentPending {
		return ProductOrder{}, ErrPaymentAlreadyFinal
	}
	if strings.TrimSpace(ref) == "" {
		return ProductOrder{}, ErrMissingProviderRef
	}
	o.state.Status, o.state.PaymentRef, o.state.PaidAt = PaymentSucceeded, strings.TrimSpace(ref), &at
	return o, nil
}
