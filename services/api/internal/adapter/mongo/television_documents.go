package mongo

import "time"

const (
	CollPresenters    = "presenters"
	CollProgrammes    = "programmes"
	CollScheduleSlots = "schedule_slots"
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
