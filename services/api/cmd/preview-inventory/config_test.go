package main

import (
	"errors"
	"testing"
)

func TestLoadConfigAcceptsGuardedActions(t *testing.T) {
	t.Setenv("MONGODB_URI", "mongodb://example")
	t.Setenv("MONGODB_DB", "preview")

	for _, action := range []string{"seed", "clear"} {
		cfg, err := loadConfig([]string{action, "--confirm=" + previewTag})
		if err != nil || cfg.Action != action {
			t.Fatalf("loadConfig(%q) = %#v, %v", action, cfg, err)
		}
	}
}

func TestLoadConfigRejectsUnsafeInvocation(t *testing.T) {
	t.Setenv("MONGODB_URI", "mongodb://example")
	t.Setenv("MONGODB_DB", "preview")

	for _, args := range [][]string{
		{"seed"},
		{"seed", "--confirm=yes"},
		{"drop", "--confirm=" + previewTag},
	} {
		if _, err := loadConfig(args); !errors.Is(err, errUsage) {
			t.Fatalf("loadConfig(%v) error = %v, want errUsage", args, err)
		}
	}
}

func TestLoadConfigRequiresDatabaseEnvironment(t *testing.T) {
	t.Setenv("MONGODB_URI", "")
	t.Setenv("MONGODB_DB", "")

	if _, err := loadConfig([]string{"seed", "--confirm=" + previewTag}); err == nil {
		t.Fatal("loadConfig() error = nil, want missing environment error")
	}
}
