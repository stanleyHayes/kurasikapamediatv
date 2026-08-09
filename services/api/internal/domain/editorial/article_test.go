package editorial_test

import (
	"errors"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var (
	authorID  = shared.UserID("usr_author")
	editorID  = shared.UserID("usr_editor")
	articleID = shared.ArticleID("art_1")
	revID     = shared.RevisionID("rev_1")
	now       = time.Date(2026, 8, 9, 12, 0, 0, 0, time.UTC)
)

func author() identity.Actor {
	return identity.NewActor(authorID, []identity.Role{identity.RoleAuthor})
}

func editor() identity.Actor {
	return identity.NewActor(editorID, []identity.Role{identity.RoleEditor})
}

func subscriber() identity.Actor {
	return identity.NewActor(shared.UserID("usr_reader"), []identity.Role{identity.RoleSubscriber})
}

func anArticle(mutate ...func(*editorial.ArticleState)) editorial.Article {
	slug, _ := shared.NewSlug("budget-2026")
	state := editorial.ArticleState{
		ID:       articleID,
		FamilyID: shared.FamilyID("fam_1"),
		Locale:   "en",
		Slug:     slug,
		Title:    "Budget 2026",
		AuthorID: authorID,
		Status:   editorial.StatusDraft,
	}

	for _, m := range mutate {
		m(&state)
	}

	return editorial.Reconstitute(state)
}

func TestSubmit(t *testing.T) {
	t.Parallel()

	t.Run("an author may submit their own draft", func(t *testing.T) {
		t.Parallel()

		got, err := anArticle().Submit(author())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Status() != editorial.StatusInReview {
			t.Errorf("status = %s, want in_review", got.Status())
		}
	})

	t.Run("an author may not submit a colleague's draft", func(t *testing.T) {
		t.Parallel()

		other := identity.NewActor(shared.UserID("usr_other"), []identity.Role{identity.RoleAuthor})

		if _, err := anArticle().Submit(other); !errors.Is(err, editorial.ErrNotOwnArticle) {
			t.Errorf("got %v, want ErrNotOwnArticle", err)
		}
	})

	t.Run("submitting twice is refused", func(t *testing.T) {
		t.Parallel()

		submitted, err := anArticle().Submit(author())
		if err != nil {
			t.Fatalf("setup: %v", err)
		}
		if _, err := submitted.Submit(author()); !errors.Is(err, editorial.ErrIllegalTransition) {
			t.Errorf("got %v, want ErrIllegalTransition", err)
		}
	})
}

// The guard order is a confidentiality rule, not a style preference.
func TestGuardOrderDoesNotLeakAuthorship(t *testing.T) {
	t.Parallel()

	// A subscriber has no editorial permission at all. If ownership were
	// checked first they would be told the article "belongs to another
	// author" — which confirms both that an unpublished draft exists and that
	// someone else wrote it. Permission must be refused first.
	_, err := anArticle().Submit(subscriber())

	if !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatalf("got %v, want ErrNotPermitted", err)
	}
	if errors.Is(err, editorial.ErrNotOwnArticle) {
		t.Error("leaked authorship to an actor with no editorial permission")
	}
}

func TestApprove(t *testing.T) {
	t.Parallel()

	inReview := func() editorial.Article {
		return anArticle(func(s *editorial.ArticleState) { s.Status = editorial.StatusInReview })
	}

	t.Run("an editor approves a named revision", func(t *testing.T) {
		t.Parallel()

		got, err := inReview().Approve(revID, articleID, editor())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		approved, ok := got.ApprovedRevisionID()
		if !ok || approved != revID {
			t.Errorf("approved revision = %v (ok=%v), want %s", approved, ok, revID)
		}
	})

	t.Run("an author may not approve their own work", func(t *testing.T) {
		t.Parallel()

		// The whole point of review. RoleAuthor has no article:approve.
		if _, err := inReview().Approve(revID, articleID, author()); !errors.Is(err, identity.ErrNotPermitted) {
			t.Errorf("got %v, want ErrNotPermitted", err)
		}
	})

	t.Run("refuses a revision belonging to a different article", func(t *testing.T) {
		t.Parallel()

		_, err := inReview().Approve(revID, shared.ArticleID("art_other"), editor())
		if !errors.Is(err, editorial.ErrRevisionNotOfArticle) {
			t.Errorf("got %v, want ErrRevisionNotOfArticle", err)
		}
	})
}

func TestRejectClearsTheApproval(t *testing.T) {
	t.Parallel()

	// Leaving the approval in place would let the next publish ship exactly
	// the text that was just refused.
	rejected, err := anArticle(func(s *editorial.ArticleState) {
		s.Status = editorial.StatusInReview
		s.ApprovedRevisionID = &revID
	}).Reject(editor())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, ok := rejected.ApprovedRevisionID(); ok {
		t.Error("approval survived a rejection")
	}
	if rejected.Status() != editorial.StatusDraft {
		t.Errorf("status = %s, want draft", rejected.Status())
	}
}

