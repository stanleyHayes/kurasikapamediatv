package identity_test

import (
	"context"
	"errors"
	"testing"

	appidentity "github.com/kurasikapa/api/internal/app/identity"
	"github.com/kurasikapa/api/internal/app/ports"
	fakes "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func manager() identity.Actor {
	return identity.NewActor("admin", []identity.Role{identity.RoleAdministrator})
}

func profileInput() identity.StaffProfileState {
	portrait := shared.AssetID("portrait")
	return identity.StaffProfileState{UserID: "journalist", Locale: "en", DisplayName: "Ama Mensah", JobTitle: "Senior reporter", Biography: "Ama reports on public policy.", PortraitAssetID: &portrait}
}

func TestStaffProfileManagementAndPublicDirectory(t *testing.T) {
	profiles, assets := fakes.NewStaffProfileStore(), fakes.NewAssetStore()
	deps := appidentity.StaffProfileDeps{Profiles: profiles, Assets: assets, IDs: &fakes.SequentialIDs{}}
	profile, err := appidentity.NewUpsertStaffProfile(deps).Execute(context.Background(), manager(), profileInput())
	if err != nil || profile.ID() != "id_1" || profile.State().Published {
		t.Fatalf("upsert: %+v %v", profile.State(), err)
	}
	portrait := media.ReconstituteAsset(media.AssetState{ID: "portrait", Kind: media.AssetImage, Status: media.AssetReady, SecureURL: "https://cdn.test/ama.jpg", AltText: "Ama Mensah"})
	if err = assets.Save(context.Background(), portrait); err != nil {
		t.Fatal(err)
	}
	profile, err = appidentity.NewPublishStaffProfile(deps).Execute(context.Background(), manager(), profile.ID())
	if err != nil || !profile.State().Published {
		t.Fatalf("publish: %+v %v", profile.State(), err)
	}
	directory, err := appidentity.NewListStaffProfiles(deps).Execute(context.Background(), "en")
	if err != nil || len(directory) != 1 || directory[0].Portrait.State().SecureURL == "" {
		t.Fatalf("directory: %+v %v", directory, err)
	}
	entry, err := appidentity.NewGetStaffProfile(deps).BySlug(context.Background(), "en", "ama-mensah")
	if err != nil || entry.Profile.State().UserID != "journalist" {
		t.Fatalf("slug: %+v %v", entry, err)
	}
	entry, err = appidentity.NewGetStaffProfile(deps).ByUser(context.Background(), "en", "journalist")
	if err != nil || entry.Profile.ID() != profile.ID() {
		t.Fatalf("user: %+v %v", entry, err)
	}
}

func TestStaffProfilePublicationRejectsInvalidPortrait(t *testing.T) {
	profiles, assets := fakes.NewStaffProfileStore(), fakes.NewAssetStore()
	deps := appidentity.StaffProfileDeps{Profiles: profiles, Assets: assets, IDs: &fakes.SequentialIDs{}}
	profile, err := appidentity.NewUpsertStaffProfile(deps).Execute(context.Background(), manager(), profileInput())
	if err != nil {
		t.Fatal(err)
	}
	if _, err = appidentity.NewPublishStaffProfile(deps).Execute(context.Background(), manager(), profile.ID()); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("missing: %v", err)
	}
	wrong := media.ReconstituteAsset(media.AssetState{ID: "portrait", Kind: media.AssetVideo, Status: media.AssetReady})
	if err = assets.Save(context.Background(), wrong); err != nil {
		t.Fatal(err)
	}
	if _, err = appidentity.NewPublishStaffProfile(deps).Execute(context.Background(), manager(), profile.ID()); !errors.Is(err, appidentity.ErrInvalidStaffPortrait) {
		t.Fatalf("wrong: %v", err)
	}
}

