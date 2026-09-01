package main

import (
	"errors"
	"testing"
)

func TestLoadConfigRequiresAnIsolatedDrillTarget(t *testing.T) {
	t.Setenv("DRILL_MONGODB_URI", "mongodb://restore.test")
	t.Setenv("DRILL_MONGODB_DB", "kurasikapa_restore_20260901")
	t.Setenv("MONGODB_URI", "mongodb://production.test")
	t.Setenv("MONGODB_DB", "kurasikapa")

	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("loadConfig: %v", err)
	}
	if cfg.Database != "kurasikapa_restore_20260901" {
		t.Fatalf("database = %q", cfg.Database)
	}
}

func TestLoadConfigRefusesTheProductionTarget(t *testing.T) {
	t.Setenv("DRILL_MONGODB_URI", "mongodb://same.test")
	t.Setenv("DRILL_MONGODB_DB", "kurasikapa")
	t.Setenv("MONGODB_URI", "mongodb://same.test")
	t.Setenv("MONGODB_DB", "kurasikapa")

	_, err := loadConfig()
	if !errors.Is(err, errUnsafeRestoreTarget) {
		t.Fatalf("error = %v", err)
	}
}

func TestLoadConfigRequiresBothDrillValues(t *testing.T) {
	t.Setenv("DRILL_MONGODB_URI", "")
	t.Setenv("DRILL_MONGODB_DB", "")

	if _, err := loadConfig(); err == nil {
		t.Fatal("missing drill target accepted")
	}
}
