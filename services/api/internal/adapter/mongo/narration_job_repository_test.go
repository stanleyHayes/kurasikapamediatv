package mongo_test

import (
	"context"
	"testing"
	"time"

	adapter "github.com/kurasikapa/api/internal/adapter/mongo"
	"github.com/kurasikapa/api/internal/domain/media"
)

func TestNarrationJobRepositoryRoundTripQueriesAndIndexes(t *testing.T) {
	t.Parallel()
	h := newHarness(t)
	repo := adapter.NewNarrationJobRepository(h.DB)
	ctx := context.Background()
	if err := repo.EnsureIndexes(ctx); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	job := media.ReconstituteNarrationJob(media.NarrationJobState{
		ID: "job_1", ArticleID: "article_1", RevisionID: "revision_1", Locale: "en", Voice: "Amy",
		ProviderTaskID: "polly_1", Status: media.NarrationProcessing, RequestedBy: "editor",
		CreatedAt: now, UpdatedAt: now,
	})
	if err := repo.Save(ctx, job); err != nil {
		t.Fatal(err)
	}
	got, err := repo.FindByID(ctx, job.ID())
	if err != nil || got.State().ProviderTaskID != "polly_1" {
		t.Fatalf("got = %#v error = %v", got.State(), err)
	}
	latest, err := repo.FindLatestForArticle(ctx, "article_1")
	if err != nil || latest.ID() != job.ID() {
		t.Fatalf("latest = %#v error = %v", latest.State(), err)
	}
	processing, err := repo.ListProcessing(ctx, 25)
	if err != nil || len(processing) != 1 {
		t.Fatalf("processing = %d error = %v", len(processing), err)
	}
	names := indexNames(t, h, adapter.CollNarrationJobs)
	for _, name := range []string{"article_narrations", "processing_narrations"} {
		if !names[name] {
			t.Errorf("missing %s", name)
		}
	}
}
