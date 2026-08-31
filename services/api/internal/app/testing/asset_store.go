package testing

import (
	"context"
	"sort"

	"github.com/kurasikapa/api/internal/app/ports"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type AssetStore struct {
	Items   map[shared.AssetID]domainmedia.Asset
	Err     error
	SaveErr error
}

func NewAssetStore(seed ...domainmedia.Asset) *AssetStore {
	store := &AssetStore{Items: map[shared.AssetID]domainmedia.Asset{}}
	for _, item := range seed {
		store.Items[item.ID()] = item
	}
	return store
}
func (s *AssetStore) FindByID(_ context.Context, id shared.AssetID) (domainmedia.Asset, error) {
	if s.Err != nil {
		return domainmedia.Asset{}, s.Err
	}
	item, ok := s.Items[id]
	if !ok {
		return domainmedia.Asset{}, ports.ErrNotFound
	}
	return item, nil
}
func (s *AssetStore) List(_ context.Context, locale string, limit int) ([]domainmedia.Asset, error) {
	if s.Err != nil {
		return nil, s.Err
	}
	out := []domainmedia.Asset{}
	for _, item := range s.Items {
		if locale == "" || item.State().Locale == locale {
			out = append(out, item)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID().String() > out[j].ID().String() })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}
func (s *AssetStore) Save(_ context.Context, item domainmedia.Asset) error {
	if s.SaveErr != nil {
		return s.SaveErr
	}
	if s.Err != nil {
		return s.Err
	}
	s.Items[item.ID()] = item
	return nil
}

type MediaUploadFake struct {
	Ticket             ports.UploadTicket
	SignErr, VerifyErr error
	LastRequest        ports.UploadRequest
	LastReceipt        ports.UploadReceipt
}

func (f *MediaUploadFake) SignUpload(request ports.UploadRequest) (ports.UploadTicket, error) {
	f.LastRequest = request
	return f.Ticket, f.SignErr
}
func (f *MediaUploadFake) VerifyUpload(receipt ports.UploadReceipt) error {
	f.LastReceipt = receipt
	return f.VerifyErr
}

type VideoDeliveryFake struct{ Delivery ports.VideoDelivery }

func (f VideoDeliveryFake) Project(asset domainmedia.Asset) ports.VideoDelivery {
	if f.Delivery.PlaybackURL != "" {
		return f.Delivery
	}
	state := asset.State()
	return ports.VideoDelivery{PlaybackURL: state.SecureURL, MIMEType: state.MIMEType}
}
