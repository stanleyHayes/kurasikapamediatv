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

type SubscriptionRepository struct{ collection *mongo.Collection }

func NewSubscriptionRepository(db *mongo.Database) *SubscriptionRepository {
	return &SubscriptionRepository{collection: db.Collection(CollSubscriptions)}
}
func (r *SubscriptionRepository) FindByID(ctx context.Context, id shared.SubscriptionID) (revenue.Subscription, error) {
	var doc subscriptionDoc
	if err := r.collection.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return revenue.Subscription{}, ports.ErrNotFound
		}
		return revenue.Subscription{}, err
	}
	return subscriptionFromDoc(doc), nil
}
func (r *SubscriptionRepository) FindEntitledForReader(ctx context.Context, reader shared.UserID, at time.Time) (revenue.Subscription, error) {
	filter := bson.M{"readerId": reader.String(), "status": bson.M{"$in": []string{"active", "canceled"}}, "paidThrough": bson.M{"$gt": at}}
	var doc subscriptionDoc
	if err := r.collection.FindOne(ctx, filter, options.FindOne().SetSort(bson.D{{Key: "paidThrough", Value: -1}})).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return revenue.Subscription{}, ports.ErrNotFound
		}
		return revenue.Subscription{}, err
	}
	return subscriptionFromDoc(doc), nil
}
func (r *SubscriptionRepository) ListRecent(ctx context.Context, since time.Time, limit int) ([]revenue.Subscription, error) {
	cursor, err := r.collection.Find(ctx, bson.M{"startedAt": bson.M{"$gte": since}}, options.Find().SetSort(bson.D{{Key: "startedAt", Value: -1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []subscriptionDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	items := make([]revenue.Subscription, len(docs))
	for i, doc := range docs {
		items[i] = subscriptionFromDoc(doc)
	}
	return items, nil
}
func (r *SubscriptionRepository) Save(ctx context.Context, subscription revenue.Subscription) error {
	doc := subscriptionToDoc(subscription)
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return err
}
func (r *SubscriptionRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "provider", Value: 1}, {Key: "providerRef", Value: 1}}, Options: options.Index().SetName("subscription_provider_ref_unique").SetUnique(true)},
		{Keys: bson.D{{Key: "readerId", Value: 1}, {Key: "status", Value: 1}, {Key: "paidThrough", Value: -1}}, Options: options.Index().SetName("reader_entitlement")},
		{Keys: bson.D{{Key: "startedAt", Value: -1}}, Options: options.Index().SetName("revenue_subscribers_recent")},
	})
	return err
}
func subscriptionToDoc(value revenue.Subscription) subscriptionDoc {
	s := value.State()
	return subscriptionDoc{ID: s.ID.String(), PlanID: s.PlanID.String(), ReaderID: s.ReaderID.String(), Email: s.Email, Price: moneyToDoc(s.Price), Provider: string(s.Provider), ProviderRef: s.ProviderRef, PaymentRef: s.PaymentRef, Status: string(s.Status), StartedAt: s.StartedAt, PaidAt: s.PaidAt, PaidThrough: s.PaidThrough, CanceledAt: s.CanceledAt}
}
func subscriptionFromDoc(doc subscriptionDoc) revenue.Subscription {
	return revenue.ReconstituteSubscription(revenue.SubscriptionState{ID: shared.SubscriptionID(doc.ID), PlanID: shared.MembershipPlanID(doc.PlanID), ReaderID: shared.UserID(doc.ReaderID), Email: doc.Email, Price: moneyFromDoc(doc.Price), Provider: revenue.PaymentProvider(doc.Provider), ProviderRef: doc.ProviderRef, PaymentRef: doc.PaymentRef, Status: revenue.SubscriptionStatus(doc.Status), StartedAt: doc.StartedAt, PaidAt: doc.PaidAt, PaidThrough: doc.PaidThrough, CanceledAt: doc.CanceledAt})
}
