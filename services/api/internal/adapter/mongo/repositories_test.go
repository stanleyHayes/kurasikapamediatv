package mongo_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"

	adapter "github.com/kurasikapa/api/internal/adapter/mongo"
	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var testNow = time.Date(2026, 8, 9, 12, 0, 0, 0, time.UTC)

func article(id, slug, locale string, status editorial.Status, publishedAt *time.Time) editorial.Article {
	s := shared.SlugFrom(slug)
	revID := shared.RevisionID("rev_" + id)

	return editorial.Reconstitute(editorial.ArticleState{
		ID:                 shared.ArticleID(id),
		FamilyID:           shared.FamilyID("fam_" + id),
		Locale:             locale,
		Slug:               s,
		Title:              "Title " + id,
		AuthorID:           shared.UserID("usr_author"),
		CategoryID:         shared.CategoryID("cat_business"),
		Status:             status,
		ApprovedRevisionID: &revID,
		PublishedAt:        publishedAt,
	})
}

func TestArticleRoundTrip(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	repo := adapter.NewArticleRepository(h.DB, fixedClock{at: testNow})
	ctx := context.Background()

	published := testNow.Add(-time.Hour)
	original := article("art_1", "budget-2026", "en", editorial.StatusPublished, &published)

	if err := repo.Save(ctx, original); err != nil {
		t.Fatalf("save: %v", err)
	}

	got, err := repo.FindByID(ctx, shared.ArticleID("art_1"))
	if err != nil {
		t.Fatalf("findByID: %v", err)
	}

	if got.Slug().String() != "budget-2026" || got.Status() != editorial.StatusPublished {
		t.Errorf("got slug=%q status=%s", got.Slug(), got.Status())
	}
	if approved, ok := got.ApprovedRevisionID(); !ok || approved != "rev_art_1" {
		t.Errorf("approved revision = %v (ok=%v)", approved, ok)
	}
	if at, ok := got.PublishedAt(); !ok || !at.UTC().Equal(published) {
		t.Errorf("publishedAt = %v (ok=%v), want %v", at, ok, published)
	}
}

func TestFindByIDReportsNotFound(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	repo := adapter.NewArticleRepository(h.DB, fixedClock{at: testNow})

	_, err := repo.FindByID(context.Background(), shared.ArticleID("art_nope"))
	if !errors.Is(err, ports.ErrNotFound) {
		t.Errorf("got %v, want ports.ErrNotFound", err)
	}
}

func TestSlugIsUniquePerLocaleNotGlobally(t *testing.T) {
	t.Parallel()

	// "Locale is data": the English and French versions of a story may share a
	// word. Slug alone is not the key; the (slug, locale) pair is.
	h := newHarness(t)
	repo := adapter.NewArticleRepository(h.DB, fixedClock{at: testNow})
	ctx := context.Background()

	if err := repo.Save(ctx, article("art_en", "budget-2026", "en", editorial.StatusDraft, nil)); err != nil {
		t.Fatalf("save: %v", err)
	}

	takenEN, err := repo.SlugTaken(ctx, "budget-2026", "en")
	if err != nil {
		t.Fatalf("slugTaken: %v", err)
	}
	takenFR, err := repo.SlugTaken(ctx, "budget-2026", "fr")
	if err != nil {
		t.Fatalf("slugTaken: %v", err)
	}

	if !takenEN {
		t.Error("the English slug should be taken")
	}
	if takenFR {
		t.Error("the same word in French must be free")
	}

	// And FindBySlug must respect the pair too.
	if _, err := repo.FindBySlug(ctx, "budget-2026", "fr"); !errors.Is(err, ports.ErrNotFound) {
		t.Errorf("FindBySlug(fr) = %v, want ErrNotFound", err)
	}
}

func TestListPublishedHidesEverythingElse(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	repo := adapter.NewArticleRepository(h.DB, fixedClock{at: testNow})
	ctx := context.Background()

	published := testNow.Add(-time.Hour)
	seed := []editorial.Article{
		article("art_live", "live", "en", editorial.StatusPublished, &published),
		article("art_draft", "draft", "en", editorial.StatusDraft, nil),
		article("art_review", "review", "en", editorial.StatusInReview, nil),
		article("art_pulled", "pulled", "en", editorial.StatusUnpublished, &published),
		article("art_fr", "francais", "fr", editorial.StatusPublished, &published),
	}
	for _, a := range seed {
		if err := repo.Save(ctx, a); err != nil {
			t.Fatalf("save: %v", err)
		}
	}

	page, err := repo.ListPublished(ctx, ports.PublishedQuery{Locale: "en"})
	if err != nil {
		t.Fatalf("listPublished: %v", err)
	}

	if len(page.Items) != 1 || page.Items[0].ID() != "art_live" {
		ids := make([]string, 0, len(page.Items))
		for _, a := range page.Items {
			ids = append(ids, a.ID().String())
		}
		t.Errorf("got %v, want only art_live", ids)
	}
}

