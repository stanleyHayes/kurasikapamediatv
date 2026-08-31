package revenue

import (
	"context"
	"sort"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	domainrevenue "github.com/kurasikapa/api/internal/domain/revenue"
)

type CurrencySummary struct {
	Currency          domainrevenue.Currency `json:"currency"`
	GrossMinor        int64                  `json:"grossMinor"`
	SubscriptionMinor int64                  `json:"subscriptionMinor"`
	DonationMinor     int64                  `json:"donationMinor"`
	MRRMinor          int64                  `json:"mrrMinor"`
}

type RevenuePoint struct {
	Date     string                 `json:"date"`
	Currency domainrevenue.Currency `json:"currency"`
	Minor    int64                  `json:"minor"`
}

type SubscriberRow struct {
	ID          string                           `json:"id"`
	PlanID      string                           `json:"planId"`
	ReaderID    string                           `json:"readerId"`
	Email       string                           `json:"email"`
	Status      domainrevenue.SubscriptionStatus `json:"status"`
	Price       domainrevenue.Money              `json:"price"`
	StartedAt   time.Time                        `json:"startedAt"`
	PaidThrough *time.Time                       `json:"paidThrough"`
}

type RevenueReport struct {
	Days                int               `json:"days"`
	GeneratedAt         time.Time         `json:"generatedAt"`
	ActiveSubscribers   int               `json:"activeSubscribers"`
	PendingSubscribers  int               `json:"pendingSubscribers"`
	CanceledSubscribers int               `json:"canceledSubscribers"`
	SuccessfulDonations int               `json:"successfulDonations"`
	Currencies          []CurrencySummary `json:"currencies"`
	Trend               []RevenuePoint    `json:"trend"`
	Subscribers         []SubscriberRow   `json:"subscribers"`
}

type BuildRevenueReport struct{ deps Deps }

func NewBuildRevenueReport(deps Deps) BuildRevenueReport { return BuildRevenueReport{deps: deps} }

func (u BuildRevenueReport) Execute(ctx context.Context, actor identity.Actor, days int) (RevenueReport, error) {
	if err := actor.Require(identity.PermRevenueRead); err != nil {
		return RevenueReport{}, err
	}
	if days != 7 && days != 90 {
		days = 30
	}
	now := u.deps.Clock.Now()
	since := now.AddDate(0, 0, -days)
	subscriptions, err := u.deps.Subscriptions.ListRecent(ctx, time.Time{}, 1000)
	if err != nil {
		return RevenueReport{}, err
	}
	donations, err := u.deps.Donations.ListRecent(ctx, since, 250)
	if err != nil {
		return RevenueReport{}, err
	}
	report := RevenueReport{Days: days, GeneratedAt: now, Currencies: seedCurrencies(), Trend: []RevenuePoint{}, Subscribers: []SubscriberRow{}}
	report.accumulateSubscriptions(subscriptions, now, since)
	report.accumulateDonations(donations, since)
	sort.Slice(report.Subscribers, func(i, j int) bool { return report.Subscribers[i].StartedAt.After(report.Subscribers[j].StartedAt) })
	sort.Slice(report.Trend, func(i, j int) bool {
		if report.Trend[i].Date == report.Trend[j].Date {
			return report.Trend[i].Currency < report.Trend[j].Currency
		}
		return report.Trend[i].Date < report.Trend[j].Date
	})
	return report, nil
}

func seedCurrencies() []CurrencySummary {
	return []CurrencySummary{{Currency: domainrevenue.CurrencyGHS}, {Currency: domainrevenue.CurrencyEUR}}
}

func (r *RevenueReport) accumulateSubscriptions(items []domainrevenue.Subscription, now, since time.Time) {
	for _, item := range items {
		s := item.State()
		switch s.Status {
		case domainrevenue.SubscriptionPending:
			r.PendingSubscribers++
		case domainrevenue.SubscriptionCanceled:
			r.CanceledSubscribers++
		}
		if item.EntitledAt(now) {
			r.ActiveSubscribers++
		}
		r.Subscribers = append(r.Subscribers, SubscriberRow{ID: s.ID.String(), PlanID: s.PlanID.String(), ReaderID: s.ReaderID.String(), Email: s.Email, Status: s.Status, Price: s.Price, StartedAt: s.StartedAt, PaidThrough: s.PaidThrough})
		if s.PaidAt != nil && !s.PaidAt.Before(since) {
			r.addMoney(s.Price.Currency, s.Price.Minor, true, s.PaidAt)
		}
		if item.EntitledAt(now) {
			monthly := s.Price.Minor
			if s.PaidThrough != nil && s.PaidAt != nil && s.PaidThrough.Sub(*s.PaidAt) > 300*24*time.Hour {
				monthly /= 12
			}
			r.currency(s.Price.Currency).MRRMinor += monthly
		}
	}
}

func (r *RevenueReport) accumulateDonations(items []domainrevenue.Donation, since time.Time) {
	for _, item := range items {
		s := item.State()
		if s.Status != domainrevenue.PaymentSucceeded || s.PaidAt == nil || s.PaidAt.Before(since) {
			continue
		}
		r.SuccessfulDonations++
		r.addMoney(s.Amount.Currency, s.Amount.Minor, false, s.PaidAt)
	}
}

func (r *RevenueReport) addMoney(currency domainrevenue.Currency, minor int64, subscription bool, at *time.Time) {
	summary := r.currency(currency)
	summary.GrossMinor += minor
	if subscription {
		summary.SubscriptionMinor += minor
	} else {
		summary.DonationMinor += minor
	}
	r.Trend = append(r.Trend, RevenuePoint{Date: at.UTC().Format("2006-01-02"), Currency: currency, Minor: minor})
}

func (r *RevenueReport) currency(currency domainrevenue.Currency) *CurrencySummary {
	for i := range r.Currencies {
		if r.Currencies[i].Currency == currency {
			return &r.Currencies[i]
		}
	}
	r.Currencies = append(r.Currencies, CurrencySummary{Currency: currency})
	return &r.Currencies[len(r.Currencies)-1]
}
