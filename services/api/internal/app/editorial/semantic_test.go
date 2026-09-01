package editorial_test

import (
	"context"
	"errors"
	"testing"

	app "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/app/ports"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestProcessSemanticIndexEmbedsPendingApprovedText(t *testing.T) {
	record := ports.SemanticRecord{ArticleID: "art_1", RevisionID: "rev_1", Locale: "en", Text: "Budget reporting", Active: true}
	store := faketesting.NewSemanticStore(record)
	embedder := &faketesting.EmbeddingFake{Vector: []float32{0.1, 0.2}}

	result, err := app.NewProcessSemanticIndex(store, embedder, "voyage-4").Execute(context.Background(), 10)
	if err != nil {
		t.Fatal(err)
	}
	if result.Indexed != 1 || len(store.Records["art_1"].Embedding) != 2 {
		t.Fatalf("result=%+v record=%+v", result, store.Records["art_1"])
	}
	if embedder.Kinds[0] != ports.EmbeddingDocument {
		t.Fatalf("kind=%s", embedder.Kinds[0])
	}
}

func TestProcessSemanticIndexRecordsFailuresForRetry(t *testing.T) {
	record := ports.SemanticRecord{ArticleID: "art_1", RevisionID: "rev_1", Text: "Story", Active: true}
	store := faketesting.NewSemanticStore(record)
	embedder := &faketesting.EmbeddingFake{Err: errors.New("provider unavailable")}

	result, err := app.NewProcessSemanticIndex(store, embedder, "voyage-4").Execute(context.Background(), 10)
	if err != nil {
		t.Fatal(err)
	}
	if result.Failed != 1 || store.Records["art_1"].Attempts != 1 {
		t.Fatalf("result=%+v", result)
	}
}

func TestProcessSemanticIndexReturnsRepositoryFailures(t *testing.T) {
	want := errors.New("semantic storage unavailable")
	store := faketesting.NewSemanticStore()
	store.ListErr = want

	if _, err := app.NewProcessSemanticIndex(store, &faketesting.EmbeddingFake{}, "voyage-4").Execute(context.Background(), 0); !errors.Is(err, want) {
		t.Fatalf("err=%v", err)
	}

	record := ports.SemanticRecord{ArticleID: "art_1", RevisionID: "rev_1", Text: "Story", Active: true}
	for name, configure := range map[string]func(*faketesting.SemanticStore, *faketesting.EmbeddingFake){
		"ready": func(s *faketesting.SemanticStore, _ *faketesting.EmbeddingFake) { s.MarkReadyErr = want },
		"failed": func(s *faketesting.SemanticStore, e *faketesting.EmbeddingFake) {
			e.Err, s.MarkFailedErr = want, want
		},
	} {
		t.Run(name, func(t *testing.T) {
			store := faketesting.NewSemanticStore(record)
			embedder := &faketesting.EmbeddingFake{Vector: []float32{.1}}
			configure(store, embedder)
			if _, err := app.NewProcessSemanticIndex(store, embedder, "voyage-4").Execute(context.Background(), 1); !errors.Is(err, want) {
				t.Fatalf("err=%v", err)
			}
		})
	}
}

func TestSemanticSearchHandlesEmptyAndProviderFailures(t *testing.T) {
	h := newHarness()
	search := app.NewSemanticSearch(h.deps, &faketesting.EmbeddingFake{}, h.semantic)
	got, err := search.Execute(context.Background(), app.SemanticSearchInput{Terms: " ", Locale: "en"})
	if err != nil || len(got) != 0 {
		t.Fatalf("got=%+v err=%v", got, err)
	}

	want := errors.New("embedding unavailable")
	search = app.NewSemanticSearch(h.deps, &faketesting.EmbeddingFake{Err: want}, h.semantic)
	if _, err := search.Execute(context.Background(), app.SemanticSearchInput{Terms: "economy", Locale: "en"}); !errors.Is(err, want) {
		t.Fatalf("err=%v", err)
	}

	h.semantic.SimilarErr = want
	search = app.NewSemanticSearch(h.deps, &faketesting.EmbeddingFake{Vector: []float32{.1}}, h.semantic)
	if _, err := search.Execute(context.Background(), app.SemanticSearchInput{Terms: "economy", Locale: "en"}); !errors.Is(err, want) {
		t.Fatalf("err=%v", err)
	}
}

func TestSemanticSearchReturnsSourceRepositoryFailures(t *testing.T) {
	live := publishedArt("art_live", "live", "cat_news")
	want := errors.New("source unavailable")
	for name, fail := range map[string]func(*harness){
		"articles":  func(h *harness) { h.articles.FailFindMany = want },
		"revisions": func(h *harness) { h.revisions.FailFindMany = want },
	} {
		t.Run(name, func(t *testing.T) {
			h := newHarness(live)
			h.semantic.Hits = []ports.SemanticHit{{ArticleID: live.ID(), Score: .9}}
			fail(&h)
			search := app.NewSemanticSearch(h.deps, &faketesting.EmbeddingFake{Vector: []float32{.1}}, h.semantic)
			if _, err := search.Execute(context.Background(), app.SemanticSearchInput{Terms: "economy", Locale: "en"}); !errors.Is(err, want) {
				t.Fatalf("err=%v", err)
			}
		})
	}
}

func TestSemanticRelatedRejectsUnpublishedAndMissingVectors(t *testing.T) {
	draft := draftArticle("art_draft")
	h := newHarness(draft)
	got, err := app.NewSemanticRelated(h.deps, h.semantic).Execute(context.Background(), draft.ID(), 4)
	if err != nil || len(got) != 0 {
		t.Fatalf("got=%+v err=%v", got, err)
	}

	live := publishedArt("art_live", "live", "cat_news")
	h = newHarness(live)
	if _, err := app.NewSemanticRelated(h.deps, h.semantic).Execute(context.Background(), live.ID(), 4); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("err=%v", err)
	}
}

