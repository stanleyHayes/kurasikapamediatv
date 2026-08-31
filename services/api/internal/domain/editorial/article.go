package editorial

import (
	"errors"
	"fmt"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

// Errors the aggregate raises. Each names a rule, not a mechanism.
var (
	// ErrIllegalTransition means the move is not legal from the current state.
	ErrIllegalTransition = errors.New("illegal transition")
	// ErrNotOwnArticle means the actor may only act on their own work.
	ErrNotOwnArticle = errors.New("article belongs to another author")
	// ErrNotEditable means the article is not in a directly editable state.
	ErrNotEditable = errors.New("article is not editable in this state")
	// ErrNoApprovedRevision means publication was attempted with nothing approved.
	ErrNoApprovedRevision = errors.New("article has no approved revision")
	// ErrRevisionNotOfArticle means an approval named a revision of something else.
	ErrRevisionNotOfArticle = errors.New("revision does not belong to this article")
	// ErrScheduleInPast means a publication time had already passed.
	ErrScheduleInPast = errors.New("scheduled time is in the past")
)

// Article is one story in one locale.
//
// A French article is its own Article with its own slug, byline and publish
// state — not a field on the English one. FamilyID is what ties translations
// together. "Locale is data" is a product rule, not a preference.
type Article struct {
	id                 shared.ArticleID
	familyID           shared.FamilyID
	locale             string
	slug               shared.Slug
	title              string
	authorID           shared.UserID
	categoryID         shared.CategoryID
	tagIDs             []shared.TagID
	hero               *ArticleHero
	narration          *ArticleNarration
	status             Status
	approvedRevisionID *shared.RevisionID
	scheduledAt        *time.Time
	publishedAt        *time.Time
}

// ArticleState is the full set of fields, for reconstitution and persistence.
type ArticleState struct {
	ID                 shared.ArticleID
	FamilyID           shared.FamilyID
	Locale             string
	Slug               shared.Slug
	Title              string
	AuthorID           shared.UserID
	CategoryID         shared.CategoryID
	TagIDs             []shared.TagID
	Hero               *ArticleHero
	Narration          *ArticleNarration
	Status             Status
	ApprovedRevisionID *shared.RevisionID
	ScheduledAt        *time.Time
	PublishedAt        *time.Time
}

// Reconstitute rebuilds an article from storage without re-running any rule.
//
// Deliberately separate from any constructor that validates: a document
// already in the database happened, and refusing to load it because a rule has
// since tightened would make the article unreachable rather than correctable.
func Reconstitute(s ArticleState) Article {
	return Article{
		id: s.ID, familyID: s.FamilyID, locale: s.Locale, slug: s.Slug,
		title: s.Title, authorID: s.AuthorID, categoryID: s.CategoryID,
		tagIDs: s.TagIDs, hero: s.Hero, narration: s.Narration, status: s.Status,
		approvedRevisionID: s.ApprovedRevisionID,
		scheduledAt:        s.ScheduledAt, publishedAt: s.PublishedAt,
	}
}

// State returns a snapshot for mapping to storage.
func (a Article) State() ArticleState {
	return ArticleState{
		ID: a.id, FamilyID: a.familyID, Locale: a.locale, Slug: a.slug,
		Title: a.title, AuthorID: a.authorID, CategoryID: a.categoryID,
		TagIDs: a.tagIDs, Hero: a.hero, Narration: a.narration, Status: a.status,
		ApprovedRevisionID: a.approvedRevisionID,
		ScheduledAt:        a.scheduledAt, PublishedAt: a.publishedAt,
	}
}

// Accessors. Fields stay unexported so no caller can move an article between
// states without going through a transition.
func (a Article) ID() shared.ArticleID          { return a.id }
func (a Article) FamilyID() shared.FamilyID     { return a.familyID }
func (a Article) Locale() string                { return a.locale }
func (a Article) Slug() shared.Slug             { return a.slug }
func (a Article) Title() string                 { return a.title }
func (a Article) AuthorID() shared.UserID       { return a.authorID }
func (a Article) CategoryID() shared.CategoryID { return a.categoryID }
func (a Article) Status() Status                { return a.status }

// ApprovedRevisionID returns the approved revision, if any.
func (a Article) ApprovedRevisionID() (shared.RevisionID, bool) {
	if a.approvedRevisionID == nil {
		return "", false
	}

	return *a.approvedRevisionID, true
}

// ScheduledAt returns the scheduled publication time, if any.
func (a Article) ScheduledAt() (time.Time, bool) {
	if a.scheduledAt == nil {
		return time.Time{}, false
	}

	return *a.scheduledAt, true
}

// PublishedAt returns the first publication time, if any.
func (a Article) PublishedAt() (time.Time, bool) {
	if a.publishedAt == nil {
		return time.Time{}, false
	}

	return *a.publishedAt, true
}

// HasBeenPublished reports whether this article was ever live.
//
// Distinct from "is published now": an unpublished article has been published,
// and that is exactly why its slug stays frozen.
func (a Article) HasBeenPublished() bool { return a.publishedAt != nil }

// ReadableBy reports whether an actor may read this article.
//
// A published article is readable by anyone. An unpublished one is readable by
// its author, or by someone who may edit any article.
func (a Article) ReadableBy(actor identity.Actor) bool {
	if IsPubliclyVisible(a.status) {
		return true
	}
	if actor.Can(identity.PermArticleEditAny) {
		return true
	}

	return actor.ID() == a.authorID && actor.Can(identity.PermArticleEditOwn)
}

// Retitle changes the headline, and the slug with it until first publication.
//
// The slug freezes the moment an article goes live. Every inbound link, every
// share and every search result points at that URL; changing it later breaks
// all of them silently. Editors can still fix a headline afterwards — the
// headline and the address simply stop being the same thing.
func (a Article) Retitle(title string, actor identity.Actor) (Article, error) {
	if err := a.guardEditable(actor); err != nil {
		return Article{}, err
	}

	next := a
	next.title = title

	if !a.HasBeenPublished() {
		if derived := shared.SlugFrom(title); !derived.IsZero() {
			next.slug = derived
		}
	}

	return next, nil
}

// Submit, Approve, Reject, Schedule, Publish and Unpublish are the six moves.

// Submit sends a draft to the review queue.
func (a Article) Submit(actor identity.Actor) (Article, error) {
	return a.transition(TransitionSubmit, actor)
}

// Approve marks a specific revision as the one that may be published.
//
// Takes the revision explicitly rather than assuming the latest: between an
// editor reading a draft and pressing approve, the author may have saved
// again, and approving text nobody reviewed is exactly the failure the review
// step exists to prevent.
func (a Article) Approve(revisionID shared.RevisionID, articleOfRevision shared.ArticleID, actor identity.Actor) (Article, error) {
	if articleOfRevision != a.id {
		return Article{}, fmt.Errorf("%w: %s", ErrRevisionNotOfArticle, revisionID)
	}

	next, err := a.transition(TransitionApprove, actor)
	if err != nil {
		return Article{}, err
	}

	next.approvedRevisionID = &revisionID
	if next.narration != nil && next.narration.SourceRevisionID != revisionID {
		next.narration = nil
	}

	return next, nil
}

// Reject sends an article back to draft and withdraws any approval.
func (a Article) Reject(actor identity.Actor) (Article, error) {
	next, err := a.transition(TransitionReject, actor)
	if err != nil {
		return Article{}, err
	}

	// Clearing the approval is the point of a rejection. Leaving it would let
	// the next publish call ship the text that was just refused.
	next.approvedRevisionID = nil
	next.narration = nil

	return next, nil
}

// Schedule sets a future publication time for an approved article.
func (a Article) Schedule(at time.Time, now time.Time, actor identity.Actor) (Article, error) {
	if !at.After(now) {
		return Article{}, fmt.Errorf("%w: %s", ErrScheduleInPast, at.Format(time.RFC3339))
	}

	next, err := a.transition(TransitionSchedule, actor)
	if err != nil {
		return Article{}, err
	}

	next.scheduledAt = &at

	return next, nil
}

// Publish makes the article live.
func (a Article) Publish(now time.Time, actor identity.Actor) (Article, error) {
	if a.approvedRevisionID == nil {
		return Article{}, ErrNoApprovedRevision
	}

	next, err := a.transition(TransitionPublish, actor)
	if err != nil {
		return Article{}, err
	}

	// First publication only. publishedAt is the article's date of record —
	// re-publishing after a correction must not restate it as today's news.
	if next.publishedAt == nil {
		next.publishedAt = &now
	}
	next.scheduledAt = nil

	return next, nil
}

// Unpublish pulls a live article, keeping its approval for a quick restore.
func (a Article) Unpublish(actor identity.Actor) (Article, error) {
	return a.transition(TransitionUnpublish, actor)
}

// transition applies a move after checking permission, ownership and state.
//
// The order is deliberate: permission, then ownership, then state.
//
// "You may not do this at all" outranks "you may not do this to *this*
// article". Telling someone with no editorial permission that an article
// "belongs to another author" confirms both that the article exists and who
// wrote it — and unpublished drafts are exactly what that leak would expose.
// A failing test caught this order being wrong once already.
func (a Article) transition(t Transition, actor identity.Actor) (Article, error) {
	rule, ok := RuleFor(t)
	if !ok {
		return Article{}, fmt.Errorf("%w: unknown transition %q", ErrIllegalTransition, t)
	}

	if err := actor.Require(rule.Permission); err != nil {
		return Article{}, err
	}

	if rule.AuthorOnly {
		if err := a.guardOwnership(actor); err != nil {
			return Article{}, err
		}
	}

	if !AllowedFrom(t, a.status) {
		return Article{}, fmt.Errorf("%w: cannot %s from %s", ErrIllegalTransition, t, a.status)
	}

	next := a
	next.status = rule.To

	return next, nil
}

// guardEditable refuses direct edits outside the states that allow them.
func (a Article) guardEditable(actor identity.Actor) error {
	if err := actor.Require(identity.PermArticleEditOwn); err != nil {
		return err
	}
	if err := a.guardOwnership(actor); err != nil {
		return err
	}

	// A published article is changed by approving a new revision, not by
	// editing it in place. In review means someone is reading it right now.
	if a.status != StatusDraft && a.status != StatusUnpublished {
		return fmt.Errorf("%w: %s", ErrNotEditable, a.status)
	}

	return nil
}

func (a Article) guardOwnership(actor identity.Actor) error {
	if actor.Can(identity.PermArticleEditAny) {
		return nil
	}
	if actor.ID() != a.authorID {
		return ErrNotOwnArticle
	}

	return nil
}
