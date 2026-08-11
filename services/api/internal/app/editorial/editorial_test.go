package editorial_test

import (
	"context"
	"errors"
	"testing"
	"time"

	app "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/app/ports"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var now = time.Date(2026, 8, 9, 12, 0, 0, 0, time.UTC)

func author() identity.Actor {
	return identity.NewActor(shared.UserID("usr_author"), []identity.Role{identity.RoleAuthor})
}

func editor() identity.Actor {
	return identity.NewActor(shared.UserID("usr_editor"), []identity.Role{identity.RoleEditor})
}

func reader() identity.Actor {
	return identity.NewActor(shared.UserID("usr_reader"), []identity.Role{identity.RoleSubscriber})
}

type harness struct {
	deps       app.Deps
	articles   *faketesting.ArticleStore
	revisions  *faketesting.RevisionStore
	categories *faketesting.CategoryStore
	events     *faketesting.RecordingEventBus
}

func newHarness(seed ...editorial.Article) harness {
	articles := faketesting.NewArticleStore(seed...)
	revisions := faketesting.NewRevisionStore()
	categories := faketesting.NewCategoryStore()
	events := &faketesting.RecordingEventBus{}

	return harness{
		deps: app.Deps{
			Articles:   articles,
			Revisions:  revisions,
			Categories: categories,
			Clock:      faketesting.FixedClock{At: now},
			IDs:        &faketesting.SequentialIDs{},
			Events:     events,
		},
		articles: articles, revisions: revisions, categories: categories, events: events,
	}
}

func TestCreateDraft(t *testing.T) {
	t.Parallel()

	t.Run("creates an article and its first revision", func(t *testing.T) {
		t.Parallel()

		h := newHarness()

		article, err := app.NewCreateDraft(h.deps).Execute(context.Background(), app.CreateDraftInput{
			Actor: author(), Locale: "en", Title: "Budget 2026 Explained", Body: "Opening text.",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if article.Slug().String() != "budget-2026-explained" {
			t.Errorf("slug = %q", article.Slug())
		}
		if article.Status() != editorial.StatusDraft {
			t.Errorf("status = %s, want draft", article.Status())
		}
		if h.revisions.Count() != 1 {
			t.Errorf("revisions = %d, want 1", h.revisions.Count())
		}
	})

	t.Run("a reader may not create a draft", func(t *testing.T) {
		t.Parallel()

		h := newHarness()

		_, err := app.NewCreateDraft(h.deps).Execute(context.Background(), app.CreateDraftInput{
			Actor: reader(), Locale: "en", Title: "Anything",
		})
		if !errors.Is(err, identity.ErrNotPermitted) {
			t.Errorf("got %v, want ErrNotPermitted", err)
		}
		if h.revisions.Count() != 0 {
			t.Error("a refused request still wrote a revision")
		}
	})

	t.Run("refuses a title that yields no slug", func(t *testing.T) {
		t.Parallel()

		// An article with no addressable URL cannot be published, so this is
		// caught at creation rather than discovered at publish time.
		h := newHarness()

		_, err := app.NewCreateDraft(h.deps).Execute(context.Background(), app.CreateDraftInput{
			Actor: author(), Locale: "en", Title: "!!! ???",
		})
		if !errors.Is(err, app.ErrUntitled) {
			t.Errorf("got %v, want ErrUntitled", err)
		}
	})

	t.Run("refuses a slug already used in that locale", func(t *testing.T) {
		t.Parallel()

		slug, _ := shared.NewSlug("budget-2026")
		existing := editorial.Reconstitute(editorial.ArticleState{
			ID: shared.ArticleID("art_1"), Locale: "en", Slug: slug, Status: editorial.StatusPublished,
		})
		h := newHarness(existing)

		_, err := app.NewCreateDraft(h.deps).Execute(context.Background(), app.CreateDraftInput{
			Actor: author(), Locale: "en", Title: "Budget 2026",
		})
		if !errors.Is(err, app.ErrSlugTaken) {
			t.Errorf("got %v, want ErrSlugTaken", err)
		}
	})

	t.Run("the same slug is free in a different locale", func(t *testing.T) {
		t.Parallel()

		// "Locale is data": a French article is its own document with its own
		// slug. Two locales occupying the same word is not a collision.
		slug, _ := shared.NewSlug("budget-2026")
		english := editorial.Reconstitute(editorial.ArticleState{
			ID: shared.ArticleID("art_1"), Locale: "en", Slug: slug,
		})
		h := newHarness(english)

		_, err := app.NewCreateDraft(h.deps).Execute(context.Background(), app.CreateDraftInput{
			Actor: author(), Locale: "fr", Title: "Budget 2026",
		})
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("creating a draft announces nothing", func(t *testing.T) {
		t.Parallel()

		// A draft is not news. Publishing an event would invalidate caches for
		// something no reader can see.
		h := newHarness()

		if _, err := app.NewCreateDraft(h.deps).Execute(context.Background(), app.CreateDraftInput{
			Actor: author(), Locale: "en", Title: "Quiet Draft",
		}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(h.events.Events) != 0 {
			t.Errorf("events = %v, want none", h.events.Names())
		}
	})
}

func approvedArticle(id string, scheduledAt *time.Time) editorial.Article {
	slug, _ := shared.NewSlug("budget-2026")
	revID := shared.RevisionID("rev_1")
	status := editorial.StatusApproved
	if scheduledAt != nil {
		status = editorial.StatusScheduled
	}

	return editorial.Reconstitute(editorial.ArticleState{
		ID:                 shared.ArticleID(id),
		Locale:             "en",
		Slug:               slug,
		Title:              "Budget 2026",
		AuthorID:           shared.UserID("usr_author"),
		Status:             status,
		ApprovedRevisionID: &revID,
		ScheduledAt:        scheduledAt,
	})
}

func TestPublishArticle(t *testing.T) {
	t.Parallel()

	t.Run("publishes and announces", func(t *testing.T) {
		t.Parallel()

		h := newHarness(approvedArticle("art_1", nil))

		got, err := app.NewPublishArticle(h.deps).Execute(context.Background(), app.PublishArticleInput{
			Actor: editor(), ArticleID: shared.ArticleID("art_1"),
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Status() != editorial.StatusPublished {
			t.Errorf("status = %s", got.Status())
		}

		if names := h.events.Names(); len(names) != 1 || names[0] != "article.published" {
			t.Errorf("events = %v", names)
		}
	})

	t.Run("an author may not publish", func(t *testing.T) {
		t.Parallel()

		h := newHarness(approvedArticle("art_1", nil))

		_, err := app.NewPublishArticle(h.deps).Execute(context.Background(), app.PublishArticleInput{
			Actor: author(), ArticleID: shared.ArticleID("art_1"),
		})
		if !errors.Is(err, identity.ErrNotPermitted) {
			t.Errorf("got %v, want ErrNotPermitted", err)
		}
		if len(h.events.Events) != 0 {
			t.Error("a refused publish still announced")
		}
	})

	t.Run("a missing article is not found", func(t *testing.T) {
		t.Parallel()

		h := newHarness()

		_, err := app.NewPublishArticle(h.deps).Execute(context.Background(), app.PublishArticleInput{
			Actor: editor(), ArticleID: shared.ArticleID("art_nope"),
		})
		if !errors.Is(err, ports.ErrNotFound) {
			t.Errorf("got %v, want ErrNotFound", err)
		}
	})

	t.Run("a failed announcement does not fail an completed publish", func(t *testing.T) {
		t.Parallel()

		// The article IS published by the time the event goes out. Failing here
		// would tell the editor it did not work and invite a second attempt.
		h := newHarness(approvedArticle("art_1", nil))
		h.events.Err = errors.New("bus down")

		got, err := app.NewPublishArticle(h.deps).Execute(context.Background(), app.PublishArticleInput{
			Actor: editor(), ArticleID: shared.ArticleID("art_1"),
		})
		if err != nil {
			t.Fatalf("a broken event bus failed the publish: %v", err)
		}
		if got.Status() != editorial.StatusPublished {
			t.Errorf("status = %s", got.Status())
		}
	})
}

func TestPublishDueArticles(t *testing.T) {
	t.Parallel()

	systemActor := identity.NewActor(
		shared.UserID("usr_system"), []identity.Role{identity.RoleAdministrator},
	)

	t.Run("publishes everything whose time has come", func(t *testing.T) {
		t.Parallel()

		past := now.Add(-time.Minute)
		future := now.Add(time.Hour)
		h := newHarness(approvedArticle("art_1", &past), approvedArticle("art_2", &future))

		result, err := app.NewPublishDueArticles(h.deps).Execute(context.Background(), systemActor)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(result.Published) != 1 || result.Published[0].ID != "art_1" {
			t.Errorf("published = %v, want only art_1", result.Published)
		}
		if result.Published[0].Slug == "" || result.Published[0].Locale == "" {
			t.Errorf("published item must carry slug and locale for cache invalidation: %+v", result.Published[0])
		}
		if len(result.Failed) != 0 {
			t.Errorf("failed = %v", result.Failed)
		}
	})

	t.Run("one failure does not strand the batch", func(t *testing.T) {
		t.Parallel()

		// art_bad is scheduled but has no approved revision, so the domain
		// refuses it. art_good must still go live.
		past := now.Add(-time.Minute)
		slug, _ := shared.NewSlug("no-approval")
		bad := editorial.Reconstitute(editorial.ArticleState{
			ID: shared.ArticleID("art_bad"), Locale: "en", Slug: slug,
			Status: editorial.StatusScheduled, ScheduledAt: &past,
		})
		h := newHarness(approvedArticle("art_good", &past), bad)

		result, err := app.NewPublishDueArticles(h.deps).Execute(context.Background(), systemActor)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(result.Published) != 1 || result.Published[0].ID != "art_good" {
			t.Errorf("published = %v", result.Published)
		}
		if len(result.Failed) != 1 || result.Failed[0].ArticleID != "art_bad" {
			t.Errorf("failed = %+v", result.Failed)
		}
		if result.Failed[0].Reason == "" {
			t.Error("a failure with no reason cannot be alerted on")
		}
	})

	t.Run("nothing due is not an error", func(t *testing.T) {
		t.Parallel()

		h := newHarness()

		result, err := app.NewPublishDueArticles(h.deps).Execute(context.Background(), systemActor)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result.Published) != 0 || len(result.Failed) != 0 {
			t.Errorf("result = %+v", result)
		}
	})
}

// Storage failures. A use case that swallows one looks identical to a working
// one right up until an editor finds their article never persisted.
func TestStorageFailuresSurface(t *testing.T) {
	t.Parallel()

	boom := errors.New("mongo is down")

	// The three create-path failures differ only in which store breaks, so they
	// are one table rather than three near-identical blocks.
	createFailures := map[string]func(h harness){
		"a failed slug check":      func(h harness) { h.articles.FailSlugTaken = boom },
		"a failed revision append": func(h harness) { h.revisions.FailAppend = boom },
		"a failed article save":    func(h harness) { h.articles.FailSave = boom },
	}

	for name, breakIt := range createFailures {
		t.Run(name+" stops the create", func(t *testing.T) {
			t.Parallel()

			h := newHarness()
			breakIt(h)

			_, err := app.NewCreateDraft(h.deps).Execute(context.Background(), app.CreateDraftInput{
				Actor: author(), Locale: "en", Title: "Budget 2026",
			})
			if !errors.Is(err, boom) {
				t.Errorf("got %v, want the storage error", err)
			}
		})
	}

	t.Run("a failed save stops the publish and the announcement", func(t *testing.T) {
		t.Parallel()

		h := newHarness(approvedArticle("art_1", nil))
		h.articles.FailSave = boom

		_, err := app.NewPublishArticle(h.deps).Execute(context.Background(), app.PublishArticleInput{
			Actor: editor(), ArticleID: shared.ArticleID("art_1"),
		})
		if !errors.Is(err, boom) {
			t.Errorf("got %v, want the storage error", err)
		}
		if len(h.events.Events) != 0 {
			t.Error("announced a publication that did not persist")
		}
	})

	t.Run("a failed due-list fails the cron run", func(t *testing.T) {
		t.Parallel()

		// Distinct from "nothing was due". A cron that reports success when it
		// could not read the queue would hide a total outage of scheduling.
		h := newHarness()
		h.articles.FailListDue = boom

		systemActor := identity.NewActor(
			shared.UserID("usr_system"), []identity.Role{identity.RoleAdministrator},
		)

		if _, err := app.NewPublishDueArticles(h.deps).Execute(context.Background(), systemActor); !errors.Is(err, boom) {
			t.Errorf("got %v, want the storage error", err)
		}
	})
}

func TestCreateDraftStartsANewFamilyWhenNoneGiven(t *testing.T) {
	t.Parallel()

	h := newHarness()

	standalone, err := app.NewCreateDraft(h.deps).Execute(context.Background(), app.CreateDraftInput{
		Actor: author(), Locale: "en", Title: "A New Story",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if standalone.FamilyID() == "" {
		t.Error("a standalone article still needs a family of its own")
	}

	// A translation joins the family it was given rather than starting one.
	translation, err := app.NewCreateDraft(h.deps).Execute(context.Background(), app.CreateDraftInput{
		Actor: author(), Locale: "fr", Title: "Une Nouvelle Histoire",
		FamilyID: standalone.FamilyID(),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if translation.FamilyID() != standalone.FamilyID() {
		t.Errorf("family = %q, want %q", translation.FamilyID(), standalone.FamilyID())
	}
}
