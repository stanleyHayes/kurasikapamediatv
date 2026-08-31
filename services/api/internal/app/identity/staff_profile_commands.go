package identity

import (
	"context"
	"errors"

	"github.com/kurasikapa/api/internal/app/ports"
	domainidentity "github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var ErrInvalidStaffPortrait = errors.New("staff portrait must be a ready image")

type StaffProfileDeps struct {
	Profiles ports.StaffProfileRepository
	Assets   ports.AssetRepository
	IDs      ports.IDs
}

type UpsertStaffProfile struct{ deps StaffProfileDeps }

func NewUpsertStaffProfile(deps StaffProfileDeps) UpsertStaffProfile {
	return UpsertStaffProfile{deps: deps}
}

func (u UpsertStaffProfile) Execute(ctx context.Context, actor domainidentity.Actor, input domainidentity.StaffProfileState) (domainidentity.StaffProfile, error) {
	current, err := u.deps.Profiles.FindByUserID(ctx, input.UserID, input.Locale)
	if err == nil {
		updated, updateErr := current.Update(actor, input)
		if updateErr != nil {
			return domainidentity.StaffProfile{}, updateErr
		}
		return updated, u.deps.Profiles.Save(ctx, updated)
	}
	if !errors.Is(err, ports.ErrNotFound) {
		return domainidentity.StaffProfile{}, err
	}
	input.ID = shared.StaffProfileID(u.deps.IDs.NewID())
	created, err := domainidentity.NewStaffProfile(actor, input)
	if err != nil {
		return domainidentity.StaffProfile{}, err
	}
	return created, u.deps.Profiles.Save(ctx, created)
}

type PublishStaffProfile struct{ deps StaffProfileDeps }

func NewPublishStaffProfile(deps StaffProfileDeps) PublishStaffProfile {
	return PublishStaffProfile{deps: deps}
}

func (u PublishStaffProfile) Execute(ctx context.Context, actor domainidentity.Actor, id shared.StaffProfileID) (domainidentity.StaffProfile, error) {
	profile, err := u.deps.Profiles.FindByID(ctx, id)
	if err != nil {
		return domainidentity.StaffProfile{}, err
	}
	state := profile.State()
	if state.PortraitAssetID == nil {
		return domainidentity.StaffProfile{}, domainidentity.ErrStaffProfileNeedsPortrait
	}
	portrait, err := u.deps.Assets.FindByID(ctx, *state.PortraitAssetID)
	if err != nil {
		return domainidentity.StaffProfile{}, err
	}
	asset := portrait.State()
	if asset.Kind != media.AssetImage || asset.Status != media.AssetReady || asset.SecureURL == "" {
		return domainidentity.StaffProfile{}, ErrInvalidStaffPortrait
	}
	profile, err = profile.Publish(actor)
	if err != nil {
		return domainidentity.StaffProfile{}, err
	}
	return profile, u.deps.Profiles.Save(ctx, profile)
}
