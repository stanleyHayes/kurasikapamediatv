package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var previewCollections = []string{"site_pages", "presenters", "programmes", "schedule_slots"}

func seedPreview(ctx context.Context, db *mongo.Database, now time.Time) (int, error) {
	records, err := previewRecords(now)
	if err != nil {
		return 0, err
	}
	written := 0
	for collection, documents := range records {
		for _, document := range documents {
			changed, replaceErr := replacePreview(ctx, db.Collection(collection), document)
			if replaceErr != nil {
				return written, fmt.Errorf("seeding %s: %w", collection, replaceErr)
			}
			if changed {
				written++
			}
		}
	}
	return written, nil
}

func replacePreview(ctx context.Context, collection *mongo.Collection, document bson.M) (bool, error) {
	id := document["_id"]
	var existing bson.M
	err := collection.FindOne(ctx, bson.M{"_id": id}, options.FindOne().SetProjection(bson.M{"demoSeed": 1})).Decode(&existing)
	if err == nil && existing["demoSeed"] != previewTag {
		return false, nil
	}
	if err != nil && err != mongo.ErrNoDocuments {
		return false, err
	}
	_, err = collection.ReplaceOne(ctx, bson.M{"_id": id}, document, options.Replace().SetUpsert(true))
	return err == nil, err
}

func clearPreview(ctx context.Context, db *mongo.Database) (int64, error) {
	var removed int64
	for _, name := range previewCollections {
		result, err := db.Collection(name).DeleteMany(ctx, bson.M{"demoSeed": previewTag})
		if err != nil {
			return removed, fmt.Errorf("clearing %s: %w", name, err)
		}
		removed += result.DeletedCount
	}
	return removed, nil
}

func managedBody(entries []bson.M) (string, error) {
	encoded, err := json.Marshal(bson.M{"version": 1, "entries": entries})
	if err != nil {
		return "", fmt.Errorf("encoding managed page: %w", err)
	}
	return string(encoded), nil
}
