package editorial

import (
	"time"

	"github.com/kurasikapa/api/internal/domain/media"
)

type NarrationJobView struct {
	ID              string    `json:"id"`
	ArticleID       string    `json:"articleId"`
	RevisionID      string    `json:"revisionId"`
	AssetID         *string   `json:"assetId"`
	Locale          string    `json:"locale"`
	Voice           string    `json:"voice"`
	Status          string    `json:"status"`
	FailureReason   string    `json:"failureReason"`
	SecureURL       *string   `json:"secureUrl"`
	DurationSeconds *float64  `json:"durationSeconds"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

func narrationJobView(job media.NarrationJob) NarrationJobView {
	state := job.State()
	view := NarrationJobView{
		ID: state.ID.String(), ArticleID: state.ArticleID.String(), RevisionID: state.RevisionID.String(),
		Locale: state.Locale, Voice: state.Voice, Status: string(state.Status),
		FailureReason: state.FailureReason, CreatedAt: state.CreatedAt, UpdatedAt: state.UpdatedAt,
	}
	if state.AssetID != nil {
		assetID := state.AssetID.String()
		view.AssetID = &assetID
	}
	return view
}

func narrationJobPreview(view NarrationJobView, asset media.Asset) NarrationJobView {
	state := asset.State()
	if state.Status != media.AssetReady || state.Kind != media.AssetAudio {
		return view
	}
	view.SecureURL, view.DurationSeconds = &state.SecureURL, &state.DurationSeconds
	return view
}
