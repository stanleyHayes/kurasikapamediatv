package mongo_test

import (
	"context"
	"testing"
	"time"

	adapter "github.com/kurasikapa/api/internal/adapter/mongo"
	"github.com/kurasikapa/api/internal/domain/media"
)

func TestRecordingImportRepositoryRoundTripQueriesAndIndexes(t *testing.T) {
	t.Parallel()
	h := newHarness(t)
	repo := adapter.NewRecordingImportRepository(h.DB)
	ctx := context.Background()
	if err := repo.EnsureIndexes(ctx); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 31, 23, 0, 0, 0, time.UTC)
	row := media.ReconstituteRecordingImport(media.RecordingImportState{
		ID: "import_1", AssetID: "asset_1", SourceRef: "session_1", Bucket: "bucket",
		Prefix: "ivs/v1/session_1", ChannelName: "Evening News", Locale: "en",
		ProviderTaskID: "task_1", OutputRef: "processed/import_1.mp4", DurationSeconds: 60,
		Status: media.RecordingImportProcessing, RequestedBy: "system:ivs", CreatedAt: now, UpdatedAt: now,
	})
	if err := repo.Save(ctx, row); err != nil {
		t.Fatal(err)
	}
	byID, err := repo.FindByID(ctx, row.ID())
	if err != nil || byID.State().OutputRef != "processed/import_1.mp4" {
		t.Fatalf("by id: %#v %v", byID.State(), err)
	}
	bySource, err := repo.FindBySourceRef(ctx, "session_1")
	if err != nil || bySource.ID() != row.ID() {
		t.Fatalf("by source: %#v %v", bySource.State(), err)
	}
	processing, err := repo.ListProcessing(ctx, 10)
	if err != nil || len(processing) != 1 {
		t.Fatalf("processing: %d %v", len(processing), err)
	}
	names := indexNames(t, h, adapter.CollRecordingImports)
	for _, name := range []string{"recording_source_unique", "processing_recordings"} {
		if !names[name] {
			t.Errorf("missing %s", name)
		}
	}
}
