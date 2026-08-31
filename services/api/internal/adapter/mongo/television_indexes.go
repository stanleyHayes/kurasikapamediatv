package mongo

import (
	"context"
	"fmt"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func (r *TelevisionRepositories) EnsureIndexes(ctx context.Context) error {
	directory := []mongo.IndexModel{
		{Keys: bson.D{{Key: "locale", Value: 1}, {Key: "slug", Value: 1}}, Options: options.Index().SetUnique(true).SetName("locale_slug_unique")},
		{Keys: bson.D{{Key: "locale", Value: 1}, {Key: "published", Value: 1}}, Options: options.Index().SetName("public_directory")},
	}
	if _, err := r.presenters.Indexes().CreateMany(ctx, directory); err != nil {
		return fmt.Errorf("creating presenter indexes: %w", err)
	}
	if _, err := r.programmes.Indexes().CreateMany(ctx, directory); err != nil {
		return fmt.Errorf("creating programme indexes: %w", err)
	}
	schedule := []mongo.IndexModel{
		{Keys: bson.D{{Key: "locale", Value: 1}, {Key: "state", Value: 1}, {Key: "startsAt", Value: 1}}, Options: options.Index().SetName("upcoming_schedule")},
		{Keys: bson.D{{Key: "locale", Value: 1}, {Key: "state", Value: 1}, {Key: "isLive", Value: 1}, {Key: "endsAt", Value: -1}}, Options: options.Index().SetName("awaiting_replay")},
		{Keys: bson.D{{Key: "locale", Value: 1}, {Key: "state", Value: 1}, {Key: "endsAt", Value: -1}}, Options: options.Index().SetName("replay_schedule")},
	}
	if _, err := r.schedule.Indexes().CreateMany(ctx, schedule); err != nil {
		return fmt.Errorf("creating schedule indexes: %w", err)
	}
	return nil
}
