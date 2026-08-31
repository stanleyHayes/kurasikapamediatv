package mongo_test

import (
	"context"
	"testing"

	adapter "github.com/kurasikapa/api/internal/adapter/mongo"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestStaffProfileRepositoryRoundTripAndPublicIndexes(t *testing.T) {
	t.Parallel()
	h := newHarness(t)
	repo := adapter.NewStaffProfileRepository(h.DB)
	ctx := context.Background()
	if err := repo.EnsureIndexes(ctx); err != nil {
		t.Fatal(err)
	}
	slug, _ := shared.NewSlug("ama-mensah")
	portrait := shared.AssetID("portrait")
	profile := identity.ReconstituteStaffProfile(identity.StaffProfileState{
		ID: "profile", UserID: "journalist", Locale: "en", Slug: slug,
		DisplayName: "Ama Mensah", JobTitle: "Senior reporter", Biography: "Public policy reporter.",
		PortraitAssetID: &portrait, SocialLinks: []identity.SocialLink{{Label: "LinkedIn", URL: "https://linkedin.com/in/ama"}},
		Published: true, CreatedBy: "admin", UpdatedBy: "admin",
	})
	if err := repo.Save(ctx, profile); err != nil {
		t.Fatal(err)
	}
	byID, err := repo.FindByID(ctx, profile.ID())
	if err != nil || byID.State().SocialLinks[0].Label != "LinkedIn" {
		t.Fatalf("by id: %+v %v", byID.State(), err)
	}
	if _, err = repo.FindByUserID(ctx, "journalist", "en"); err != nil {
		t.Fatal(err)
	}
	if _, err = repo.FindPublishedBySlug(ctx, "en", "ama-mensah"); err != nil {
		t.Fatal(err)
	}
	listed, err := repo.ListPublished(ctx, "en")
	if err != nil || len(listed) != 1 {
		t.Fatalf("listed: %d %v", len(listed), err)
	}
	names := indexNames(t, h, adapter.CollStaffProfiles)
	for _, name := range []string{"user_locale_unique", "locale_slug_unique", "public_team"} {
		if !names[name] {
			t.Errorf("missing %s", name)
		}
	}
}
