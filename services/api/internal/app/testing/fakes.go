// Package testing holds hand-written fakes for the ports.
//
// Hand-written, never generated mocks. A fake that actually stores what you
// save it and refuses what the real thing would refuse catches wiring mistakes
// a stubbed method call cannot — the append-only revision store here really is
// append-only, so a use case that tried to overwrite history would fail its
// test rather than pass one built from the same wrong assumption.
package testing

import (
	"context"
	"sort"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/shared"
)

// FixedClock returns the same instant every time, so tests can assert on it.
type FixedClock struct{ At time.Time }

// Now returns the fixed instant.
func (c FixedClock) Now() time.Time { return c.At }

// SequentialIDs hands out predictable ids: id_1, id_2, and so on.
//
// Predictable rather than random, because a test asserting on an id it cannot
// predict is a test asserting on nothing.
type SequentialIDs struct{ n int }

// NewID returns the next identifier in sequence.
func (g *SequentialIDs) NewID() string {
	g.n++

	return "id_" + itoa(g.n)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}

	digits := ""
	for n > 0 {
		digits = string(rune('0'+n%10)) + digits
		n /= 10
	}

	return digits
}

// RecordingEventBus keeps every event it is given.
type RecordingEventBus struct {
	Events []ports.Event
	// Err, when set, makes Publish fail — so a test can prove that a failed
	// announcement does not fail an already-committed publish.
	Err error
}

// Publish records the event and returns the configured error.
func (b *RecordingEventBus) Publish(_ context.Context, event ports.Event) error {
	b.Events = append(b.Events, event)

	return b.Err
}

// Names returns the recorded event names, in order.
func (b *RecordingEventBus) Names() []string {
	names := make([]string, 0, len(b.Events))
	for _, e := range b.Events {
		names = append(names, e.Name)
	}

	return names
}

// ArticleStore is an in-memory ArticleRepository.
//
// The Fail* fields inject storage failures. A use case that swallows a failed
// Save looks identical to one that worked, right up until an editor discovers
// their article never persisted — so those paths get tested like any other.
type ArticleStore struct {
	items map[shared.ArticleID]editorial.Article

	FailSlugTaken     error
	FailFindBySlug    error
	FailFindMany      error
	FailListPublished error
	FailListAuthored  error
	FailSave          error
	FailListDue       error

	// LastPublished is the query the last ListPublished call received.
	LastPublished ports.PublishedQuery
}

// NewArticleStore seeds a store.
func NewArticleStore(seed ...editorial.Article) *ArticleStore {
	store := &ArticleStore{items: map[shared.ArticleID]editorial.Article{}}
	for _, a := range seed {
		store.items[a.ID()] = a
	}

	return store
}

// FindByID returns an article or ports.ErrNotFound.
func (s *ArticleStore) FindByID(_ context.Context, id shared.ArticleID) (editorial.Article, error) {
	article, ok := s.items[id]
	if !ok {
		return editorial.Article{}, ports.ErrNotFound
	}

	return article, nil
}

// FindBySlug returns the article at a slug in a locale.
func (s *ArticleStore) FindBySlug(_ context.Context, slug, locale string) (editorial.Article, error) {
	if s.FailFindBySlug != nil {
		return editorial.Article{}, s.FailFindBySlug
	}

	for _, a := range s.sorted() {
		if a.Slug().String() == slug && a.Locale() == locale {
			return a, nil
		}
	}

	return editorial.Article{}, ports.ErrNotFound
}

// FindManyByIDs returns whichever of the given articles exist.
func (s *ArticleStore) FindManyByIDs(_ context.Context, ids []shared.ArticleID) ([]editorial.Article, error) {
	if s.FailFindMany != nil {
		return nil, s.FailFindMany
	}
	out := []editorial.Article{}
	for _, id := range ids {
		if a, ok := s.items[id]; ok {
			out = append(out, a)
		}
	}

	return out, nil
}

// SlugTaken reports whether a slug is in use in a locale.
func (s *ArticleStore) SlugTaken(_ context.Context, slug, locale string) (bool, error) {
	if s.FailSlugTaken != nil {
		return false, s.FailSlugTaken
	}

	for _, a := range s.items {
		if a.Slug().String() == slug && a.Locale() == locale {
			return true, nil
		}
	}

	return false, nil
}

// ListPublished returns visible articles for a locale.
func (s *ArticleStore) ListPublished(_ context.Context, q ports.PublishedQuery) (ports.Page[editorial.Article], error) {
	if s.FailListPublished != nil {
		return ports.Page[editorial.Article]{}, s.FailListPublished
	}

	s.LastPublished = q
	out := []editorial.Article{}
	for _, a := range s.sorted() {
		if a.Locale() != q.Locale || !editorial.IsPubliclyVisible(a.Status()) {
			continue
		}
		if q.CategoryID != "" && a.CategoryID() != q.CategoryID {
			continue
		}
		out = append(out, a)
	}

	return ports.Page[editorial.Article]{Items: out}, nil
}

