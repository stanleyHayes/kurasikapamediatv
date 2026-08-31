package revenue

import (
	"errors"
	"time"

	"github.com/kurasikapa/api/internal/domain/shared"
)

type AdEventKind string

const (
	AdImpression AdEventKind = "impression"
	AdClick      AdEventKind = "click"
)

var ErrInvalidAdEvent = errors.New("ad event must be an impression or click")

type AdEvent struct {
	ID         shared.AdEventID    `json:"id"`
	CampaignID shared.AdCampaignID `json:"campaignId"`
	Kind       AdEventKind         `json:"kind"`
	OccurredAt time.Time           `json:"occurredAt"`
}

func NewAdEvent(id shared.AdEventID, campaign shared.AdCampaignID, kind AdEventKind, at time.Time) (AdEvent, error) {
	if id == "" || campaign == "" {
		return AdEvent{}, shared.ErrEmptyID
	}
	if kind != AdImpression && kind != AdClick {
		return AdEvent{}, ErrInvalidAdEvent
	}
	return AdEvent{ID: id, CampaignID: campaign, Kind: kind, OccurredAt: at}, nil
}
