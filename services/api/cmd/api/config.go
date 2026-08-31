package main

import (
	"errors"
	"fmt"
	"os"
)

// config is the process's environment, validated once at boot.
//
// A missing MONGODB_URI should fail here with a readable message, not as a
// connection error inside the first request that needs it.
type config struct {
	MongoURI             string
	MongoDB              string
	Port                 string
	CronSecret           string
	CloudinaryCloudName  string
	CloudinaryAPIKey     string
	CloudinaryAPISecret  string
	NarrationRegion      string
	NarrationBucket      string
	IVSRegion            string
	IVSRecordingBucket   string
	MediaConvertBucket   string
	MediaConvertRoleARN  string
	MediaConvertTemplate string
	IVSWebhookSecret     string
	PaystackSecretKey    string
	StripeSecretKey      string
	StripeWebhookSecret  string
}

var errMissingEnv = errors.New("missing required environment")

func loadConfig() (config, error) {
	cfg := config{
		MongoURI:             os.Getenv("MONGODB_URI"),
		MongoDB:              envOr("MONGODB_DB", "kurasikapa"),
		Port:                 envOr("PORT", "8080"),
		CronSecret:           os.Getenv("CRON_SECRET"),
		CloudinaryCloudName:  os.Getenv("CLOUDINARY_CLOUD_NAME"),
		CloudinaryAPIKey:     os.Getenv("CLOUDINARY_API_KEY"),
		CloudinaryAPISecret:  os.Getenv("CLOUDINARY_API_SECRET"),
		NarrationRegion:      envOr("AWS_POLLY_REGION", "eu-west-2"),
		NarrationBucket:      os.Getenv("AWS_POLLY_OUTPUT_BUCKET"),
		IVSRegion:            envOr("AWS_IVS_REGION", "eu-west-1"),
		IVSRecordingBucket:   os.Getenv("AWS_IVS_RECORDING_BUCKET"),
		MediaConvertBucket:   os.Getenv("AWS_MEDIACONVERT_OUTPUT_BUCKET"),
		MediaConvertRoleARN:  os.Getenv("AWS_MEDIACONVERT_ROLE_ARN"),
		MediaConvertTemplate: os.Getenv("AWS_MEDIACONVERT_JOB_TEMPLATE"),
		IVSWebhookSecret:     os.Getenv("IVS_RECORDING_WEBHOOK_SECRET"),
		PaystackSecretKey:    os.Getenv("PAYSTACK_SECRET_KEY"),
		StripeSecretKey:      os.Getenv("STRIPE_SECRET_KEY"),
		StripeWebhookSecret:  os.Getenv("STRIPE_WEBHOOK_SECRET"),
	}

	if cfg.MongoURI == "" {
		return config{}, fmt.Errorf("%w: MONGODB_URI", errMissingEnv)
	}

	// CRON_SECRET is deliberately NOT required. Absent, the scheduled endpoint
	// refuses every request — which is the safe state. Requiring it would stop
	// the service booting for a developer who has no reason to run the cron.
	return cfg, nil
}

func envOr(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}

	return fallback
}
