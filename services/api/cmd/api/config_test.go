package main

import "testing"

func TestSemanticConfigDefaultsAndValidation(t *testing.T) {
	t.Setenv("MONGODB_URI", "mongodb://example")
	t.Setenv("VOYAGE_MODEL", "")
	t.Setenv("VOYAGE_DIMENSIONS", "")
	cfg, err := loadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.VoyageModel != "voyage-4" || cfg.VoyageDimensions != 1024 {
		t.Fatalf("model=%q dimensions=%d", cfg.VoyageModel, cfg.VoyageDimensions)
	}

	t.Setenv("VOYAGE_DIMENSIONS", "768")
	if _, err := loadConfig(); err == nil {
		t.Fatal("expected unsupported dimensions to fail")
	}
}
