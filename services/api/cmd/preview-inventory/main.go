package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "preview inventory failed: %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	cfg, err := loadConfig(args)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	client, err := mongo.Connect(options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		return fmt.Errorf("connecting to MongoDB: %w", err)
	}
	defer func() { _ = client.Disconnect(context.Background()) }()
	if err = client.Ping(ctx, nil); err != nil {
		return fmt.Errorf("pinging MongoDB: %w", err)
	}
	db := client.Database(cfg.MongoDB)
	if cfg.Action == "clear" {
		removed, clearErr := clearPreview(ctx, db)
		fmt.Fprintf(os.Stderr, "removed %d managed preview records\n", removed)
		return clearErr
	}
	seeded, seedErr := seedPreview(ctx, db, time.Now().UTC())
	fmt.Fprintf(os.Stderr, "seeded %d managed preview records\n", seeded)
	return seedErr
}