func TestPublish(t *testing.T) {
	t.Parallel()

	approved := func() editorial.Article {
		return anArticle(func(s *editorial.ArticleState) {
			s.Status = editorial.StatusApproved
			s.ApprovedRevisionID = &revID
		})
	}

	t.Run("publishes an approved article", func(t *testing.T) {
		t.Parallel()

		got, err := approved().Publish(now, editor())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Status() != editorial.StatusPublished {
			t.Errorf("status = %s, want published", got.Status())
		}
		if at, ok := got.PublishedAt(); !ok || !at.Equal(now) {
			t.Errorf("publishedAt = %v (ok=%v), want %v", at, ok, now)
		}
	})

	t.Run("refuses to publish without an approved revision", func(t *testing.T) {
		t.Parallel()

		unapproved := anArticle(func(s *editorial.ArticleState) { s.Status = editorial.StatusApproved })

		if _, err := unapproved.Publish(now, editor()); !errors.Is(err, editorial.ErrNoApprovedRevision) {
			t.Errorf("got %v, want ErrNoApprovedRevision", err)
		}
	})

	t.Run("republishing does not restate the original publication date", func(t *testing.T) {
		t.Parallel()

		// publishedAt is the article's date of record. A story pulled for a
		// correction and put back must not resurface as today's news.
		first := now.Add(-72 * time.Hour)
		pulled := anArticle(func(s *editorial.ArticleState) {
			s.Status = editorial.StatusUnpublished
			s.ApprovedRevisionID = &revID
			s.PublishedAt = &first
		})

		got, err := pulled.Publish(now, editor())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if at, _ := got.PublishedAt(); !at.Equal(first) {
			t.Errorf("publishedAt = %v, want the original %v", at, first)
		}
	})
}

func TestSchedule(t *testing.T) {
	t.Parallel()

	approved := anArticle(func(s *editorial.ArticleState) {
		s.Status = editorial.StatusApproved
		s.ApprovedRevisionID = &revID
	})

	t.Run("schedules for a future time", func(t *testing.T) {
		t.Parallel()

		later := now.Add(time.Hour)

		got, err := approved.Schedule(later, now, editor())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if at, ok := got.ScheduledAt(); !ok || !at.Equal(later) {
			t.Errorf("scheduledAt = %v (ok=%v), want %v", at, ok, later)
		}
	})

	t.Run("refuses a time that has already passed", func(t *testing.T) {
		t.Parallel()

		_, err := approved.Schedule(now.Add(-time.Minute), now, editor())
		if !errors.Is(err, editorial.ErrScheduleInPast) {
			t.Errorf("got %v, want ErrScheduleInPast", err)
		}
	})
}

func TestRetitleFreezesTheSlugAfterPublication(t *testing.T) {
	t.Parallel()

	t.Run("an unpublished draft re-slugs with its new title", func(t *testing.T) {
		t.Parallel()

		got, err := anArticle().Retitle("Budget 2027 Explained", author())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Slug().String() != "budget-2027-explained" {
			t.Errorf("slug = %q, want budget-2027-explained", got.Slug())
		}
	})

	t.Run("a once-published article keeps its address", func(t *testing.T) {
		t.Parallel()

		// Every inbound link, share and search result points at that URL.
		// The headline may still be corrected; the address may not move.
		published := now.Add(-time.Hour)
		pulled := anArticle(func(s *editorial.ArticleState) {
			s.Status = editorial.StatusUnpublished
			s.PublishedAt = &published
		})

		got, err := pulled.Retitle("Budget 2026: Corrected", author())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Slug().String() != "budget-2026" {
			t.Errorf("slug moved to %q after publication", got.Slug())
		}
		if got.Title() != "Budget 2026: Corrected" {
			t.Errorf("title = %q, want the correction to apply", got.Title())
		}
	})

	t.Run("refuses to edit an article that is in review", func(t *testing.T) {
		t.Parallel()

		inReview := anArticle(func(s *editorial.ArticleState) { s.Status = editorial.StatusInReview })

		if _, err := inReview.Retitle("Anything", author()); !errors.Is(err, editorial.ErrNotEditable) {
			t.Errorf("got %v, want ErrNotEditable", err)
		}
	})
}

func TestReadableBy(t *testing.T) {
	t.Parallel()

	draft := anArticle()
	published := anArticle(func(s *editorial.ArticleState) { s.Status = editorial.StatusPublished })

	cases := []struct {
		name    string
		article editorial.Article
		actor   identity.Actor
		want    bool
	}{
		{"anyone may read a published article", published, subscriber(), true},
		{"the author may read their own draft", draft, author(), true},
		{"an editor may read any draft", draft, editor(), true},
		{"a reader may not read someone's draft", draft, subscriber(), false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := tc.article.ReadableBy(tc.actor); got != tc.want {
				t.Errorf("ReadableBy = %v, want %v", got, tc.want)
			}
		})
	}
}
