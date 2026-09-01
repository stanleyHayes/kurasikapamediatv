package mongo

import "time"

const (
	CollMembershipPlans = "membership_plans"
	CollSubscriptions   = "subscriptions"
	CollDonations       = "donations"
	CollAdCampaigns     = "ad_campaigns"
	CollAdEvents        = "ad_events"
	CollProducts        = "products"
	CollProductOrders   = "product_orders"
	CollClassifieds     = "classifieds"
	CollAffiliateLinks  = "affiliate_links"
)

type moneyDoc struct {
	Minor    int64  `bson:"minor"`
	Currency string `bson:"currency"`
}

type productDoc struct {
	ID, Name, Slug, SKU, Description, ImageURL, ImageAlt string
	Price                                                moneyDoc   `bson:"price"`
	Stock                                                int        `bson:"stock"`
	Active                                               bool       `bson:"active"`
	ActivatedAt                                          *time.Time `bson:"activatedAt"`
	CreatedBy                                            string     `bson:"createdBy"`
}

type productOrderDoc struct {
	ID, ProductID                                                                   string
	Quantity                                                                        int      `bson:"quantity"`
	Total                                                                           moneyDoc `bson:"total"`
	Email, DeliveryName, DeliveryAddress, Provider, ProviderRef, PaymentRef, Status string
	StartedAt                                                                       time.Time  `bson:"startedAt"`
	PaidAt                                                                          *time.Time `bson:"paidAt"`
}

type classifiedDoc struct {
	ID, Title, Category, Description, Location, ContactName, ContactEmail, ContactPhone, ImageURL string
	AskingPrice, PlacementFee                                                                     moneyDoc
	Provider, ProviderRef, PaymentRef, Status                                                     string
	SubmittedAt                                                                                   time.Time
	PaidAt, PublishedAt, ExpiresAt                                                                *time.Time
}

type affiliateLinkDoc struct {
	ID, Partner, Title, Category, Description, Disclosure string
	ImageURL, ImageAlt, DestinationURL, CommissionNote    string
	Active                                                bool
	ActivatedAt                                           *time.Time
	CreatedBy                                             string
	Clicks                                                int64
	LastClickedAt                                         *time.Time
}

type adCampaignDoc struct {
	ID          string     `bson:"_id"`
	Name        string     `bson:"name"`
	Advertiser  string     `bson:"advertiser"`
	Locale      string     `bson:"locale"`
	Slot        string     `bson:"slot"`
	CreativeURL string     `bson:"creativeUrl"`
	AltText     string     `bson:"altText"`
	LandingURL  string     `bson:"landingUrl"`
	Budget      moneyDoc   `bson:"budget"`
	CPMMinor    int64      `bson:"cpmMinor"`
	Priority    int        `bson:"priority"`
	StartsAt    time.Time  `bson:"startsAt"`
	EndsAt      time.Time  `bson:"endsAt"`
	Active      bool       `bson:"active"`
	ActivatedAt *time.Time `bson:"activatedAt"`
	CreatedBy   string     `bson:"createdBy"`
}

type adEventDoc struct {
	ID         string    `bson:"_id"`
	CampaignID string    `bson:"campaignId"`
	Kind       string    `bson:"kind"`
	OccurredAt time.Time `bson:"occurredAt"`
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
	Email       string     `bson:"email"`
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
