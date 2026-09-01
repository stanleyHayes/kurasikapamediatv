package mongo

import (
	"context"
	"errors"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type ProductRepository struct{ collection *mongo.Collection }

func NewProductRepository(db *mongo.Database) *ProductRepository {
	return &ProductRepository{db.Collection(CollProducts)}
}
func (r *ProductRepository) FindByID(ctx context.Context, id shared.ProductID) (revenue.Product, error) {
	var doc productDoc
	if err := r.collection.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return revenue.Product{}, ports.ErrNotFound
		}
		return revenue.Product{}, err
	}
	return productFromDoc(doc), nil
}
func (r *ProductRepository) ListActive(ctx context.Context, limit int) ([]revenue.Product, error) {
	return r.list(ctx, bson.M{"active": true, "stock": bson.M{"$gt": 0}}, limit)
}
func (r *ProductRepository) ListAll(ctx context.Context, limit int) ([]revenue.Product, error) {
	return r.list(ctx, bson.M{}, limit)
}
func (r *ProductRepository) list(ctx context.Context, filter bson.M, limit int) ([]revenue.Product, error) {
	cursor, err := r.collection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "name", Value: 1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []productDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	items := make([]revenue.Product, len(docs))
	for i, doc := range docs {
		items[i] = productFromDoc(doc)
	}
	return items, nil
}
func (r *ProductRepository) Save(ctx context.Context, product revenue.Product) error {
	doc := productToDoc(product)
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return err
}
func (r *ProductRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.collection.Indexes().CreateMany(ctx, []mongo.IndexModel{{Keys: bson.D{{Key: "slug", Value: 1}}, Options: options.Index().SetName("product_slug_unique").SetUnique(true)}, {Keys: bson.D{{Key: "sku", Value: 1}}, Options: options.Index().SetName("product_sku_unique").SetUnique(true)}, {Keys: bson.D{{Key: "active", Value: 1}, {Key: "stock", Value: -1}}, Options: options.Index().SetName("active_product_inventory")}})
	return err
}
func productToDoc(value revenue.Product) productDoc {
	s := value.State()
	return productDoc{ID: s.ID.String(), Name: s.Name, Slug: s.Slug, SKU: s.SKU, Description: s.Description, ImageURL: s.ImageURL, ImageAlt: s.ImageAlt, Price: moneyToDoc(s.Price), Stock: s.Stock, Active: s.Active, ActivatedAt: s.ActivatedAt, CreatedBy: s.CreatedBy.String()}
}
func productFromDoc(d productDoc) revenue.Product {
	return revenue.ReconstituteProduct(revenue.ProductState{ID: shared.ProductID(d.ID), Name: d.Name, Slug: d.Slug, SKU: d.SKU, Description: d.Description, ImageURL: d.ImageURL, ImageAlt: d.ImageAlt, Price: moneyFromDoc(d.Price), Stock: d.Stock, Active: d.Active, ActivatedAt: d.ActivatedAt, CreatedBy: shared.UserID(d.CreatedBy)})
}
