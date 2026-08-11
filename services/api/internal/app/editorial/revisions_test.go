package editorial_test

import (
	"context"
	"errors"
	"testing"

	app "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func twoRevisions(t *testing.T) harness {
	t.Helper()
	h := newHarness(draftArticle("art_1"))
	first := editorial.NewRevision("rev_1", "art_1", nil, "T", "first", "usr_author", now)
	_ = h.revisions.Append(context.Background(), first)
	second := editorial.NewRevision("rev_2", "art_1", &first, "T", "second", "usr_author", now)
	_ = h.revisions.Append(context.Background(), second)

	return h
}

func TestListRevisionsNewestFirst(t *testing.T) {
	t.Parallel()

	h := twoRevisions(t)
	got, err := app.NewListRevisions(h.deps).Execute(context.Background(), app.HistoryInput{
		Actor: author(), ArticleID: "art_1",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got.Items) != 2 || got.Items[0].Body != "second" || got.Items[1].Body != "first" {
		t.Errorf("items = %+v", got.Items)
	}
}

func TestRestoreWritesForward(t *testing.T) {
	t.Parallel()

	h := twoRevisions(t)
	got, err := app.NewRestoreRevision(h.deps).Execute(context.Background(), app.RestoreInput{
		Actor: author(), ArticleID: "art_1", RevisionID: "rev_1",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Seq != 3 {
		t.Errorf("seq = %d, want 3", got.Seq)
	}
}

func TestRestoreMissingRevision(t *testing.T) {
	t.Parallel()

	h := newHarness(draftArticle("art_1"))
	_, err := app.NewRestoreRevision(h.deps).Execute(context.Background(), app.RestoreInput{
		Actor: author(), ArticleID: "art_1", RevisionID: "rev_nope",
	})
	if !errors.Is(err, ports.ErrNotFound) {
		t.Errorf("got %v, want ErrNotFound", err)
	}
}

func TestRestoreAppendFailure(t *testing.T) {
	t.Parallel()

	h := newHarness(draftArticle("art_1"))
	first := editorial.NewRevision("rev_1", "art_1", nil, "T", "first", "usr_author", now)
	_ = h.revisions.Append(context.Background(), first)
	boom := errors.New("disk full")
	h.revisions.FailAppend = boom
	_, err := app.NewRestoreRevision(h.deps).Execute(context.Background(), app.RestoreInput{
		Actor: author(), ArticleID: "art_1", RevisionID: "rev_1",
	})
	if !errors.Is(err, boom) {
		t.Errorf("got %v, want disk full", err)
	}
}

func TestListRevisionsMissingArticle(t *testing.T) {
	t.Parallel()

	h := newHarness()
	_, err := app.NewListRevisions(h.deps).Execute(context.Background(), app.HistoryInput{
		Actor: author(), ArticleID: "missing",
	})
	if !errors.Is(err, ports.ErrNotFound) {
		t.Errorf("got %v, want ErrNotFound", err)
	}
}

func TestRestoreRefusesInReview(t *testing.T) {
	t.Parallel()

	inReview := editorial.Reconstitute(editorial.ArticleState{
		ID: "art_1", Locale: "en", Slug: shared.SlugFrom("x"),
		Title: "X", AuthorID: "usr_author", Status: editorial.StatusInReview,
	})
	h := newHarness(inReview)
	_, err := app.NewRestoreRevision(h.deps).Execute(context.Background(), app.RestoreInput{
		Actor: author(), ArticleID: "art_1", RevisionID: "rev_1",
	})
	if !errors.Is(err, editorial.ErrNotEditable) {
		t.Errorf("got %v, want ErrNotEditable", err)
	}
}
