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

type AdCampaignRepository struct{ collection *mongo.Collection }

func NewAdCampaignRepository(db *mongo.Database) *AdCampaignRepository {
	return &AdCampaignRepository{collection: db.Collection(CollAdCampaigns)}
}
func (r *AdCampaignRepository) FindByID(ctx context.Context, id shared.AdCampaignID) (revenue.AdCampaign, error) {
	var doc adCampaignDoc
	if err := r.collection.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return revenue.AdCampaign{}, ports.ErrNotFound
		}
		return revenue.AdCampaign{}, err
	}
	return adCampaignFromDoc(doc), nil
}
func (r *AdCampaignRepository) ListEligible(ctx context.Context, slot revenue.AdSlot, locale string, at time.Time, limit int) ([]revenue.AdCampaign, error) {
	filter := bson.M{"active": true, "slot": string(slot), "locale": bson.M{"$in": bson.A{locale, "*"}}, "startsAt": bson.M{"$lte": at}, "endsAt": bson.M{"$gt": at}}
	return r.list(ctx, filter, options.Find().SetSort(bson.D{{Key: "priority", Value: -1}, {Key: "startsAt", Value: 1}}).SetLimit(int64(limit)))
}
func (r *AdCampaignRepository) ListAll(ctx context.Context, limit int) ([]revenue.AdCampaign, error) {
	return r.list(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "startsAt", Value: -1}}).SetLimit(int64(limit)))
}
func (r *AdCampaignRepository) list(ctx context.Context, filter bson.M, opts *options.FindOptionsBuilder) ([]revenue.AdCampaign, error) {
	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []adCampaignDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	items := make([]revenue.AdCampaign, len(docs))
	for i, doc := range docs {
		items[i] = adCampaignFromDoc(doc)
	}
	return items, nil
}
func (r *AdCampaignRepository) Save(ctx context.Context, value revenue.AdCampaign) error {
	doc := adCampaignToDoc(value)
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return err
}
func (r *AdCampaignRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.collection.Indexes().CreateOne(ctx, mongo.IndexModel{Keys: bson.D{{Key: "active", Value: 1}, {Key: "slot", Value: 1}, {Key: "locale", Value: 1}, {Key: "startsAt", Value: 1}, {Key: "endsAt", Value: 1}, {Key: "priority", Value: -1}}, Options: options.Index().SetName("eligible_ad_campaigns")})
	return err
}

type AdEventRepository struct{ collection *mongo.Collection }

func NewAdEventRepository(db *mongo.Database) *AdEventRepository {
	return &AdEventRepository{collection: db.Collection(CollAdEvents)}
}
func (r *AdEventRepository) CountForCampaign(ctx context.Context, id shared.AdCampaignID, kind revenue.AdEventKind) (int64, error) {
	return r.collection.CountDocuments(ctx, bson.M{"campaignId": id.String(), "kind": string(kind)})
}
func (r *AdEventRepository) Append(ctx context.Context, event revenue.AdEvent) error {
	_, err := r.collection.InsertOne(ctx, adEventDoc{ID: event.ID.String(), CampaignID: event.CampaignID.String(), Kind: string(event.Kind), OccurredAt: event.OccurredAt})
	return err
}
func (r *AdEventRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.collection.Indexes().CreateOne(ctx, mongo.IndexModel{Keys: bson.D{{Key: "campaignId", Value: 1}, {Key: "kind", Value: 1}, {Key: "occurredAt", Value: -1}}, Options: options.Index().SetName("campaign_event_counts")})
	return err
}

func adCampaignToDoc(value revenue.AdCampaign) adCampaignDoc {
	s := value.State()
	return adCampaignDoc{ID: s.ID.String(), Name: s.Name, Advertiser: s.Advertiser, Locale: s.Locale, Slot: string(s.Slot), CreativeURL: s.CreativeURL, AltText: s.AltText, LandingURL: s.LandingURL, Budget: moneyToDoc(s.Budget), CPMMinor: s.CPMMinor, Priority: s.Priority, StartsAt: s.StartsAt, EndsAt: s.EndsAt, Active: s.Active, ActivatedAt: s.ActivatedAt, CreatedBy: s.CreatedBy.String()}
}
func adCampaignFromDoc(doc adCampaignDoc) revenue.AdCampaign {
	return revenue.ReconstituteAdCampaign(revenue.AdCampaignState{ID: shared.AdCampaignID(doc.ID), Name: doc.Name, Advertiser: doc.Advertiser, Locale: doc.Locale, Slot: revenue.AdSlot(doc.Slot), CreativeURL: doc.CreativeURL, AltText: doc.AltText, LandingURL: doc.LandingURL, Budget: moneyFromDoc(doc.Budget), CPMMinor: doc.CPMMinor, Priority: doc.Priority, StartsAt: doc.StartsAt, EndsAt: doc.EndsAt, Active: doc.Active, ActivatedAt: doc.ActivatedAt, CreatedBy: shared.UserID(doc.CreatedBy)})
}
