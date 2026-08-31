package identity_test

import (
	"errors"
	"testing"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func profileManager() identity.Actor {
	return identity.NewActor("admin", []identity.Role{identity.RoleAdministrator})
}

func validProfileState() identity.StaffProfileState {
	portrait := shared.AssetID("portrait")
	return identity.StaffProfileState{
		ID: "profile", UserID: "journalist", Locale: "en", DisplayName: "Ama Mensah",
		JobTitle: "Senior reporter", Biography: "Ama reports on public policy and local government.",
		PortraitAssetID: &portrait,
		SocialLinks:     []identity.SocialLink{{Label: "LinkedIn", URL: "https://linkedin.com/in/ama"}},
	}
}

func TestStaffProfileLifecycle(t *testing.T) {
	profile, err := identity.NewStaffProfile(profileManager(), validProfileState())
	if err != nil || profile.State().Slug.String() != "ama-mensah" || profile.State().Published {
		t.Fatalf("create: %+v %v", profile.State(), err)
	}
	profile, err = profile.Publish(profileManager())
	if err != nil || !profile.State().Published {
		t.Fatalf("publish: %+v %v", profile.State(), err)
	}
	updated := validProfileState()
	updated.DisplayName = "Ama K. Mensah"
	profile, err = profile.Update(profileManager(), updated)
	if err != nil || profile.State().Published || profile.State().Slug.String() != "ama-k-mensah" {
		t.Fatalf("update: %+v %v", profile.State(), err)
	}
}

func TestStaffProfileRejectsIncompleteOrUnsafeIdentity(t *testing.T) {
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err := identity.NewStaffProfile(guest, validProfileState()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatalf("permission: %v", err)
	}
	tests := []struct {
		name string
		edit func(*identity.StaffProfileState)
		want error
	}{
		{"name", func(s *identity.StaffProfileState) { s.DisplayName = " " }, identity.ErrIncompleteStaffProfile},
		{"title", func(s *identity.StaffProfileState) { s.JobTitle = " " }, identity.ErrIncompleteStaffProfile},
		{"biography", func(s *identity.StaffProfileState) { s.Biography = " " }, identity.ErrIncompleteStaffProfile},
		{"locale", func(s *identity.StaffProfileState) { s.Locale = " " }, identity.ErrIncompleteStaffProfile},
		{"social", func(s *identity.StaffProfileState) { s.SocialLinks[0].URL = "http://example.test" }, identity.ErrUnsafeSocialLink},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			state := validProfileState()
			tt.edit(&state)
			if _, err := identity.NewStaffProfile(profileManager(), state); !errors.Is(err, tt.want) {
				t.Fatalf("got %v want %v", err, tt.want)
			}
		})
	}
}

func TestStaffProfilePublicationRequiresPortrait(t *testing.T) {
	state := validProfileState()
	state.PortraitAssetID = nil
	profile, err := identity.NewStaffProfile(profileManager(), state)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = profile.Publish(profileManager()); !errors.Is(err, identity.ErrStaffProfileNeedsPortrait) {
		t.Fatalf("publish: %v", err)
	}
}
