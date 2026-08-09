package editorial

import (
	"errors"
	"time"

	"github.com/kurasikapa/api/internal/domain/shared"
)

// ErrNonMonotonicSeq is returned when a revision would not advance history.
var ErrNonMonotonicSeq = errors.New("revision: seq must increase")

// Revision is one immutable snapshot of an article's text.
//
// Append-only. There is deliberately no setter, no Update and no Delete —
// product rule 4 in spirit, and an editorial-integrity requirement in fact: a
// newsroom must be able to show what it said and when it said it.
//
// Restoring an older revision writes a NEW revision carrying the old body
// forward. The history of a correction is itself part of the record, and
// rewinding by deletion would erase the evidence that a correction happened.
type Revision struct {
	id        shared.RevisionID
	articleID shared.ArticleID
	seq       int
	title     string
	body      string
	authorID  shared.UserID
	createdAt time.Time
}

// RevisionState is the full set of fields, for reconstitution and persistence.
type RevisionState struct {
	ID        shared.RevisionID
	ArticleID shared.ArticleID
	Seq       int
	Title     string
	Body      string
	AuthorID  shared.UserID
	CreatedAt time.Time
}

// ReconstituteRevision rebuilds a revision from storage.
func ReconstituteRevision(s RevisionState) Revision {
	return Revision{
		id: s.ID, articleID: s.ArticleID, seq: s.Seq, title: s.Title,
		body: s.Body, authorID: s.AuthorID, createdAt: s.CreatedAt,
	}
}

// State returns a snapshot for mapping to storage.
func (r Revision) State() RevisionState {
	return RevisionState{
		ID: r.id, ArticleID: r.articleID, Seq: r.seq, Title: r.title,
		Body: r.body, AuthorID: r.authorID, CreatedAt: r.createdAt,
	}
}

// Accessors only. Nothing here can be changed after construction.
func (r Revision) ID() shared.RevisionID       { return r.id }
func (r Revision) ArticleID() shared.ArticleID { return r.articleID }
func (r Revision) Seq() int                    { return r.seq }
func (r Revision) Title() string               { return r.title }
func (r Revision) Body() string                { return r.body }
func (r Revision) AuthorID() shared.UserID     { return r.authorID }
func (r Revision) CreatedAt() time.Time        { return r.createdAt }

// NewRevision mints the next revision in an article's history.
//
// `previous` is the current newest revision, or nil for the first one. Seq is
// derived rather than supplied so a caller cannot write history out of order;
// the unique (articleID, seq) index turns a concurrent double-append into a
// duplicate key error rather than a silently lost revision.
func NewRevision(
	id shared.RevisionID,
	articleID shared.ArticleID,
	previous *Revision,
	title, body string,
	authorID shared.UserID,
	now time.Time,
) Revision {
	seq := 1
	if previous != nil {
		seq = previous.seq + 1
	}

	return Revision{
		id: id, articleID: articleID, seq: seq, title: title,
		body: body, authorID: authorID, createdAt: now,
	}
}

// RestoreOnto writes an older revision's text forward as a new revision.
//
// Deliberately not a rewind. The article's history keeps every step, including
// the mistake and the restoration, because "what did we publish and when" is a
// question a newsroom must be able to answer truthfully.
//
// The restoring editor becomes the author of the new revision — they are the
// one who decided to bring the text back, and attributing it to the original
// author would misstate who made that call.
func (r Revision) RestoreOnto(
	id shared.RevisionID,
	latest Revision,
	restoredBy shared.UserID,
	now time.Time,
) (Revision, error) {
	if latest.articleID != r.articleID {
		return Revision{}, ErrRevisionNotOfArticle
	}
	if latest.seq < r.seq {
		return Revision{}, ErrNonMonotonicSeq
	}

	return Revision{
		id:        id,
		articleID: r.articleID,
		seq:       latest.seq + 1,
		title:     r.title,
		body:      r.body,
		authorID:  restoredBy,
		createdAt: now,
	}, nil
}
