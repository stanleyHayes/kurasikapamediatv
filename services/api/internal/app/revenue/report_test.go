package revenue_test

import (
	"context"
	"errors"
	"testing"
	"time"

	apprevenue "github.com/kurasikapa/api/internal/app/revenue"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainrevenue "github.com/kurasikapa/api/internal/domain/revenue"
)

func TestRevenueReportSeparatesCurrenciesAndNormalisesAnnualMRR(t *testing.T) {
	d, _, subs, donations, _ := deps()
	paidAt := at.Add(-24 * time.Hour)
	monthThrough := at.AddDate(0, 1, 0)
	yearThrough := at.AddDate(1, 0, 0)
	subs.rows["monthly"] = domainrevenue.ReconstituteSubscription(domainrevenue.SubscriptionState{ID: "monthly", PlanID: "p1", ReaderID: "r1", Email: "one@example.com", Price: domainrevenue.Money{Minor: 3600, Currency: domainrevenue.CurrencyGHS}, Status: domainrevenue.SubscriptionActive, StartedAt: paidAt, PaidAt: &paidAt, PaidThrough: &monthThrough})
	subs.rows["yearly"] = domainrevenue.ReconstituteSubscription(domainrevenue.SubscriptionState{ID: "yearly", PlanID: "p2", ReaderID: "r2", Email: "two@example.com", Price: domainrevenue.Money{Minor: 12000, Currency: domainrevenue.CurrencyEUR}, Status: domainrevenue.SubscriptionActive, StartedAt: paidAt, PaidAt: &paidAt, PaidThrough: &yearThrough})
	donations.rows["gift"] = domainrevenue.ReconstituteDonation(domainrevenue.DonationState{ID: "gift", Amount: domainrevenue.Money{Minor: 5000, Currency: domainrevenue.CurrencyGHS}, Status: domainrevenue.PaymentSucceeded, StartedAt: paidAt, PaidAt: &paidAt})

	report, err := apprevenue.NewBuildRevenueReport(d).Execute(context.Background(), admin(), 30)
	if err != nil {
		t.Fatal(err)
	}
	if report.ActiveSubscribers != 2 || report.SuccessfulDonations != 1 || len(report.Subscribers) != 2 {
		t.Fatal(report)
	}
	if report.Currencies[0].GrossMinor != 8600 || report.Currencies[0].MRRMinor != 3600 {
		t.Fatal(report.Currencies[0])
	}
	if report.Currencies[1].GrossMinor != 12000 || report.Currencies[1].MRRMinor != 1000 {
		t.Fatal(report.Currencies[1])
	}
	if len(report.Trend) != 3 || report.Subscribers[0].Email == "" {
		t.Fatal(report)
	}
}

func TestRevenueReportRequiresPermissionAndClampsPeriod(t *testing.T) {
	d, _, _, _, _ := deps()
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err := apprevenue.NewBuildRevenueReport(d).Execute(context.Background(), guest, 30); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	report, err := apprevenue.NewBuildRevenueReport(d).Execute(context.Background(), admin(), 365)
	if err != nil || report.Days != 30 {
		t.Fatal(report, err)
	}
}