func TestSemanticSearchRevalidatesPublishedVisibilityAndOrder(t *testing.T) {
	live := publishedArt("art_live", "live-story", "cat_news")
	draft := draftArticle("art_draft")
	h := newHarness(live, draft)
	h.semantic.Hits = []ports.SemanticHit{{ArticleID: draft.ID(), Score: .99}, {ArticleID: live.ID(), Score: .91}}
	embedder := &faketesting.EmbeddingFake{Vector: []float32{0.1}}

	got, err := app.NewSemanticSearch(h.deps, embedder, h.semantic).Execute(context.Background(), app.SemanticSearchInput{Terms: "economy", Locale: "en", Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Article.ID != live.ID().String() {
		t.Fatalf("hits=%+v", got)
	}
	if embedder.Kinds[0] != ports.EmbeddingQuery {
		t.Fatalf("kind=%s", embedder.Kinds[0])
	}
}

func TestSemanticRelatedUsesStoredVectorAndFiltersStaleHits(t *testing.T) {
	source := publishedArt("art_source", "source", "cat_news")
	related := publishedArt("art_related", "related", "cat_business")
	unpublished := editorial.Reconstitute(editorial.ArticleState{
		ID: "art_hidden", Locale: "en", Slug: shared.SlugFrom("hidden"), Title: "Hidden",
		AuthorID: "usr_author", Status: editorial.StatusUnpublished,
	})
	h := newHarness(source, related, unpublished)
	h.semantic.Records[source.ID()] = ports.SemanticRecord{ArticleID: source.ID(), Active: true, Embedding: []float32{0.3}}
	h.semantic.Hits = []ports.SemanticHit{{ArticleID: unpublished.ID(), Score: .95}, {ArticleID: related.ID(), Score: .9}}

	got, err := app.NewSemanticRelated(h.deps, h.semantic).Execute(context.Background(), source.ID(), 4)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Article.ID != related.ID().String() {
		t.Fatalf("related=%+v", got)
	}
}
