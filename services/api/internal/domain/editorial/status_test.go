package editorial_test

import (
	"errors"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestIsPubliclyVisible(t *testing.T) {
	t.Parallel()

	// Written as an explicit equality rather than "not in this list": adding a
	// new status must default to invisible. A negative check would default a
	// brand-new state to public, which is the wrong way for that to fail.
	for _, s := range []editorial.Status{
		editorial.StatusDraft, editorial.StatusInReview, editorial.StatusApproved,
		editorial.StatusScheduled, editorial.StatusUnpublished,
	} {
		if editorial.IsPubliclyVisible(s) {
			t.Errorf("%s must not be publicly visible", s)
		}
	}

	if !editorial.IsPubliclyVisible(editorial.StatusPublished) {
		t.Error("published must be publicly visible")
	}
}

func TestAllowedFrom(t *testing.T) {
	t.Parallel()

	if !editorial.AllowedFrom(editorial.TransitionSubmit, editorial.StatusDraft) {
		t.Error("submit should be allowed from draft")
	}
	if editorial.AllowedFrom(editorial.TransitionSubmit, editorial.StatusPublished) {
		t.Error("submit must not be allowed from published")
	}
	if editorial.AllowedFrom(editorial.Transition("teleport"), editorial.StatusDraft) {
		t.Error("an unknown transition must never be allowed")
	}
}

func TestPublishIsAllowedFromUnpublished(t *testing.T) {
	t.Parallel()

	// Approval survives unpublication, so a story pulled for a correction can
	// go back up without a second trip through review.
	if !editorial.AllowedFrom(editorial.TransitionPublish, editorial.StatusUnpublished) {
		t.Error("publish should be allowed from unpublished")
	}
}

func TestRuleFor(t *testing.T) {
	t.Parallel()

	rule, ok := editorial.RuleFor(editorial.TransitionSubmit)
	if !ok {
		t.Fatal("submit should be a known transition")
	}
	if !rule.AuthorOnly {
		t.Error("submit must be author-only")
	}
	if rule.Permission != identity.PermArticleSubmit {
		t.Errorf("permission = %s", rule.Permission)
	}

	if _, ok := editorial.RuleFor(editorial.Transition("teleport")); ok {
		t.Error("teleport should not be a known transition")
	}
}

func TestUnpublish(t *testing.T) {
	t.Parallel()

	published := anArticle(func(s *editorial.ArticleState) {
		s.Status = editorial.StatusPublished
		s.ApprovedRevisionID = &revID
	})

	got, err := published.Unpublish(editor())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Status() != editorial.StatusUnpublished {
		t.Errorf("status = %s, want unpublished", got.Status())
	}

	// The approval is kept deliberately, so a corrected story can be restored
	// without a second review.
	if _, ok := got.ApprovedRevisionID(); !ok {
		t.Error("unpublishing discarded the approval")
	}
}

func TestUnpublishRefusedWithoutPermission(t *testing.T) {
	t.Parallel()

	published := anArticle(func(s *editorial.ArticleState) { s.Status = editorial.StatusPublished })

	if _, err := published.Unpublish(author()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Errorf("got %v, want ErrNotPermitted", err)
	}
}

func TestUnknownTransitionIsRefused(t *testing.T) {
	t.Parallel()

	// Reject a transition the table does not define, rather than treating an
	// absent rule as an empty (and therefore permissive) one.
	if editorial.AllowedFrom(editorial.Transition(""), editorial.StatusDraft) {
		t.Error("the empty transition must not be allowed")
	}
}

func TestStateRoundTrips(t *testing.T) {
	t.Parallel()

	scheduled := now.Add(time.Hour)
	published := now.Add(-time.Hour)
	slug, _ := shared.NewSlug("budget-2026")

	original := editorial.ArticleState{
		ID:                 articleID,
		FamilyID:           shared.FamilyID("fam_1"),
		Locale:             "fr",
		Slug:               slug,
		Title:              "Budget 2026",
		AuthorID:           authorID,
		CategoryID:         shared.CategoryID("cat_business"),
		TagIDs:             []shared.TagID{"tag_1"},
		Status:             editorial.StatusScheduled,
		ApprovedRevisionID: &revID,
		ScheduledAt:        &scheduled,
		PublishedAt:        &published,
	}

	got := editorial.Reconstitute(original).State()

	if got.ID != original.ID || got.FamilyID != original.FamilyID ||
		got.Locale != original.Locale || got.Title != original.Title ||
		got.AuthorID != original.AuthorID || got.CategoryID != original.CategoryID ||
		got.Status != original.Status {
		t.Errorf("round trip lost data: %+v", got)
	}
	if got.Slug.String() != original.Slug.String() {
		t.Errorf("slug = %q", got.Slug)
	}
	if len(got.TagIDs) != 1 || got.TagIDs[0] != "tag_1" {
		t.Errorf("tags = %v", got.TagIDs)
	}
}

func TestAccessorsWhenUnset(t *testing.T) {
	t.Parallel()

	draft := anArticle()

	if _, ok := draft.ApprovedRevisionID(); ok {
		t.Error("a fresh draft has no approved revision")
	}
	if _, ok := draft.ScheduledAt(); ok {
		t.Error("a fresh draft is not scheduled")
	}
	if _, ok := draft.PublishedAt(); ok {
		t.Error("a fresh draft has never been published")
	}
	if draft.HasBeenPublished() {
		t.Error("a fresh draft has never been published")
	}
	if draft.ID() != articleID || draft.Locale() != "en" || draft.AuthorID() != authorID {
		t.Error("accessors disagree with the state it was built from")
	}
	if draft.FamilyID() != "fam_1" || draft.CategoryID() != "" {
		t.Errorf("familyID = %q, categoryID = %q", draft.FamilyID(), draft.CategoryID())
	}
}

func TestRetitleRefusedForAnotherAuthor(t *testing.T) {
	t.Parallel()

	other := identity.NewActor(shared.UserID("usr_other"), []identity.Role{identity.RoleAuthor})

	if _, err := anArticle().Retitle("Hijacked", other); !errors.Is(err, editorial.ErrNotOwnArticle) {
		t.Errorf("got %v, want ErrNotOwnArticle", err)
	}
}

func TestRetitleIgnoresAnUnsluggableTitle(t *testing.T) {
	t.Parallel()

	// "!!!" yields nothing to slugify. Keeping the old slug beats leaving the
	// article with no address at all.
	got, err := anArticle().Retitle("!!!", author())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Slug().String() != "budget-2026" {
		t.Errorf("slug = %q, want the previous one kept", got.Slug())
	}
}

// The failure branches of each move. Each one is a state the workflow must
// refuse, and an untested refusal is a refusal nobody has checked works.
func TestTransitionsRefuseWrongStates(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		act  func() (editorial.Article, error)
	}{
		{
			"reject only applies to something in review",
			func() (editorial.Article, error) { return anArticle().Reject(editor()) },
		},
		{
			"schedule only applies to something approved",
			func() (editorial.Article, error) {
				return anArticle().Schedule(now.Add(time.Hour), now, editor())
			},
		},
		{
			"publish only applies to approved, scheduled or unpublished",
			func() (editorial.Article, error) {
				draft := anArticle(func(s *editorial.ArticleState) { s.ApprovedRevisionID = &revID })

				return draft.Publish(now, editor())
			},
		},
		{
			"unpublish only applies to something live",
			func() (editorial.Article, error) { return anArticle().Unpublish(editor()) },
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if _, err := tc.act(); !errors.Is(err, editorial.ErrIllegalTransition) {
				t.Errorf("got %v, want ErrIllegalTransition", err)
			}
		})
	}
}

func TestRetitleRefusedWithoutEditPermission(t *testing.T) {
	t.Parallel()

	// Permission is checked before ownership here too, for the same reason as
	// the transitions: a reader must not learn who wrote an unpublished draft.
	if _, err := anArticle().Retitle("Anything", subscriber()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Errorf("got %v, want ErrNotPermitted", err)
	}
}

func TestEditorMayRetitleAnothersDraft(t *testing.T) {
	t.Parallel()

	// article:edit_any is what makes an editor an editor. Ownership is waived
	// for the people whose job is to work on everyone's copy.
	got, err := anArticle().Retitle("Subbed by the desk", editor())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Title() != "Subbed by the desk" {
		t.Errorf("title = %q", got.Title())
	}
}