func TestStaffProfileUseCasesPropagateStorageFailures(t *testing.T) {
	sentinel := errors.New("profiles unavailable")
	profiles := fakes.NewStaffProfileStore()
	profiles.Err = sentinel
	deps := appidentity.StaffProfileDeps{Profiles: profiles, Assets: fakes.NewAssetStore(), IDs: &fakes.SequentialIDs{}}
	if _, err := appidentity.NewUpsertStaffProfile(deps).Execute(context.Background(), manager(), profileInput()); !errors.Is(err, sentinel) {
		t.Fatalf("upsert: %v", err)
	}
	if _, err := appidentity.NewListStaffProfiles(deps).Execute(context.Background(), "en"); !errors.Is(err, sentinel) {
		t.Fatalf("list: %v", err)
	}
	if _, err := appidentity.NewGetStaffProfile(deps).BySlug(context.Background(), "en", "missing"); !errors.Is(err, sentinel) {
		t.Fatalf("get: %v", err)
	}
}

func TestStaffProfileUpdateAndPublicationFailurePaths(t *testing.T) {
	profiles, assets := fakes.NewStaffProfileStore(), fakes.NewAssetStore()
	deps := appidentity.StaffProfileDeps{Profiles: profiles, Assets: assets, IDs: &fakes.SequentialIDs{}}
	created, err := appidentity.NewUpsertStaffProfile(deps).Execute(context.Background(), manager(), profileInput())
	if err != nil {
		t.Fatal(err)
	}
	changes := profileInput()
	changes.DisplayName = "Ama K. Mensah"
	updated, err := appidentity.NewUpsertStaffProfile(deps).Execute(context.Background(), manager(), changes)
	if err != nil || updated.ID() != created.ID() || updated.State().Slug.String() != "ama-k-mensah" {
		t.Fatalf("update: %+v %v", updated.State(), err)
	}
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err = appidentity.NewUpsertStaffProfile(deps).Execute(context.Background(), guest, profileInput()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatalf("permission: %v", err)
	}
	missingPortrait := profileInput()
	missingPortrait.UserID = "other"
	missingPortrait.PortraitAssetID = nil
	withoutPortrait, err := appidentity.NewUpsertStaffProfile(deps).Execute(context.Background(), manager(), missingPortrait)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = appidentity.NewPublishStaffProfile(deps).Execute(context.Background(), manager(), withoutPortrait.ID()); !errors.Is(err, identity.ErrStaffProfileNeedsPortrait) {
		t.Fatalf("portrait: %v", err)
	}
	profiles.Err = errors.New("save unavailable")
	if _, err = appidentity.NewPublishStaffProfile(deps).Execute(context.Background(), manager(), created.ID()); err == nil {
		t.Fatal("expected repository failure")
	}
}

func TestPublicStaffQueriesRejectDraftsAndBrokenPortraits(t *testing.T) {
	portrait := shared.AssetID("portrait")
	draft := identity.ReconstituteStaffProfile(identity.StaffProfileState{ID: "draft", UserID: "draft-user", Locale: "en", DisplayName: "Draft", PortraitAssetID: &portrait})
	publishedWithoutPortrait := identity.ReconstituteStaffProfile(identity.StaffProfileState{ID: "broken", UserID: "broken-user", Locale: "en", Published: true})
	profiles, assets := fakes.NewStaffProfileStore(draft, publishedWithoutPortrait), fakes.NewAssetStore()
	deps := appidentity.StaffProfileDeps{Profiles: profiles, Assets: assets, IDs: &fakes.SequentialIDs{}}
	get := appidentity.NewGetStaffProfile(deps)
	if _, err := get.ByUser(context.Background(), "en", "draft-user"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("draft: %v", err)
	}
	if _, err := get.ByUser(context.Background(), "fr", "draft-user"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("locale: %v", err)
	}
	if _, err := get.ByUser(context.Background(), "en", "broken-user"); !errors.Is(err, identity.ErrStaffProfileNeedsPortrait) {
		t.Fatalf("broken portrait: %v", err)
	}
	profiles.Items[draft.ID()] = identity.ReconstituteStaffProfile(identity.StaffProfileState{ID: "draft", UserID: "draft-user", Locale: "en", Published: true, PortraitAssetID: &portrait})
	if _, err := get.ByUser(context.Background(), "en", "draft-user"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("missing asset: %v", err)
	}
}
