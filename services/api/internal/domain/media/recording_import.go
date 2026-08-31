package media

import (
	"errors"
	"strings"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type RecordingImportStatus string

const (
	RecordingImportRequested  RecordingImportStatus = "requested"
	RecordingImportProcessing RecordingImportStatus = "processing"
	RecordingImportReady      RecordingImportStatus = "ready"
	RecordingImportFailed     RecordingImportStatus = "failed"
)

var (
	ErrInvalidRecordingImport    = errors.New("recording import is incomplete")
	ErrRecordingImportTransition = errors.New("illegal recording import transition")
)

type RecordingImportState struct {
	ID                                       shared.RecordingImportID
	AssetID                                  shared.AssetID
	SourceRef, Bucket, Prefix                string
	ChannelName, Locale                      string
	ProviderTaskID, OutputRef, FailureReason string
	DurationSeconds                          float64
	Status                                   RecordingImportStatus
	RequestedBy                              shared.UserID
	CreatedAt, UpdatedAt                     time.Time
}

type RecordingImport struct{ state RecordingImportState }

func NewRecordingImport(actor identity.Actor, state RecordingImportState, now time.Time) (RecordingImport, error) {
	if err := actor.Require(identity.PermAssetUploadVideo); err != nil {
		return RecordingImport{}, err
	}
	state.SourceRef, state.Bucket, state.Prefix = strings.TrimSpace(state.SourceRef), strings.TrimSpace(state.Bucket), strings.TrimSpace(state.Prefix)
	state.ChannelName, state.Locale = strings.TrimSpace(state.ChannelName), strings.TrimSpace(state.Locale)
	if state.ID == "" || state.AssetID == "" || state.SourceRef == "" || state.Bucket == "" || state.Prefix == "" || state.ChannelName == "" || (state.Locale != "en" && state.Locale != "fr") || state.DurationSeconds <= 0 {
		return RecordingImport{}, ErrInvalidRecordingImport
	}
	state.Status, state.RequestedBy = RecordingImportRequested, actor.ID()
	state.CreatedAt, state.UpdatedAt = now, now
	return RecordingImport{state: state}, nil
}

func ReconstituteRecordingImport(state RecordingImportState) RecordingImport {
	return RecordingImport{state: state}
}

func (i RecordingImport) ID() shared.RecordingImportID { return i.state.ID }
func (i RecordingImport) State() RecordingImportState  { return i.state }

func (i RecordingImport) Start(actor identity.Actor, taskID, outputRef string, now time.Time) (RecordingImport, error) {
	if err := actor.Require(identity.PermAssetUploadVideo); err != nil {
		return RecordingImport{}, err
	}
	if i.state.Status != RecordingImportRequested || strings.TrimSpace(taskID) == "" || strings.TrimSpace(outputRef) == "" {
		return RecordingImport{}, ErrRecordingImportTransition
	}
	i.state.Status, i.state.ProviderTaskID = RecordingImportProcessing, strings.TrimSpace(taskID)
	i.state.OutputRef, i.state.UpdatedAt = strings.TrimSpace(outputRef), now
	return i, nil
}

func (i RecordingImport) Complete(actor identity.Actor, now time.Time) (RecordingImport, error) {
	if err := actor.Require(identity.PermAssetUploadVideo); err != nil {
		return RecordingImport{}, err
	}
	if i.state.Status != RecordingImportProcessing {
		return RecordingImport{}, ErrRecordingImportTransition
	}
	i.state.Status, i.state.UpdatedAt = RecordingImportReady, now
	return i, nil
}

func (i RecordingImport) Fail(actor identity.Actor, reason string, now time.Time) (RecordingImport, error) {
	if err := actor.Require(identity.PermAssetUploadVideo); err != nil {
		return RecordingImport{}, err
	}
	if (i.state.Status != RecordingImportRequested && i.state.Status != RecordingImportProcessing) || strings.TrimSpace(reason) == "" {
		return RecordingImport{}, ErrRecordingImportTransition
	}
	i.state.Status, i.state.FailureReason = RecordingImportFailed, strings.TrimSpace(reason)
	i.state.UpdatedAt = now
	return i, nil
}
