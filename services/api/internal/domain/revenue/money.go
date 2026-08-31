// Package revenue owns memberships, contributions and paid-content access.
package revenue

import "errors"

type Currency string

const (
	CurrencyGHS Currency = "GHS"
	CurrencyEUR Currency = "EUR"
)

var (
	ErrInvalidAmount       = errors.New("amount must be positive minor units")
	ErrUnsupportedCurrency = errors.New("currency must be GHS or EUR")
)

type Money struct {
	Minor    int64    `json:"minor"`
	Currency Currency `json:"currency"`
}

func NewMoney(minor int64, currency Currency) (Money, error) {
	if minor <= 0 {
		return Money{}, ErrInvalidAmount
	}
	if currency != CurrencyGHS && currency != CurrencyEUR {
		return Money{}, ErrUnsupportedCurrency
	}
	return Money{Minor: minor, Currency: currency}, nil
}

func validateMoney(value Money) error {
	_, err := NewMoney(value.Minor, value.Currency)
	return err
}
