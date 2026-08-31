package mongo

import (
	"context"
	"errors"
	"fmt"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/kurasikapa/api/internal/app/ports"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type AssetRepository struct{ assets *mongo.Collection }

func NewAssetRepository(db *mongo.Database) *AssetRepository {
	return &AssetRepository{db.Collection(CollMediaAssets)}
}
func (r *AssetRepository) FindByID(ctx context.Context, id shared.AssetID) (domainmedia.Asset, error) {
	var doc assetDoc
	if err := r.assets.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return domainmedia.Asset{}, ports.ErrNotFound
		}
		return domainmedia.Asset{}, fmt.Errorf("finding asset: %w", err)
	}
	return assetToDomain(doc), nil
}
func (r *AssetRepository) List(ctx context.Context, locale string, limit int) ([]domainmedia.Asset, error) {
	filter := bson.M{}
	if locale != "" {
		filter["locale"] = locale
	}
	cursor, err := r.assets.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, fmt.Errorf("listing assets: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []assetDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decoding assets: %w", err)
	}
	out := make([]domainmedia.Asset, len(docs))
	for i, doc := range docs {
		out[i] = assetToDomain(doc)
	}
	return out, nil
}
func (r *AssetRepository) Save(ctx context.Context, asset domainmedia.Asset) error {
	doc := assetToDoc(asset)
	_, err := r.assets.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return wrapSave("asset", err)
}
func (r *AssetRepository) EnsureIndexes(ctx context.Context) error {
	models := []mongo.IndexModel{
		{Keys: bson.D{{Key: "locale", Value: 1}, {Key: "status", Value: 1}, {Key: "_id", Value: -1}}, Options: options.Index().SetName("library_locale_status")},
		{Keys: bson.D{{Key: "providerId", Value: 1}}, Options: options.Index().SetUnique(true).SetSparse(true).SetName("provider_asset_unique")},
	}
	if _, err := r.assets.Indexes().CreateMany(ctx, models); err != nil {
		return fmt.Errorf("creating asset indexes: %w", err)
	}
	return nil
}
func assetToDomain(d assetDoc) domainmedia.Asset {
	return domainmedia.ReconstituteAsset(domainmedia.AssetState{ID: shared.AssetID(d.ID), Kind: domainmedia.AssetKind(d.Kind), Filename: d.Filename, MIMEType: d.MIMEType, Locale: d.Locale, AltText: d.AltText, Caption: d.Caption, Status: domainmedia.AssetStatus(d.Status), ProviderID: d.ProviderID, SecureURL: d.SecureURL, Bytes: d.Bytes, Width: d.Width, Height: d.Height, DurationSeconds: d.DurationSeconds, FailureReason: d.FailureReason, CreatedBy: shared.UserID(d.CreatedBy)})
}
func assetToDoc(asset domainmedia.Asset) assetDoc {
	s := asset.State()
	return assetDoc{ID: s.ID.String(), Kind: string(s.Kind), Filename: s.Filename, MIMEType: s.MIMEType, Locale: s.Locale, AltText: s.AltText, Caption: s.Caption, Status: string(s.Status), ProviderID: s.ProviderID, SecureURL: s.SecureURL, Bytes: s.Bytes, Width: s.Width, Height: s.Height, DurationSeconds: s.DurationSeconds, FailureReason: s.FailureReason, CreatedBy: s.CreatedBy.String()}
}
