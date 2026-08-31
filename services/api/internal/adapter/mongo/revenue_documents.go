package mongo

import "time"

const (
	CollMembershipPlans = "membership_plans"
	CollSubscriptions   = "subscriptions"
	CollDonations       = "donations"
)

type moneyDoc struct {
	Minor    int64  `bson:"minor"`
	Currency string `bson:"currency"`
}

type membershipPlanDoc struct {
	ID          string     `bson:"_id"`
	Name        string     `bson:"name"`
	Slug        string     `bson:"slug"`
	Description string     `bson:"description"`
	Interval    string     `bson:"interval"`
	Price       moneyDoc   `bson:"price"`
	Benefits    []string   `bson:"benefits"`
	Active      bool       `bson:"active"`
	ActivatedAt *time.Time `bson:"activatedAt"`
	CreatedBy   string     `bson:"createdBy"`
}

type subscriptionDoc struct {
	ID          string     `bson:"_id"`
	PlanID      string     `bson:"planId"`
	ReaderID    string     `bson:"readerId"`
	Price       moneyDoc   `bson:"price"`
	Provider    string     `bson:"provider"`
	ProviderRef string     `bson:"providerRef"`
	PaymentRef  string     `bson:"paymentRef"`
	Status      string     `bson:"status"`
	StartedAt   time.Time  `bson:"startedAt"`
	PaidAt      *time.Time `bson:"paidAt"`
	PaidThrough *time.Time `bson:"paidThrough"`
	CanceledAt  *time.Time `bson:"canceledAt"`
}

type donationDoc struct {
	ID          string     `bson:"_id"`
	Amount      moneyDoc   `bson:"amount"`
	Provider    string     `bson:"provider"`
	ProviderRef string     `bson:"providerRef"`
	PaymentRef  string     `bson:"paymentRef"`
	Email       string     `bson:"email"`
	Message     string     `bson:"message"`
	Anonymous   bool       `bson:"anonymous"`
	Status      string     `bson:"status"`
	StartedAt   time.Time  `bson:"startedAt"`
	PaidAt      *time.Time `bson:"paidAt"`
}