func TestListPublishedPagesByKeysetWithoutRepeating(t *testing.T) {
	t.Parallel()

	// The reason this layer is tested against a real database. A mocked driver
	// would return whatever the test author believed the filter matched, so a
	// wrong cursor and a wrong mock would agree and both pass.
	h := newHarness(t)
	repo := adapter.NewArticleRepository(h.DB, fixedClock{at: testNow})
	ctx := context.Background()

	for i := range 5 {
		at := testNow.Add(-time.Duration(i) * time.Hour)
		id := "art_" + string(rune('a'+i))
		if err := repo.Save(ctx, article(id, id, "en", editorial.StatusPublished, &at)); err != nil {
			t.Fatalf("save: %v", err)
		}
	}

	seen := map[shared.ArticleID]bool{}
	cursor := ports.Cursor{Limit: 2}

	for range 5 {
		page, err := repo.ListPublished(ctx, ports.PublishedQuery{Locale: "en", Cursor: cursor})
		if err != nil {
			t.Fatalf("listPublished: %v", err)
		}

		for _, a := range page.Items {
			if seen[a.ID()] {
				t.Fatalf("%s appeared on two pages", a.ID())
			}
			seen[a.ID()] = true
		}

		if page.NextCursor == "" {
			break
		}
		cursor.After = page.NextCursor
	}

	if len(seen) != 5 {
		t.Errorf("saw %d articles across all pages, want 5", len(seen))
	}
}

func TestListDueForPublicationRespectsTheClock(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	repo := adapter.NewArticleRepository(h.DB, fixedClock{at: testNow})
	ctx := context.Background()

	past := testNow.Add(-time.Minute)
	future := testNow.Add(time.Hour)

	scheduled := func(id string, at time.Time) editorial.Article {
		s := article(id, id, "en", editorial.StatusScheduled, nil)
		state := s.State()
		state.ScheduledAt = &at

		return editorial.Reconstitute(state)
	}

	for _, a := range []editorial.Article{scheduled("art_due", past), scheduled("art_later", future)} {
		if err := repo.Save(ctx, a); err != nil {
			t.Fatalf("save: %v", err)
		}
	}

	due, err := repo.ListDueForPublication(ctx, testNow)
	if err != nil {
		t.Fatalf("listDue: %v", err)
	}

	if len(due) != 1 || due[0].ID() != "art_due" {
		t.Errorf("got %d due articles, want only art_due", len(due))
	}
}

func TestRevisionHistoryIsAppendOnlyAndOrdered(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	repo := adapter.NewRevisionRepository(h.DB)
	ctx := context.Background()

	if err := repo.EnsureIndexes(ctx); err != nil {
		t.Fatalf("ensureIndexes: %v", err)
	}

	articleID := shared.ArticleID("art_1")
	var previous *editorial.Revision

	for seq := 1; seq <= 3; seq++ {
		rev := editorial.NewRevision(
			shared.RevisionID("rev_"+string(rune('0'+seq))),
			articleID, previous, "Title", "Body "+string(rune('0'+seq)),
			shared.UserID("usr_author"), testNow,
		)
		if err := repo.Append(ctx, rev); err != nil {
			t.Fatalf("append: %v", err)
		}
		copied := rev
		previous = &copied
	}

	history, err := repo.ListFor(ctx, articleID)
	if err != nil {
		t.Fatalf("listFor: %v", err)
	}
	if len(history) != 3 || history[0].Seq() != 1 || history[2].Seq() != 3 {
		t.Errorf("history = %d revisions, oldest first expected", len(history))
	}

	latest, err := repo.FindLatest(ctx, articleID)
	if err != nil {
		t.Fatalf("findLatest: %v", err)
	}
	if latest.Seq() != 3 {
		t.Errorf("latest seq = %d, want 3", latest.Seq())
	}
}

