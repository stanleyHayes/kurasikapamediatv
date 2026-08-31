package media

import (
	"context"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type CreateAssetUploadResult struct {
	Asset  domainmedia.Asset
	Ticket ports.UploadTicket
}
type CreateAssetUpload struct {
	deps    Deps
	assets  ports.AssetRepository
	uploads ports.MediaUploadPort
}

func NewCreateAssetUpload(deps Deps, assets ports.AssetRepository, uploads ports.MediaUploadPort) CreateAssetUpload {
	return CreateAssetUpload{deps, assets, uploads}
}
func (u CreateAssetUpload) Execute(ctx context.Context, actor identity.Actor, input domainmedia.AssetState) (CreateAssetUploadResult, error) {
	input.ID = shared.AssetID(u.deps.IDs.NewID())
	asset, err := domainmedia.NewAsset(actor, input)
	if err != nil {
		return CreateAssetUploadResult{}, err
	}
	ticket, err := u.uploads.SignUpload(ports.UploadRequest{AssetID: asset.ID(), Kind: input.Kind, Timestamp: u.deps.Clock.Now()})
	if err != nil {
		return CreateAssetUploadResult{}, err
	}
	if err = u.assets.Save(ctx, asset); err != nil {
		return CreateAssetUploadResult{}, err
	}
	return CreateAssetUploadResult{Asset: asset, Ticket: ticket}, nil
}

type CompleteAssetUpload struct {
	assets  ports.AssetRepository
	uploads ports.MediaUploadPort
}

func NewCompleteAssetUpload(assets ports.AssetRepository, uploads ports.MediaUploadPort) CompleteAssetUpload {
	return CompleteAssetUpload{assets, uploads}
}
func (u CompleteAssetUpload) Execute(ctx context.Context, actor identity.Actor, id shared.AssetID, receipt ports.UploadReceipt) (domainmedia.Asset, error) {
	asset, err := u.assets.FindByID(ctx, id)
	if err != nil {
		return domainmedia.Asset{}, err
	}
	if err = u.uploads.VerifyUpload(receipt); err != nil {
		return domainmedia.Asset{}, err
	}
	asset, err = asset.MarkReady(actor, domainmedia.AssetDelivery{ProviderID: receipt.PublicID, SecureURL: receipt.SecureURL, Bytes: receipt.Bytes, Width: receipt.Width, Height: receipt.Height, DurationSeconds: receipt.DurationSeconds})
	if err != nil {
		return domainmedia.Asset{}, err
	}
	return asset, u.assets.Save(ctx, asset)
}

type ListAssets struct{ assets ports.AssetRepository }

func NewListAssets(assets ports.AssetRepository) ListAssets { return ListAssets{assets} }
func (u ListAssets) Execute(ctx context.Context, actor identity.Actor, locale string, limit int) ([]domainmedia.Asset, error) {
	if err := actor.Require(identity.PermAssetUploadImage); err != nil && actor.Require(identity.PermAssetUploadVideo) != nil {
		return nil, err
	}
	return u.assets.List(ctx, locale, limit)
}
