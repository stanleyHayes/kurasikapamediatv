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

type AffiliateLinkRepository struct{ collection *mongo.Collection }

func NewAffiliateLinkRepository(db *mongo.Database) *AffiliateLinkRepository {
	return &AffiliateLinkRepository{db.Collection(CollAffiliateLinks)}
}
func (r *AffiliateLinkRepository) FindByID(ctx context.Context, id shared.AffiliateLinkID) (revenue.AffiliateLink, error) {
	var doc affiliateLinkDoc
	if err := r.collection.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return revenue.AffiliateLink{}, ports.ErrNotFound
		}
		return revenue.AffiliateLink{}, err
	}
	return affiliateFromDoc(doc), nil
}
func (r *AffiliateLinkRepository) ListActive(ctx context.Context, limit int) ([]revenue.AffiliateLink, error) {
	return r.list(ctx, bson.M{"active": true}, limit)
}
func (r *AffiliateLinkRepository) ListAll(ctx context.Context, limit int) ([]revenue.AffiliateLink, error) {
	return r.list(ctx, bson.M{}, limit)
}
func (r *AffiliateLinkRepository) list(ctx context.Context, filter bson.M, limit int) ([]revenue.AffiliateLink, error) {
	cursor, err := r.collection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "title", Value: 1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []affiliateLinkDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	items := make([]revenue.AffiliateLink, len(docs))
	for i, doc := range docs {
		items[i] = affiliateFromDoc(doc)
	}
	return items, nil
}
func (r *AffiliateLinkRepository) Save(ctx context.Context, link revenue.AffiliateLink) error {
	doc := affiliateToDoc(link)
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return err
}
func (r *AffiliateLinkRepository) RecordClick(ctx context.Context, id shared.AffiliateLinkID, at time.Time) error {
	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": id.String(), "active": true}, bson.M{"$inc": bson.M{"clicks": 1}, "$set": bson.M{"lastClickedAt": at}})
	if err == nil && result.MatchedCount == 0 {
		return ports.ErrNotFound
	}
	return err
}
func (r *AffiliateLinkRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.collection.Indexes().CreateMany(ctx, []mongo.IndexModel{{Keys: bson.D{{Key: "destinationURL", Value: 1}}, Options: options.Index().SetName("affiliate_destination_unique").SetUnique(true)}, {Keys: bson.D{{Key: "active", Value: 1}, {Key: "category", Value: 1}}, Options: options.Index().SetName("active_affiliate_category")}})
	return err
}
func affiliateToDoc(value revenue.AffiliateLink) affiliateLinkDoc {
	s := value.State()
	return affiliateLinkDoc{ID: s.ID.String(), Partner: s.Partner, Title: s.Title, Category: s.Category, Description: s.Description, Disclosure: s.Disclosure, ImageURL: s.ImageURL, ImageAlt: s.ImageAlt, DestinationURL: s.DestinationURL, CommissionNote: s.CommissionNote, Active: s.Active, ActivatedAt: s.ActivatedAt, CreatedBy: s.CreatedBy.String(), Clicks: s.Clicks}
}
func affiliateFromDoc(d affiliateLinkDoc) revenue.AffiliateLink {
	return revenue.ReconstituteAffiliateLink(revenue.AffiliateLinkState{ID: shared.AffiliateLinkID(d.ID), Partner: d.Partner, Title: d.Title, Category: d.Category, Description: d.Description, Disclosure: d.Disclosure, ImageURL: d.ImageURL, ImageAlt: d.ImageAlt, DestinationURL: d.DestinationURL, CommissionNote: d.CommissionNote, Active: d.Active, ActivatedAt: d.ActivatedAt, CreatedBy: shared.UserID(d.CreatedBy), Clicks: d.Clicks})
}
