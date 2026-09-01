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

type ClassifiedRepository struct{ collection *mongo.Collection }

func NewClassifiedRepository(db *mongo.Database) *ClassifiedRepository {
	return &ClassifiedRepository{db.Collection(CollClassifieds)}
}
func (r *ClassifiedRepository) FindByID(ctx context.Context, id shared.ClassifiedID) (revenue.Classified, error) {
	var doc classifiedDoc
	if err := r.collection.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return revenue.Classified{}, ports.ErrNotFound
		}
		return revenue.Classified{}, err
	}
	return classifiedFromDoc(doc), nil
}
func (r *ClassifiedRepository) ListPublished(ctx context.Context, at time.Time, limit int) ([]revenue.Classified, error) {
	return r.list(ctx, bson.M{"status": string(revenue.ClassifiedPublished), "expiresat": bson.M{"$gt": at}}, limit)
}
func (r *ClassifiedRepository) ListAll(ctx context.Context, limit int) ([]revenue.Classified, error) {
	return r.list(ctx, bson.M{}, limit)
}
func (r *ClassifiedRepository) list(ctx context.Context, filter bson.M, limit int) ([]revenue.Classified, error) {
	cursor, err := r.collection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "submittedat", Value: -1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []classifiedDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	items := make([]revenue.Classified, len(docs))
	for i, doc := range docs {
		items[i] = classifiedFromDoc(doc)
	}
	return items, nil
}
func (r *ClassifiedRepository) Save(ctx context.Context, value revenue.Classified) error {
	doc := classifiedToDoc(value)
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return err
}
func (r *ClassifiedRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.collection.Indexes().CreateMany(ctx, []mongo.IndexModel{{Keys: bson.D{{Key: "status", Value: 1}, {Key: "expiresat", Value: 1}}, Options: options.Index().SetName("published_classified_expiry")}, {Keys: bson.D{{Key: "provider", Value: 1}, {Key: "providerref", Value: 1}}, Options: options.Index().SetName("classified_provider_ref_unique").SetUnique(true)}})
	return err
}
func classifiedToDoc(value revenue.Classified) classifiedDoc {
	s := value.State()
	return classifiedDoc{ID: s.ID.String(), Title: s.Title, Category: s.Category, Description: s.Description, Location: s.Location, ContactName: s.ContactName, ContactEmail: s.ContactEmail, ContactPhone: s.ContactPhone, ImageURL: s.ImageURL, AskingPrice: moneyToDoc(s.AskingPrice), PlacementFee: moneyToDoc(s.PlacementFee), Provider: string(s.Provider), ProviderRef: s.ProviderRef, PaymentRef: s.PaymentRef, Status: string(s.Status), SubmittedAt: s.SubmittedAt, PaidAt: s.PaidAt, PublishedAt: s.PublishedAt, ExpiresAt: s.ExpiresAt}
}
func classifiedFromDoc(d classifiedDoc) revenue.Classified {
	return revenue.ReconstituteClassified(revenue.ClassifiedState{ID: shared.ClassifiedID(d.ID), Title: d.Title, Category: d.Category, Description: d.Description, Location: d.Location, ContactName: d.ContactName, ContactEmail: d.ContactEmail, ContactPhone: d.ContactPhone, ImageURL: d.ImageURL, AskingPrice: moneyFromDoc(d.AskingPrice), PlacementFee: moneyFromDoc(d.PlacementFee), Provider: revenue.PaymentProvider(d.Provider), ProviderRef: d.ProviderRef, PaymentRef: d.PaymentRef, Status: revenue.ClassifiedStatus(d.Status), SubmittedAt: d.SubmittedAt, PaidAt: d.PaidAt, PublishedAt: d.PublishedAt, ExpiresAt: d.ExpiresAt})
}
