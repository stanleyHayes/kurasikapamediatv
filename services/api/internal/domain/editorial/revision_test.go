package editorial_test

import (
	"errors"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func aRevision(seq int, body string) editorial.Revision {
	return editorial.ReconstituteRevision(editorial.RevisionState{
		ID:        shared.RevisionID("rev_" + body),
		ArticleID: articleID,
		Seq:       seq,
		Title:     "Budget 2026",
		Body:      body,
		AuthorID:  authorID,
		CreatedAt: now,
	})
}

func TestNewRevisionStartsAtOne(t *testing.T) {
	t.Parallel()

	first := editorial.NewRevision(
		shared.RevisionID("rev_1"), articleID, nil, "Title", "Body", authorID, now,
	)

	if first.Seq() != 1 {
		t.Errorf("seq = %d, want 1", first.Seq())
	}
	if first.ArticleID() != articleID || first.AuthorID() != authorID {
		t.Error("revision does not belong to the article and author it was minted for")
	}
	if !first.CreatedAt().Equal(now) {
		t.Errorf("createdAt = %v, want %v", first.CreatedAt(), now)
	}
}

func TestNewRevisionAdvancesFromThePrevious(t *testing.T) {
	t.Parallel()

	// Seq is derived, never supplied, so a caller cannot write history out of
	// order. The unique (articleID, seq) index turns a concurrent double
	// append into a duplicate key error rather than a silently lost revision.
	previous := aRevision(7, "old")

	next := editorial.NewRevision(
		shared.RevisionID("rev_8"), articleID, &previous, "Title", "New body", authorID, now,
	)

	if next.Seq() != 8 {
		t.Errorf("seq = %d, want 8", next.Seq())
	}
	if next.Body() != "New body" {
		t.Errorf("body = %q", next.Body())
	}
}

func TestRestoreOntoWritesForwardRatherThanRewinding(t *testing.T) {
	t.Parallel()

	// The history of a correction is itself part of the record. Rewinding by
	// deletion would erase the evidence that a correction ever happened, and a
	// newsroom must be able to answer "what did we publish, and when".
	original := aRevision(1, "the original text")
	latest := aRevision(3, "a version we regret")
	restoredBy := shared.UserID("usr_editor")
	later := now.Add(time.Hour)

	restored, err := original.RestoreOnto(shared.RevisionID("rev_4"), latest, restoredBy, later)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if restored.Seq() != 4 {
		t.Errorf("seq = %d, want 4 — restoring moves history forward", restored.Seq())
	}
	if restored.Body() != "the original text" {
		t.Errorf("body = %q, want the restored text", restored.Body())
	}

	// The restoring editor authored this revision — they made the call.
	// Attributing it to the original author would misstate who decided.
	if restored.AuthorID() != restoredBy {
		t.Errorf("authorID = %q, want the restoring editor", restored.AuthorID())
	}
	if !restored.CreatedAt().Equal(later) {
		t.Errorf("createdAt = %v, want the restoration time", restored.CreatedAt())
	}
}

func TestRestoreOntoRefusesAForeignArticle(t *testing.T) {
	t.Parallel()

	original := aRevision(1, "text")
	foreign := editorial.ReconstituteRevision(editorial.RevisionState{
		ID:        shared.RevisionID("rev_other"),
		ArticleID: shared.ArticleID("art_other"),
		Seq:       5,
	})

	_, err := original.RestoreOnto(shared.RevisionID("rev_new"), foreign, authorID, now)
	if !errors.Is(err, editorial.ErrRevisionNotOfArticle) {
		t.Errorf("got %v, want ErrRevisionNotOfArticle", err)
	}
}

func TestRestoreOntoRefusesToGoBackwards(t *testing.T) {
	t.Parallel()

	// Restoring onto something older than the source would produce a seq that
	// collides with history rather than extending it.
	original := aRevision(5, "text")
	older := aRevision(2, "older")

	_, err := original.RestoreOnto(shared.RevisionID("rev_new"), older, authorID, now)
	if !errors.Is(err, editorial.ErrNonMonotonicSeq) {
		t.Errorf("got %v, want ErrNonMonotonicSeq", err)
	}
}

func TestRevisionStateRoundTrips(t *testing.T) {
	t.Parallel()

	original := editorial.RevisionState{
		ID:        shared.RevisionID("rev_1"),
		ArticleID: articleID,
		Seq:       2,
		Title:     "Budget 2026",
		Body:      "Body text",
		AuthorID:  authorID,
		CreatedAt: now,
	}

	got := editorial.ReconstituteRevision(original).State()

	if got != original {
		t.Errorf("round trip lost data: %+v", got)
	}
}
