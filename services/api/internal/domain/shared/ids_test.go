package shared_test

import (
	"errors"
	"testing"

	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestIDConstructorsRejectBlank(t *testing.T) {
	t.Parallel()

	// A blank id is never a valid reference. Letting one through means a query
	// that matches nothing while looking like it matched something.
	constructors := map[string]func(string) error{
		"article":  func(s string) error { _, err := shared.NewArticleID(s); return err },
		"family":   func(s string) error { _, err := shared.NewFamilyID(s); return err },
		"revision": func(s string) error { _, err := shared.NewRevisionID(s); return err },
		"category": func(s string) error { _, err := shared.NewCategoryID(s); return err },
		"user":     func(s string) error { _, err := shared.NewUserID(s); return err },
	}

	for name, build := range constructors {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if err := build(""); !errors.Is(err, shared.ErrEmptyID) {
				t.Errorf("blank %s id: got %v, want ErrEmptyID", name, err)
			}
			if err := build("x_1"); err != nil {
				t.Errorf("valid %s id rejected: %v", name, err)
			}
		})
	}
}

func TestIDsStringify(t *testing.T) {
	t.Parallel()

	if shared.ArticleID("art_1").String() != "art_1" {
		t.Error("ArticleID")
	}
	if shared.FamilyID("fam_1").String() != "fam_1" {
		t.Error("FamilyID")
	}
	if shared.RevisionID("rev_1").String() != "rev_1" {
		t.Error("RevisionID")
	}
	if shared.CategoryID("cat_1").String() != "cat_1" {
		t.Error("CategoryID")
	}
	if shared.TagID("tag_1").String() != "tag_1" {
		t.Error("TagID")
	}
	if shared.UserID("usr_1").String() != "usr_1" {
		t.Error("UserID")
	}
	if shared.AssetID("ast_1").String() != "ast_1" {
		t.Error("AssetID")
	}
	if shared.PresenterID("pre_1").String() != "pre_1" {
		t.Error("PresenterID")
	}
	if shared.ProgrammeID("pro_1").String() != "pro_1" {
		t.Error("ProgrammeID")
	}
	if shared.ScheduleSlotID("slot_1").String() != "slot_1" {
		t.Error("ScheduleSlotID")
	}
	if shared.PodcastID("pod_1").String() != "pod_1" {
		t.Error("PodcastID")
	}
	if shared.EpisodeID("ep_1").String() != "ep_1" {
		t.Error("EpisodeID")
	}
	if shared.GalleryID("gal_1").String() != "gal_1" {
		t.Error("GalleryID")
	}
}
