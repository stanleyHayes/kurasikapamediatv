package testing

import (
	"context"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type MembershipPlanStore struct {
	Items map[shared.MembershipPlanID]revenue.MembershipPlan
}

func NewMembershipPlanStore() *MembershipPlanStore {
	return &MembershipPlanStore{Items: map[shared.MembershipPlanID]revenue.MembershipPlan{}}
}
func (s *MembershipPlanStore) FindByID(_ context.Context, id shared.MembershipPlanID) (revenue.MembershipPlan, error) {
	value, ok := s.Items[id]
	if !ok {
		return revenue.MembershipPlan{}, ports.ErrNotFound
	}
	return value, nil
}
func (s *MembershipPlanStore) ListActive(context.Context) ([]revenue.MembershipPlan, error) {
	out := []revenue.MembershipPlan{}
	for _, value := range s.Items {
		if value.State().Active {
			out = append(out, value)
		}
	}
	return out, nil
}
func (s *MembershipPlanStore) Save(_ context.Context, value revenue.MembershipPlan) error {
	s.Items[value.ID()] = value
	return nil
}

type SubscriptionStore struct {
	Items map[shared.SubscriptionID]revenue.Subscription
}

func NewSubscriptionStore() *SubscriptionStore {
	return &SubscriptionStore{Items: map[shared.SubscriptionID]revenue.Subscription{}}
}
func (s *SubscriptionStore) FindByID(_ context.Context, id shared.SubscriptionID) (revenue.Subscription, error) {
	value, ok := s.Items[id]
	if !ok {
		return revenue.Subscription{}, ports.ErrNotFound
	}
	return value, nil
}
func (s *SubscriptionStore) FindEntitledForReader(_ context.Context, reader shared.UserID, at time.Time) (revenue.Subscription, error) {
	for _, value := range s.Items {
		if value.State().ReaderID == reader && value.EntitledAt(at) {
			return value, nil
		}
	}
	return revenue.Subscription{}, ports.ErrNotFound
}
func (s *SubscriptionStore) ListRecent(_ context.Context, since time.Time, limit int) ([]revenue.Subscription, error) {
	out := make([]revenue.Subscription, 0, limit)
	for _, value := range s.Items {
		if !value.State().StartedAt.Before(since) && len(out) < limit {
			out = append(out, value)
		}
	}
	return out, nil
}
func (s *SubscriptionStore) Save(_ context.Context, value revenue.Subscription) error {
	s.Items[value.ID()] = value
	return nil
}

type DonationStore struct {
	Items map[shared.DonationID]revenue.Donation
}

func NewDonationStore() *DonationStore {
	return &DonationStore{Items: map[shared.DonationID]revenue.Donation{}}
}
func (s *DonationStore) FindByID(_ context.Context, id shared.DonationID) (revenue.Donation, error) {
	value, ok := s.Items[id]
	if !ok {
		return revenue.Donation{}, ports.ErrNotFound
	}
	return value, nil
}
func (s *DonationStore) ListRecent(_ context.Context, since time.Time, limit int) ([]revenue.Donation, error) {
	out := make([]revenue.Donation, 0, limit)
	for _, value := range s.Items {
		if !value.State().StartedAt.Before(since) && len(out) < limit {
			out = append(out, value)
		}
	}
	return out, nil
}
func (s *DonationStore) Save(_ context.Context, value revenue.Donation) error {
	s.Items[value.ID()] = value
	return nil
}

type PaymentGatewayFake struct {
	Session ports.CheckoutSession
	Err     error
}

type PaymentWebhookFake struct {
	Event ports.VerifiedPayment
	Err   error
}

func (v PaymentWebhookFake) Verify(revenue.PaymentProvider, string, []byte, time.Time) (ports.VerifiedPayment, error) {
	return v.Event, v.Err
}

func (g PaymentGatewayFake) StartCheckout(context.Context, ports.CheckoutRequest) (ports.CheckoutSession, error) {
	return g.Session, g.Err
}