func TestConcurrentDoubleAppendIsRefusedNotLost(t *testing.T) {
	t.Parallel()

	// The unique (articleId, seq) index is not an optimisation — it is what
	// makes history monotonic. Without it two concurrent saves compute the same
	// next seq and one silently disappears.
	h := newHarness(t)
	repo := adapter.NewRevisionRepository(h.DB)
	ctx := context.Background()

	if err := repo.EnsureIndexes(ctx); err != nil {
		t.Fatalf("ensureIndexes: %v", err)
	}

	articleID := shared.ArticleID("art_1")
	first := editorial.NewRevision(
		shared.RevisionID("rev_1"), articleID, nil, "T", "B", shared.UserID("usr_1"), testNow,
	)
	if err := repo.Append(ctx, first); err != nil {
		t.Fatalf("append: %v", err)
	}

	// A second writer that also believed seq 1 was next.
	clash := editorial.NewRevision(
		shared.RevisionID("rev_2"), articleID, nil, "T", "Different", shared.UserID("usr_2"), testNow,
	)
	if err := repo.Append(ctx, clash); err == nil {
		t.Fatal("a colliding seq was accepted — history can be silently lost")
	}

	history, err := repo.ListFor(ctx, articleID)
	if err != nil {
		t.Fatalf("listFor: %v", err)
	}
	if len(history) != 1 || history[0].Body() != "B" {
		t.Errorf("history = %+v, want only the first revision", history)
	}
}

func TestFindLatestForArticlesReturnsNewestPerArticle(t *testing.T) {
	t.Parallel()

	// $group's $first is defined by the incoming order, so the descending sort
	// is what makes this mean "newest". Without it the aggregation quietly
	// returns arbitrary revisions — which no unit test would catch.
	h := newHarness(t)
	repo := adapter.NewRevisionRepository(h.DB)
	ctx := context.Background()

	for _, spec := range []struct {
		article string
		seq     int
		body    string
	}{
		{"art_1", 1, "one-old"}, {"art_1", 2, "one-new"},
		{"art_2", 1, "two-old"}, {"art_2", 3, "two-new"},
	} {
		rev := editorial.ReconstituteRevision(editorial.RevisionState{
			ID:        shared.RevisionID(spec.body),
			ArticleID: shared.ArticleID(spec.article),
			Seq:       spec.seq,
			Body:      spec.body,
			CreatedAt: testNow,
		})
		if err := repo.Append(ctx, rev); err != nil {
			t.Fatalf("append: %v", err)
		}
	}

	latest, err := repo.FindLatestForArticles(ctx, []shared.ArticleID{"art_1", "art_2"})
	if err != nil {
		t.Fatalf("findLatestForArticles: %v", err)
	}
	if len(latest) != 2 {
		t.Fatalf("got %d revisions, want 2", len(latest))
	}

	bodies := map[string]bool{}
	for _, r := range latest {
		bodies[r.Body()] = true
	}
	if !bodies["one-new"] || !bodies["two-new"] {
		t.Errorf("got %v, want the newest of each article", bodies)
	}
}

func TestEmptyIDListsDoNotQuery(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	ctx := context.Background()

	articles := adapter.NewArticleRepository(h.DB, fixedClock{at: testNow})
	revisions := adapter.NewRevisionRepository(h.DB)

	gotArticles, err := articles.FindManyByIDs(ctx, nil)
	if err != nil || len(gotArticles) != 0 {
		t.Errorf("articles = %v, err = %v", gotArticles, err)
	}

	gotRevisions, err := revisions.FindManyByIDs(ctx, nil)
	if err != nil || len(gotRevisions) != 0 {
		t.Errorf("revisions = %v, err = %v", gotRevisions, err)
	}

	gotLatest, err := revisions.FindLatestForArticles(ctx, nil)
	if err != nil || len(gotLatest) != 0 {
		t.Errorf("latest = %v, err = %v", gotLatest, err)
	}
}

