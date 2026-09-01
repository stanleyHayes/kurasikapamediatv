// Command verify-restore performs read-only acceptance checks against an
// isolated MongoDB snapshot restored by the operator.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"time"

	adaptermongo "github.com/kurasikapa/api/internal/adapter/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
)

const verificationTimeout = 60 * time.Second

type evidence struct {
	VerifiedAt string                     `json:"verifiedAt"`
	Report     adaptermongo.RestoreReport `json:"report"`
}

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	if err := run(); err != nil {
		log.Error("restore verification failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

func run() error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), verificationTimeout)
	defer cancel()

	client, err := mongo.Connect(options.Client().ApplyURI(cfg.URI))
	if err != nil {
		return fmt.Errorf("connecting to restored snapshot: %w", err)
	}
	defer func() {
		disconnectCtx, disconnect := context.WithTimeout(context.Background(), 10*time.Second)
		defer disconnect()
		_ = client.Disconnect(disconnectCtx)
	}()

	if err := client.Ping(ctx, readpref.Primary()); err != nil {
		return fmt.Errorf("pinging restored snapshot: %w", err)
	}

	report, err := adaptermongo.NewRestoreVerifier(client.Database(cfg.Database)).Verify(ctx)
	if err != nil {
		return err
	}
	if err := json.NewEncoder(os.Stdout).Encode(evidence{
		VerifiedAt: time.Now().UTC().Format(time.RFC3339),
		Report:     report,
	}); err != nil {
		return fmt.Errorf("writing restore evidence: %w", err)
	}
	if !report.Healthy {
		return errors.New("restored snapshot failed integrity checks")
	}
	return nil
}
