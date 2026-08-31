package mongo

import (
	"context"
	"errors"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type DonationRepository struct{ collection *mongo.Collection }

func NewDonationRepository(db *mongo.Database) *DonationRepository {
	return &DonationRepository{collection: db.Collection(CollDonations)}
}
func (r *DonationRepository) FindByID(ctx context.Context, id shared.DonationID) (revenue.Donation, error) {
	var doc donationDoc
	if err := r.collection.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return revenue.Donation{}, ports.ErrNotFound
		}
		return revenue.Donation{}, err
	}
	return donationFromDoc(doc), nil
}
func (r *DonationRepository) ListRecent(ctx context.Context, since time.Time, limit int) ([]revenue.Donation, error) {
	cursor, err := r.collection.Find(ctx, bson.M{"startedAt": bson.M{"$gte": since}}, options.Find().SetSort(bson.D{{Key: "startedAt", Value: -1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []donationDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	items := make([]revenue.Donation, len(docs))
	for i, doc := range docs {
		items[i] = donationFromDoc(doc)
	}
	return items, nil
}
func (r *DonationRepository) Save(ctx context.Context, donation revenue.Donation) error {
	doc := donationToDoc(donation)
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return err
}
func (r *DonationRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "provider", Value: 1}, {Key: "providerRef", Value: 1}}, Options: options.Index().SetName("donation_provider_ref_unique").SetUnique(true)},
		{Keys: bson.D{{Key: "status", Value: 1}, {Key: "paidAt", Value: -1}}, Options: options.Index().SetName("donation_revenue_recent")},
		{Keys: bson.D{{Key: "startedAt", Value: -1}}, Options: options.Index().SetName("donation_checkout_recent")},
	})
	return err
}
func donationToDoc(value revenue.Donation) donationDoc {
	s := value.State()
	return donationDoc{ID: s.ID.String(), Amount: moneyToDoc(s.Amount), Provider: string(s.Provider), ProviderRef: s.ProviderRef, PaymentRef: s.PaymentRef, Email: s.Email, Message: s.Message, Anonymous: s.Anonymous, Status: string(s.Status), StartedAt: s.StartedAt, PaidAt: s.PaidAt}
}
func donationFromDoc(doc donationDoc) revenue.Donation {
	return revenue.ReconstituteDonation(revenue.DonationState{ID: shared.DonationID(doc.ID), Amount: moneyFromDoc(doc.Amount), Provider: revenue.PaymentProvider(doc.Provider), ProviderRef: doc.ProviderRef, PaymentRef: doc.PaymentRef, Email: doc.Email, Message: doc.Message, Anonymous: doc.Anonymous, Status: revenue.PaymentStatus(doc.Status), StartedAt: doc.StartedAt, PaidAt: doc.PaidAt})
}
