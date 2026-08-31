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

type MembershipPlanRepository struct{ collection *mongo.Collection }

func NewMembershipPlanRepository(db *mongo.Database) *MembershipPlanRepository {
	return &MembershipPlanRepository{collection: db.Collection(CollMembershipPlans)}
}
func (r *MembershipPlanRepository) FindByID(ctx context.Context, id shared.MembershipPlanID) (revenue.MembershipPlan, error) {
	var doc membershipPlanDoc
	if err := r.collection.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return revenue.MembershipPlan{}, ports.ErrNotFound
		}
		return revenue.MembershipPlan{}, err
	}
	return planFromDoc(doc), nil
}
func (r *MembershipPlanRepository) ListActive(ctx context.Context) ([]revenue.MembershipPlan, error) {
	cursor, err := r.collection.Find(ctx, bson.M{"active": true}, options.Find().SetSort(bson.D{{Key: "price.minor", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []membershipPlanDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	out := make([]revenue.MembershipPlan, len(docs))
	for i, doc := range docs {
		out[i] = planFromDoc(doc)
	}
	return out, nil
}
func (r *MembershipPlanRepository) Save(ctx context.Context, plan revenue.MembershipPlan) error {
	doc := planToDoc(plan)
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return err
}
func (r *MembershipPlanRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "slug", Value: 1}}, Options: options.Index().SetName("membership_slug_unique").SetUnique(true)},
		{Keys: bson.D{{Key: "active", Value: 1}, {Key: "price.minor", Value: 1}}, Options: options.Index().SetName("active_membership_plans")},
	})
	return err
}
func planToDoc(plan revenue.MembershipPlan) membershipPlanDoc {
	s := plan.State()
	return membershipPlanDoc{ID: s.ID.String(), Name: s.Name, Slug: s.Slug, Description: s.Description, Interval: string(s.Interval), Price: moneyToDoc(s.Price), Benefits: s.Benefits, Active: s.Active, ActivatedAt: s.ActivatedAt, CreatedBy: s.CreatedBy.String()}
}
func planFromDoc(doc membershipPlanDoc) revenue.MembershipPlan {
	return revenue.ReconstituteMembershipPlan(revenue.MembershipPlanState{ID: shared.MembershipPlanID(doc.ID), Name: doc.Name, Slug: doc.Slug, Description: doc.Description, Interval: revenue.BillingInterval(doc.Interval), Price: moneyFromDoc(doc.Price), Benefits: doc.Benefits, Active: doc.Active, ActivatedAt: doc.ActivatedAt, CreatedBy: shared.UserID(doc.CreatedBy)})
}
func moneyToDoc(value revenue.Money) moneyDoc {
	return moneyDoc{Minor: value.Minor, Currency: string(value.Currency)}
}
func moneyFromDoc(value moneyDoc) revenue.Money {
	return revenue.Money{Minor: value.Minor, Currency: revenue.Currency(value.Currency)}
}