// ListAuthoredBy returns one author's own work.
func (s *ArticleStore) ListAuthoredBy(_ context.Context, q ports.AuthoredQuery) (ports.Page[editorial.Article], error) {
	if s.FailListAuthored != nil {
		return ports.Page[editorial.Article]{}, s.FailListAuthored
	}

	out := []editorial.Article{}
	for _, a := range s.sorted() {
		if a.AuthorID() == q.AuthorID {
			out = append(out, a)
		}
	}

	return ports.Page[editorial.Article]{Items: out}, nil
}

// ListAwaitingReview returns everything in review.
func (s *ArticleStore) ListAwaitingReview(_ context.Context, _ ports.Cursor) (ports.Page[editorial.Article], error) {
	out := []editorial.Article{}
	for _, a := range s.sorted() {
		if a.Status() == editorial.StatusInReview {
			out = append(out, a)
		}
	}

	return ports.Page[editorial.Article]{Items: out}, nil
}

// ListDueForPublication returns scheduled articles whose time has come.
func (s *ArticleStore) ListDueForPublication(_ context.Context, now time.Time) ([]editorial.Article, error) {
	if s.FailListDue != nil {
		return nil, s.FailListDue
	}

	out := []editorial.Article{}
	for _, a := range s.sorted() {
		at, ok := a.ScheduledAt()
		if a.Status() == editorial.StatusScheduled && ok && !at.After(now) {
			out = append(out, a)
		}
	}

	return out, nil
}

// Save writes the article.
func (s *ArticleStore) Save(_ context.Context, article editorial.Article) error {
	if s.FailSave != nil {
		return s.FailSave
	}

	s.items[article.ID()] = article

	return nil
}

// sorted returns articles in a stable id order, so tests do not depend on Go's
// randomised map iteration.
func (s *ArticleStore) sorted() []editorial.Article {
	ids := make([]string, 0, len(s.items))
	for id := range s.items {
		ids = append(ids, id.String())
	}
	sort.Strings(ids)

	out := make([]editorial.Article, 0, len(ids))
	for _, id := range ids {
		out = append(out, s.items[shared.ArticleID(id)])
	}

	return out
}

// RevisionStore is an in-memory RevisionRepository. Append-only, like the real
// collection — there is deliberately no way to overwrite or remove.
type RevisionStore struct {
	items []editorial.Revision

	// FailAppend injects a write failure.
	FailAppend   error
	FailFindMany error
}

// NewRevisionStore seeds a store.
func NewRevisionStore(seed ...editorial.Revision) *RevisionStore {
	return &RevisionStore{items: append([]editorial.Revision{}, seed...)}
}

// FindByID returns one revision.
func (s *RevisionStore) FindByID(_ context.Context, id shared.RevisionID) (editorial.Revision, error) {
	for _, r := range s.items {
		if r.ID() == id {
			return r, nil
		}
	}

	return editorial.Revision{}, ports.ErrNotFound
}

// FindLatest returns the newest revision of an article.
func (s *RevisionStore) FindLatest(_ context.Context, articleID shared.ArticleID) (editorial.Revision, error) {
	var latest editorial.Revision
	found := false

	for _, r := range s.items {
		if r.ArticleID() == articleID && (!found || r.Seq() > latest.Seq()) {
			latest, found = r, true
		}
	}

	if !found {
		return editorial.Revision{}, ports.ErrNotFound
	}

	return latest, nil
}

// FindManyByIDs returns whichever of the given revisions exist.
func (s *RevisionStore) FindManyByIDs(_ context.Context, ids []shared.RevisionID) ([]editorial.Revision, error) {
	if s.FailFindMany != nil {
		return nil, s.FailFindMany
	}
	wanted := map[shared.RevisionID]struct{}{}
	for _, id := range ids {
		wanted[id] = struct{}{}
	}

	out := []editorial.Revision{}
	for _, r := range s.items {
		if _, ok := wanted[r.ID()]; ok {
			out = append(out, r)
		}
	}

	return out, nil
}

// FindLatestForArticles returns the newest revision of each given article.
func (s *RevisionStore) FindLatestForArticles(ctx context.Context, ids []shared.ArticleID) ([]editorial.Revision, error) {
	out := []editorial.Revision{}
	for _, id := range ids {
		latest, err := s.FindLatest(ctx, id)
		if err != nil {
			continue
		}
		out = append(out, latest)
	}

	return out, nil
}

// ListFor returns an article's history, oldest first.
func (s *RevisionStore) ListFor(_ context.Context, articleID shared.ArticleID) ([]editorial.Revision, error) {
	out := []editorial.Revision{}
	for _, r := range s.items {
		if r.ArticleID() == articleID {
			out = append(out, r)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Seq() < out[j].Seq() })

	return out, nil
}

// Append adds a revision. There is no update and no delete, by design.
func (s *RevisionStore) Append(_ context.Context, revision editorial.Revision) error {
	if s.FailAppend != nil {
		return s.FailAppend
	}

	s.items = append(s.items, revision)

	return nil
}

// Count reports how many revisions are stored, for assertions.
func (s *RevisionStore) Count() int { return len(s.items) }
