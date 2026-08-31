package identity

import (
	"context"

	"github.com/kurasikapa/api/internal/app/ports"
	domainidentity "github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type PublicStaffProfile struct {
	Profile  domainidentity.StaffProfile
	Portrait media.Asset
}

type ListStaffProfiles struct{ deps StaffProfileDeps }

func NewListStaffProfiles(deps StaffProfileDeps) ListStaffProfiles {
	return ListStaffProfiles{deps: deps}
}

func (u ListStaffProfiles) Execute(ctx context.Context, locale string) ([]PublicStaffProfile, error) {
	profiles, err := u.deps.Profiles.ListPublished(ctx, locale)
	if err != nil {
		return nil, err
	}
	out := make([]PublicStaffProfile, 0, len(profiles))
	for _, profile := range profiles {
		entry, resolveErr := u.resolve(ctx, profile)
		if resolveErr != nil {
			return nil, resolveErr
		}
		out = append(out, entry)
	}
	return out, nil
}

func (u ListStaffProfiles) resolve(ctx context.Context, profile domainidentity.StaffProfile) (PublicStaffProfile, error) {
	portrait, err := portraitFor(ctx, u.deps.Assets, profile)
	return PublicStaffProfile{Profile: profile, Portrait: portrait}, err
}

type GetStaffProfile struct{ deps StaffProfileDeps }

func NewGetStaffProfile(deps StaffProfileDeps) GetStaffProfile {
	return GetStaffProfile{deps: deps}
}

func (u GetStaffProfile) BySlug(ctx context.Context, locale, slug string) (PublicStaffProfile, error) {
	profile, err := u.deps.Profiles.FindPublishedBySlug(ctx, locale, slug)
	if err != nil {
		return PublicStaffProfile{}, err
	}
	portrait, err := portraitFor(ctx, u.deps.Assets, profile)
	return PublicStaffProfile{Profile: profile, Portrait: portrait}, err
}

func (u GetStaffProfile) ByUser(ctx context.Context, locale string, userID shared.UserID) (PublicStaffProfile, error) {
	profile, err := u.deps.Profiles.FindByUserID(ctx, userID, locale)
	if err != nil {
		return PublicStaffProfile{}, err
	}
	state := profile.State()
	if !state.Published || state.Locale != locale {
		return PublicStaffProfile{}, ports.ErrNotFound
	}
	portrait, err := portraitFor(ctx, u.deps.Assets, profile)
	return PublicStaffProfile{Profile: profile, Portrait: portrait}, err
}

func portraitFor(ctx context.Context, assets ports.AssetRepository, profile domainidentity.StaffProfile) (media.Asset, error) {
	portraitID := profile.State().PortraitAssetID
	if portraitID == nil {
		return media.Asset{}, domainidentity.ErrStaffProfileNeedsPortrait
	}
	return assets.FindByID(ctx, *portraitID)
}
