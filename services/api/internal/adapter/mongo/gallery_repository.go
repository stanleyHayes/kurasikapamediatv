package mongo

import (
	"context"
	"errors"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type GalleryRepository struct{ collection *mongo.Collection }

func NewGalleryRepository(db *mongo.Database) *GalleryRepository {
	return &GalleryRepository{collection: db.Collection(CollGalleries)}
}
func (r *GalleryRepository) FindByID(ctx context.Context, id shared.GalleryID) (media.Gallery, error) {
	var doc galleryDoc
	if err := r.collection.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return media.Gallery{}, ports.ErrNotFound
		}
		return media.Gallery{}, err
	}
	return galleryFromDoc(doc), nil
}
func (r *GalleryRepository) ListPublished(ctx context.Context, locale string, limit int) ([]media.Gallery, error) {
	filter := bson.M{"published": true}
	if locale != "" {
		filter["locale"] = locale
	}
	cursor, err := r.collection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "publishedAt", Value: -1}, {Key: "_id", Value: -1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []galleryDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	out := make([]media.Gallery, len(docs))
	for i, doc := range docs {
		out[i] = galleryFromDoc(doc)
	}
	return out, nil
}
func (r *GalleryRepository) Save(ctx context.Context, item media.Gallery) error {
	doc := galleryToDoc(item)
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return err
}
func (r *GalleryRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.collection.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "locale", Value: 1}, {Key: "published", Value: 1}, {Key: "publishedAt", Value: -1}, {Key: "_id", Value: -1}},
		Options: options.Index().SetName("public_gallery_library"),
	})
	return err
}
func galleryToDoc(item media.Gallery) galleryDoc {
	s := item.State()
	items := make([]galleryItemDoc, len(s.Items))
	for i, entry := range s.Items {
		items[i] = galleryItemDoc{AssetID: entry.AssetID.String(), CaptionAssetID: assetIDPointer(entry.CaptionAssetID), Caption: entry.Caption, Credit: entry.Credit}
	}
	return galleryDoc{ID: s.ID.String(), Kind: string(s.Kind), Title: s.Title, Slug: s.Slug, Locale: s.Locale, Summary: s.Summary, Items: items, Published: s.Published, PublishedAt: s.PublishedAt, CreatedBy: s.CreatedBy.String()}
}
func galleryFromDoc(doc galleryDoc) media.Gallery {
	items := make([]media.GalleryItem, len(doc.Items))
	for i, entry := range doc.Items {
		items[i] = media.GalleryItem{AssetID: shared.AssetID(entry.AssetID), CaptionAssetID: assetIDFromPointer(entry.CaptionAssetID), Caption: entry.Caption, Credit: entry.Credit}
	}
	return media.ReconstituteGallery(media.GalleryState{ID: shared.GalleryID(doc.ID), Kind: media.GalleryKind(doc.Kind), Title: doc.Title, Slug: doc.Slug, Locale: doc.Locale, Summary: doc.Summary, Items: items, Published: doc.Published, PublishedAt: doc.PublishedAt, CreatedBy: shared.UserID(doc.CreatedBy)})
}
