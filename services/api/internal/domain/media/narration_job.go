package media

import (
	"errors"
	"strings"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type NarrationStatus string

const (
	NarrationRequested  NarrationStatus = "requested"
	NarrationProcessing NarrationStatus = "processing"
	NarrationReady      NarrationStatus = "ready"
	NarrationFailed     NarrationStatus = "failed"
)

var (
	ErrInvalidNarrationJob        = errors.New("narration job is incomplete")
	ErrUnsupportedNarrationLocale = errors.New("narration locale is not supported")
	ErrNarrationJobTransition     = errors.New("illegal narration job transition")
)

type NarrationJobState struct {
	ID             shared.NarrationJobID
	ArticleID      shared.ArticleID
	RevisionID     shared.RevisionID
	AssetID        *shared.AssetID
	Locale         string
	Voice          string
	ProviderTaskID string
	Status         NarrationStatus
	FailureReason  string
	RequestedBy    shared.UserID
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type NarrationJob struct{ state NarrationJobState }

func NewNarrationJob(actor identity.Actor, state NarrationJobState, now time.Time) (NarrationJob, error) {
	if err := actor.Require(identity.PermArticlePublish); err != nil {
		return NarrationJob{}, err
	}
	state.Locale, state.Voice = strings.TrimSpace(state.Locale), strings.TrimSpace(state.Voice)
	if state.Locale != "en" && state.Locale != "fr" {
		return NarrationJob{}, ErrUnsupportedNarrationLocale
	}
	if state.ID == "" || state.ArticleID == "" || state.RevisionID == "" || state.Voice == "" {
		return NarrationJob{}, ErrInvalidNarrationJob
	}
	state.Status, state.RequestedBy = NarrationRequested, actor.ID()
	state.CreatedAt, state.UpdatedAt = now, now

	return NarrationJob{state: state}, nil
}

func ReconstituteNarrationJob(state NarrationJobState) NarrationJob {
	return NarrationJob{state: state}
}

func (j NarrationJob) ID() shared.NarrationJobID { return j.state.ID }
func (j NarrationJob) State() NarrationJobState  { return j.state }

func (j NarrationJob) Start(actor identity.Actor, providerTaskID string, now time.Time) (NarrationJob, error) {
	if err := actor.Require(identity.PermArticlePublish); err != nil {
		return NarrationJob{}, err
	}
	if j.state.Status != NarrationRequested || strings.TrimSpace(providerTaskID) == "" {
		return NarrationJob{}, ErrNarrationJobTransition
	}
	j.state.Status, j.state.ProviderTaskID = NarrationProcessing, strings.TrimSpace(providerTaskID)
	j.state.UpdatedAt = now

	return j, nil
}

func (j NarrationJob) Complete(actor identity.Actor, assetID shared.AssetID, now time.Time) (NarrationJob, error) {
	if err := actor.Require(identity.PermArticlePublish); err != nil {
		return NarrationJob{}, err
	}
	if j.state.Status != NarrationProcessing || assetID == "" {
		return NarrationJob{}, ErrNarrationJobTransition
	}
	j.state.Status, j.state.AssetID, j.state.UpdatedAt = NarrationReady, &assetID, now

	return j, nil
}

func (j NarrationJob) Fail(actor identity.Actor, reason string, now time.Time) (NarrationJob, error) {
	if err := actor.Require(identity.PermArticlePublish); err != nil {
		return NarrationJob{}, err
	}
	if (j.state.Status != NarrationRequested && j.state.Status != NarrationProcessing) || strings.TrimSpace(reason) == "" {
		return NarrationJob{}, ErrNarrationJobTransition
	}
	j.state.Status, j.state.FailureReason = NarrationFailed, strings.TrimSpace(reason)
	j.state.UpdatedAt = now

	return j, nil
}
