package media

import (
	"errors"
	"strings"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type AssetKind string

const (
	AssetImage      AssetKind = "image"
	AssetVideo      AssetKind = "video"
	AssetAudio      AssetKind = "audio"
	AssetCaption    AssetKind = "caption"
	AssetTranscript AssetKind = "transcript"
	AssetDocument   AssetKind = "document"
)

type AssetStatus string

const (
	AssetPending AssetStatus = "pending"
	AssetReady   AssetStatus = "ready"
	AssetFailed  AssetStatus = "failed"
)

var (
	ErrInvalidAssetKind     = errors.New("invalid asset kind")
	ErrEmptyAssetFilename   = errors.New("asset filename cannot be empty")
	ErrImageNeedsAltText    = errors.New("image requires alternative text")
	ErrAssetAlreadyFinal    = errors.New("asset upload is already final")
	ErrInvalidAssetDelivery = errors.New("asset delivery metadata is invalid")
)

type AssetDelivery struct {
	ProviderID, SecureURL string
	Bytes                 int64
	Width, Height         int
	DurationSeconds       float64
}
type AssetState struct {
	ID                                           shared.AssetID
	Kind                                         AssetKind
	Filename, MIMEType, Locale, AltText, Caption string
	Status                                       AssetStatus
	ProviderID, SecureURL                        string
	Bytes                                        int64
	Width, Height                                int
	DurationSeconds                              float64
	FailureReason                                string
	CreatedBy                                    shared.UserID
}
type Asset struct{ state AssetState }

func NewAsset(actor identity.Actor, state AssetState) (Asset, error) {
	if !validAssetKind(state.Kind) {
		return Asset{}, ErrInvalidAssetKind
	}
	if err := actor.Require(permissionForAsset(state.Kind)); err != nil {
		return Asset{}, err
	}
	state.Filename = strings.TrimSpace(state.Filename)
	if state.Filename == "" {
		return Asset{}, ErrEmptyAssetFilename
	}
	state.AltText = strings.TrimSpace(state.AltText)
	if state.Kind == AssetImage && state.AltText == "" {
		return Asset{}, ErrImageNeedsAltText
	}
	state.Status, state.CreatedBy = AssetPending, actor.ID()
	return Asset{state: state}, nil
}
func ReconstituteAsset(state AssetState) Asset          { return Asset{state: state} }
func (a Asset) ID() shared.AssetID                      { return a.state.ID }
func (a Asset) State() AssetState                       { return a.state }
func (a Asset) RequiredPermission() identity.Permission { return permissionForAsset(a.state.Kind) }
func (a Asset) MarkReady(actor identity.Actor, delivery AssetDelivery) (Asset, error) {
	if err := actor.Require(a.RequiredPermission()); err != nil {
		return Asset{}, err
	}
	if a.state.Status != AssetPending {
		return Asset{}, ErrAssetAlreadyFinal
	}
	if strings.TrimSpace(delivery.ProviderID) == "" || strings.TrimSpace(delivery.SecureURL) == "" || delivery.Bytes <= 0 {
		return Asset{}, ErrInvalidAssetDelivery
	}
	a.state.Status, a.state.ProviderID, a.state.SecureURL = AssetReady, delivery.ProviderID, delivery.SecureURL
	a.state.Bytes, a.state.Width, a.state.Height, a.state.DurationSeconds = delivery.Bytes, delivery.Width, delivery.Height, delivery.DurationSeconds
	return a, nil
}
func (a Asset) MarkFailed(actor identity.Actor, reason string) (Asset, error) {
	if err := actor.Require(a.RequiredPermission()); err != nil {
		return Asset{}, err
	}
	if a.state.Status != AssetPending {
		return Asset{}, ErrAssetAlreadyFinal
	}
	a.state.Status, a.state.FailureReason = AssetFailed, strings.TrimSpace(reason)
	return a, nil
}
func validAssetKind(kind AssetKind) bool {
	return kind == AssetImage || kind == AssetVideo || kind == AssetAudio || kind == AssetCaption || kind == AssetTranscript || kind == AssetDocument
}
func permissionForAsset(kind AssetKind) identity.Permission {
	if kind == AssetImage {
		return identity.PermAssetUploadImage
	}
	return identity.PermAssetUploadVideo
}