func TestCategoryPerLocaleReachability(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	repo := adapter.NewCategoryRepository(h.DB)
	ctx := context.Background()

	// cat_education has no French slug on purpose: a section rolled out in one
	// language before another must simply not be reachable in the other.
	business := editorial.ReconstituteCategory(editorial.CategoryState{
		ID:           shared.CategoryID("cat_business"),
		Slugs:        map[string]string{"en": "business", "fr": "economie"},
		Names:        map[string]string{"en": "Business", "fr": "Économie"},
		Descriptions: map[string]string{"en": "Markets and trade."},
		Order:        1,
	})
	education := editorial.ReconstituteCategory(editorial.CategoryState{
		ID:    shared.CategoryID("cat_education"),
		Slugs: map[string]string{"en": "education"},
		Names: map[string]string{"en": "Education"},
		Order: 2,
	})

	for _, c := range []editorial.Category{business, education} {
		if err := repo.Save(ctx, c); err != nil {
			t.Fatalf("save: %v", err)
		}
	}

	// The dotted-path probe must respect the locale.
	got, err := repo.FindBySlug(ctx, "economie", "fr")
	if err != nil {
		t.Fatalf("findBySlug: %v", err)
	}
	if got.ID() != "cat_business" {
		t.Errorf("got %s", got.ID())
	}
	if desc, ok := got.DescriptionIn("en"); !ok || desc != "Markets and trade." {
		t.Errorf("description round trip failed: %q (ok=%v)", desc, ok)
	}
	// Descriptions do not fall back — a French reader gets none here.
	if _, ok := got.DescriptionIn("fr"); ok {
		t.Error("a French description was invented")
	}

	// The English slug must not resolve under fr.
	if _, err := repo.FindBySlug(ctx, "business", "fr"); !errors.Is(err, ports.ErrNotFound) {
		t.Errorf("got %v, want ErrNotFound", err)
	}

	en, err := repo.ListForLocale(ctx, "en")
	if err != nil {
		t.Fatalf("listForLocale(en): %v", err)
	}
	fr, err := repo.ListForLocale(ctx, "fr")
	if err != nil {
		t.Fatalf("listForLocale(fr): %v", err)
	}

	if len(en) != 2 {
		t.Errorf("en nav = %d sections, want 2", len(en))
	}
	if len(fr) != 1 || fr[0].ID() != "cat_business" {
		t.Errorf("fr nav = %d sections, want only business", len(fr))
	}
	if en[0].ID() != "cat_business" {
		t.Errorf("nav is not in editorial order: %s first", en[0].ID())
	}
}

func TestRolesAreKeyedByHexStringAndFilteredOnRead(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	repo := adapter.NewRoleRepository(h.DB)
	ctx := context.Background()

	// A hex user id, as Better Auth's API reports it. Storing an ObjectId here
	// instead is what silently emptied every role lookup once before.
	userID := shared.UserID("6a777a87b5ce27ca18b5266a")

	empty, err := repo.RolesFor(ctx, userID)
	if err != nil {
		t.Fatalf("rolesFor: %v", err)
	}
	if len(empty) != 0 {
		t.Errorf("an ungranted user has %d roles, want 0", len(empty))
	}

	if err := repo.Replace(ctx, userID, []identity.Role{identity.RoleEditor}); err != nil {
		t.Fatalf("replace: %v", err)
	}

	granted, err := repo.RolesFor(ctx, userID)
	if err != nil {
		t.Fatalf("rolesFor: %v", err)
	}
	if len(granted) != 1 || granted[0] != identity.RoleEditor {
		t.Errorf("roles = %v, want [editor]", granted)
	}

	// Storage is not a trust boundary: a role the codebase no longer defines
	// must not come back as a live grant.
	if _, err := h.DB.Collection(adapter.CollRoleAssignments).UpdateOne(
		ctx,
		bson.M{"_id": userID.String()},
		bson.M{"$set": bson.M{"roles": []string{"editor", "chief_wizard"}}},
	); err != nil {
		t.Fatalf("seeding unknown role: %v", err)
	}

	filtered, err := repo.RolesFor(ctx, userID)
	if err != nil {
		t.Fatalf("rolesFor: %v", err)
	}
	if len(filtered) != 1 || filtered[0] != identity.RoleEditor {
		t.Errorf("roles = %v — an unknown role survived the read", filtered)
	}

	// Revoking everything removes the row rather than leaving an empty one.
	if err := repo.Replace(ctx, userID, nil); err != nil {
		t.Fatalf("replace(nil): %v", err)
	}

	n, err := h.DB.Collection(adapter.CollRoleAssignments).CountDocuments(ctx, bson.M{"_id": userID.String()})
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Error("revoking every role left an empty document behind")
	}
}
