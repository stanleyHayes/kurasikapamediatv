package mongo

import (
	"context"
	"errors"
	"fmt"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

const CollStaffProfiles = "staff_profiles"

type socialLinkDoc struct {
	Label string `bson:"label"`
	URL   string `bson:"url"`
}

type staffProfileDoc struct {
	ID              string          `bson:"_id"`
	UserID          string          `bson:"userId"`
	Locale          string          `bson:"locale"`
	Slug            string          `bson:"slug"`
	DisplayName     string          `bson:"displayName"`
	JobTitle        string          `bson:"jobTitle"`
	Biography       string          `bson:"biography"`
	PortraitAssetID *string         `bson:"portraitAssetId,omitempty"`
	SocialLinks     []socialLinkDoc `bson:"socialLinks"`
	Published       bool            `bson:"published"`
	CreatedBy       string          `bson:"createdBy"`
	UpdatedBy       string          `bson:"updatedBy"`
}

type StaffProfileRepository struct{ rows *mongo.Collection }

func NewStaffProfileRepository(db *mongo.Database) *StaffProfileRepository {
	return &StaffProfileRepository{rows: db.Collection(CollStaffProfiles)}
}

func (r *StaffProfileRepository) EnsureIndexes(ctx context.Context) error {
	models := []mongo.IndexModel{
		{Keys: bson.D{{Key: "userId", Value: 1}, {Key: "locale", Value: 1}}, Options: options.Index().SetUnique(true).SetName("user_locale_unique")},
		{Keys: bson.D{{Key: "locale", Value: 1}, {Key: "slug", Value: 1}}, Options: options.Index().SetUnique(true).SetName("locale_slug_unique")},
		{Keys: bson.D{{Key: "locale", Value: 1}, {Key: "published", Value: 1}, {Key: "displayName", Value: 1}}, Options: options.Index().SetName("public_team")},
	}
	if _, err := r.rows.Indexes().CreateMany(ctx, models); err != nil {
		return fmt.Errorf("creating staff profile indexes: %w", err)
	}
	return nil
}

func (r *StaffProfileRepository) FindByID(ctx context.Context, id shared.StaffProfileID) (identity.StaffProfile, error) {
	return r.findOne(ctx, bson.M{"_id": id.String()})
}

func (r *StaffProfileRepository) FindByUserID(ctx context.Context, id shared.UserID, locale string) (identity.StaffProfile, error) {
	return r.findOne(ctx, bson.M{"userId": id.String(), "locale": locale})
}

func (r *StaffProfileRepository) FindPublishedBySlug(ctx context.Context, locale, slug string) (identity.StaffProfile, error) {
	return r.findOne(ctx, bson.M{"locale": locale, "slug": slug, "published": true})
}

func (r *StaffProfileRepository) findOne(ctx context.Context, filter bson.M) (identity.StaffProfile, error) {
	var doc staffProfileDoc
	if err := r.rows.FindOne(ctx, filter).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return identity.StaffProfile{}, ports.ErrNotFound
		}
		return identity.StaffProfile{}, fmt.Errorf("finding staff profile: %w", err)
	}
	return staffProfileToDomain(doc), nil
}

func (r *StaffProfileRepository) ListPublished(ctx context.Context, locale string) ([]identity.StaffProfile, error) {
	cursor, err := r.rows.Find(ctx, bson.M{"locale": locale, "published": true}, options.Find().SetSort(bson.D{{Key: "displayName", Value: 1}}))
	if err != nil {
		return nil, fmt.Errorf("listing staff profiles: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []staffProfileDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decoding staff profiles: %w", err)
	}
	out := make([]identity.StaffProfile, len(docs))
	for i, doc := range docs {
		out[i] = staffProfileToDomain(doc)
	}
	return out, nil
}

func (r *StaffProfileRepository) Save(ctx context.Context, profile identity.StaffProfile) error {
	doc := staffProfileToDoc(profile)
	_, err := r.rows.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return wrapSave("staff profile", err)
}
