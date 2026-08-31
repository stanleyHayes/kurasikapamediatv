package mongo

import "time"

const (
	CollPresenters    = "presenters"
	CollProgrammes    = "programmes"
	CollScheduleSlots = "schedule_slots"
	CollMediaAssets   = "media_assets"
)

type presenterDoc struct {
	ID              string  `bson:"_id"`
	Name            string  `bson:"name"`
	Slug            string  `bson:"slug"`
	Locale          string  `bson:"locale"`
	Role            string  `bson:"role"`
	Biography       string  `bson:"biography"`
	PortraitAssetID *string `bson:"portraitAssetId"`
	Published       bool    `bson:"published"`
	CreatedBy       string  `bson:"createdBy"`
}

type assetDoc struct {
	ID              string  `bson:"_id"`
	Kind            string  `bson:"kind"`
	Filename        string  `bson:"filename"`
	MIMEType        string  `bson:"mimeType"`
	Locale          string  `bson:"locale"`
	AltText         string  `bson:"altText"`
	Caption         string  `bson:"caption"`
	Status          string  `bson:"status"`
	ProviderID      string  `bson:"providerId,omitempty"`
	SecureURL       string  `bson:"secureUrl,omitempty"`
	Bytes           int64   `bson:"bytes"`
	Width           int     `bson:"width"`
	Height          int     `bson:"height"`
	DurationSeconds float64 `bson:"durationSeconds"`
	FailureReason   string  `bson:"failureReason"`
	CreatedBy       string  `bson:"createdBy"`
}
type programmeDoc struct {
	ID             string   `bson:"_id"`
	Title          string   `bson:"title"`
	Slug           string   `bson:"slug"`
	Locale         string   `bson:"locale"`
	Summary        string   `bson:"summary"`
	Category       string   `bson:"category"`
	PresenterIDs   []string `bson:"presenterIds"`
	ArtworkAssetID *string  `bson:"artworkAssetId"`
	Published      bool     `bson:"published"`
	CreatedBy      string   `bson:"createdBy"`
}
type scheduleSlotDoc struct {
	ID             string    `bson:"_id"`
	ProgrammeID    string    `bson:"programmeId"`
	Locale         string    `bson:"locale"`
	StartsAt       time.Time `bson:"startsAt"`
	EndsAt         time.Time `bson:"endsAt"`
	IsLive         bool      `bson:"isLive"`
	State          string    `bson:"state"`
	ReplayAssetID  *string   `bson:"replayAssetId"`
	CaptionAssetID *string   `bson:"captionAssetId"`
	CreatedBy      string    `bson:"createdBy"`
}
