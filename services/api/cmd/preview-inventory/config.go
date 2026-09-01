package main

import (
	"errors"
	"fmt"
	"os"
	"strings"
)

const previewTag = "kurasikapa-client-preview-v1"

var errUsage = errors.New("invalid preview inventory command")

type config struct {
	MongoURI string
	MongoDB  string
	Action   string
}

func loadConfig(args []string) (config, error) {
	if len(args) != 2 || args[1] != "--confirm="+previewTag {
		return config{}, fmt.Errorf("%w: use seed|clear with the exact confirmation token", errUsage)
	}
	action := strings.TrimSpace(args[0])
	if action != "seed" && action != "clear" {
		return config{}, fmt.Errorf("%w: action must be seed or clear", errUsage)
	}
	cfg := config{
		MongoURI: strings.TrimSpace(os.Getenv("MONGODB_URI")),
		MongoDB:  strings.TrimSpace(os.Getenv("MONGODB_DB")),
		Action:   action,
	}
	if cfg.MongoURI == "" {
		return config{}, errors.New("MONGODB_URI is required")
	}
	if cfg.MongoDB == "" {
		return config{}, errors.New("MONGODB_DB is required")
	}
	return cfg, nil
}
