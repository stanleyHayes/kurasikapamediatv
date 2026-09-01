package mongo

import (
	"context"
	"errors"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type EventRepository struct{ collection *mongo.Collection }

func NewEventRepository(db *mongo.Database) *EventRepository {
	return &EventRepository{collection: db.Collection(CollEvents)}
}

func (r *EventRepository) FindByID(ctx context.Context, id shared.EventID) (media.Event, error) {
	var doc eventDoc
	if err := r.collection.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return media.Event{}, ports.ErrNotFound
		}
		return media.Event{}, err
	}
	return eventFromDoc(doc), nil
}

func (r *EventRepository) ListUpcoming(ctx context.Context, locale string, now time.Time, limit int) ([]media.Event, error) {
	filter := bson.M{"locale": locale, "published": true, "endsAt": bson.M{"$gt": now}}
	cursor, err := r.collection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "startsAt", Value: 1}, {Key: "_id", Value: 1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []eventDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	out := make([]media.Event, len(docs))
	for i, doc := range docs {
		out[i] = eventFromDoc(doc)
	}
	return out, nil
}

func (r *EventRepository) Save(ctx context.Context, event media.Event) error {
	doc := eventToDoc(event)
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return err
}

func (r *EventRepository) EnsureIndexes(ctx context.Context) error {
	models := []mongo.IndexModel{
		{Keys: bson.D{{Key: "locale", Value: 1}, {Key: "slug", Value: 1}}, Options: options.Index().SetName("event_locale_slug").SetUnique(true)},
		{Keys: bson.D{{Key: "locale", Value: 1}, {Key: "published", Value: 1}, {Key: "endsAt", Value: 1}, {Key: "startsAt", Value: 1}}, Options: options.Index().SetName("upcoming_events")},
	}
	_, err := r.collection.Indexes().CreateMany(ctx, models)
	return err
}

func eventToDoc(event media.Event) eventDoc {
	s := event.State()
	return eventDoc{ID: s.ID.String(), Type: string(s.Type), Mode: string(s.Mode), Title: s.Title, Slug: s.Slug, Locale: s.Locale, Summary: s.Summary, Timezone: s.Timezone, Venue: s.Venue, City: s.City, RegistrationURL: s.RegistrationURL, StartsAt: s.StartsAt, EndsAt: s.EndsAt, ImageAssetID: assetIDPointer(s.ImageAssetID), Speakers: append([]string(nil), s.Speakers...), Featured: s.Featured, Published: s.Published, PublishedAt: s.PublishedAt, CreatedBy: s.CreatedBy.String()}
}

func eventFromDoc(doc eventDoc) media.Event {
	return media.ReconstituteEvent(media.EventState{ID: shared.EventID(doc.ID), Type: media.EventType(doc.Type), Mode: media.EventMode(doc.Mode), Title: doc.Title, Slug: doc.Slug, Locale: doc.Locale, Summary: doc.Summary, Timezone: doc.Timezone, Venue: doc.Venue, City: doc.City, RegistrationURL: doc.RegistrationURL, StartsAt: doc.StartsAt, EndsAt: doc.EndsAt, ImageAssetID: assetIDFromPointer(doc.ImageAssetID), Speakers: append([]string(nil), doc.Speakers...), Featured: doc.Featured, Published: doc.Published, PublishedAt: doc.PublishedAt, CreatedBy: shared.UserID(doc.CreatedBy)})
}
