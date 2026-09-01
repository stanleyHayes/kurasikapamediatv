package mongo_test

import (
	"context"
	"errors"
	"testing"

	adapter "github.com/kurasikapa/api/internal/adapter/mongo"
	"github.com/kurasikapa/api/internal/app/ports"
)

func TestSemanticRepositoryIndexLifecycle(t *testing.T) {
	h := newHarness(t)
	repo := adapter.NewSemanticRepository(h.DB)
	ctx := context.Background()
	record := ports.SemanticRecord{
		ArticleID: "art_1", RevisionID: "rev_1", Locale: "en", Title: "Budget",
		Slug: "budget", Text: "Budget reporting", PublishedAt: testNow, Active: true,
	}
	if err := repo.Queue(ctx, record); err != nil {
		t.Fatal(err)
	}
	pending, err := repo.ListPending(ctx, 10)
	if err != nil || len(pending) != 1 {
		t.Fatalf("pending=%+v err=%v", pending, err)
	}
	if err := repo.MarkFailed(ctx, "art_1", "rev_1", "temporary"); err != nil {
		t.Fatal(err)
	}
	if err := repo.MarkReady(ctx, "art_1", "rev_1", []float32{.1, .2}, "voyage-4"); err != nil {
		t.Fatal(err)
	}
	vector, err := repo.ReadyVector(ctx, "art_1")
	if err != nil || len(vector) != 2 {
		t.Fatalf("vector=%v err=%v", vector, err)
	}
	if err := repo.Deactivate(ctx, "art_1"); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.ReadyVector(ctx, "art_1"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("error=%v", err)
	}
	if err := repo.EnsureIndexes(ctx); err != nil {
		t.Fatal(err)
	}
}

func TestSemanticQueueReplacesAnOlderRevision(t *testing.T) {
	h := newHarness(t)
	repo := adapter.NewSemanticRepository(h.DB)
	ctx := context.Background()
	first := ports.SemanticRecord{ArticleID: "art_1", RevisionID: "rev_1", Text: "Old", Active: true}
	if err := repo.Queue(ctx, first); err != nil {
		t.Fatal(err)
	}
	if err := repo.MarkReady(ctx, "art_1", "rev_1", []float32{.1}, "voyage-4"); err != nil {
		t.Fatal(err)
	}
	first.RevisionID, first.Text = "rev_2", "New"
	if err := repo.Queue(ctx, first); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.ReadyVector(ctx, "art_1"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("error=%v", err)
	}
	pending, err := repo.ListPending(ctx, 10)
	if err != nil || len(pending) != 1 || pending[0].RevisionID != "rev_2" {
		t.Fatalf("pending=%+v err=%v", pending, err)
	}
}
