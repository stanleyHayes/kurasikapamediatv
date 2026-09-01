package main

import (
	"errors"
	"fmt"
	"os"
)

type config struct {
	URI      string
	Database string
}

var errUnsafeRestoreTarget = errors.New("restore verifier target is not isolated")

func loadConfig() (config, error) {
	cfg := config{
		URI:      os.Getenv("DRILL_MONGODB_URI"),
		Database: os.Getenv("DRILL_MONGODB_DB"),
	}
	if cfg.URI == "" {
		return config{}, errors.New("DRILL_MONGODB_URI is required")
	}
	if cfg.Database == "" {
		return config{}, errors.New("DRILL_MONGODB_DB is required")
	}

	productionURI := os.Getenv("MONGODB_URI")
	productionDB := os.Getenv("MONGODB_DB")
	if productionURI != "" && cfg.URI == productionURI && cfg.Database == productionDB {
		return config{}, fmt.Errorf(
			"%w: DRILL_MONGODB_URI and DRILL_MONGODB_DB identify production",
			errUnsafeRestoreTarget,
		)
	}
	return cfg, nil
}
