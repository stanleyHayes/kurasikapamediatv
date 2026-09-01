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

type ProductOrderRepository struct{ collection *mongo.Collection }

func NewProductOrderRepository(db *mongo.Database) *ProductOrderRepository {
	return &ProductOrderRepository{db.Collection(CollProductOrders)}
}
func (r *ProductOrderRepository) FindByID(ctx context.Context, id shared.ProductOrderID) (revenue.ProductOrder, error) {
	var d productOrderDoc
	if err := r.collection.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&d); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return revenue.ProductOrder{}, ports.ErrNotFound
		}
		return revenue.ProductOrder{}, err
	}
	return productOrderFromDoc(d), nil
}
func (r *ProductOrderRepository) Save(ctx context.Context, value revenue.ProductOrder) error {
	d := productOrderToDoc(value)
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": d.ID}, d, options.Replace().SetUpsert(true))
	return err
}
func (r *ProductOrderRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.collection.Indexes().CreateMany(ctx, []mongo.IndexModel{{Keys: bson.D{{Key: "provider", Value: 1}, {Key: "providerref", Value: 1}}, Options: options.Index().SetName("product_order_provider_ref_unique").SetUnique(true)}, {Keys: bson.D{{Key: "startedat", Value: -1}}, Options: options.Index().SetName("product_orders_recent")}})
	return err
}
func productOrderToDoc(value revenue.ProductOrder) productOrderDoc {
	s := value.State()
	return productOrderDoc{ID: s.ID.String(), ProductID: s.ProductID.String(), Quantity: s.Quantity, Total: moneyToDoc(s.Total), Email: s.Email, DeliveryName: s.DeliveryName, DeliveryAddress: s.DeliveryAddress, Provider: string(s.Provider), ProviderRef: s.ProviderRef, PaymentRef: s.PaymentRef, Status: string(s.Status), StartedAt: s.StartedAt, PaidAt: s.PaidAt}
}
func productOrderFromDoc(d productOrderDoc) revenue.ProductOrder {
	return revenue.ReconstituteProductOrder(revenue.ProductOrderState{ID: shared.ProductOrderID(d.ID), ProductID: shared.ProductID(d.ProductID), Quantity: d.Quantity, Total: moneyFromDoc(d.Total), Email: d.Email, DeliveryName: d.DeliveryName, DeliveryAddress: d.DeliveryAddress, Provider: revenue.PaymentProvider(d.Provider), ProviderRef: d.ProviderRef, PaymentRef: d.PaymentRef, Status: revenue.PaymentStatus(d.Status), StartedAt: d.StartedAt, PaidAt: d.PaidAt})
}
