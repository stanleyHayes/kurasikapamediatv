package media_test

import (
	"context"
	"errors"
	"testing"

	appmedia "github.com/kurasikapa/api/internal/app/media"
	"github.com/kurasikapa/api/internal/app/ports"
	fakes "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
)

func recordingDeps() (appmedia.Deps, *fakes.AssetStore) {
	assets := fakes.NewAssetStore()
	return appmedia.Deps{Assets: assets, Clock: fakes.FixedClock{At: now}, IDs: &fakes.SequentialIDs{}}, assets
}

func recordingSource() ports.RecordingSource {
	return ports.RecordingSource{
		SourceRef: "recording_session_1", Bucket: "private-recordings",
		Prefix: "ivs/v1/recording_session_1", ChannelName: "Evening News",
		Locale: "en", DurationSeconds: 3600,
	}
}

func TestReceiveRecordingIsIdempotentAndStartsAfterSaving(t *testing.T) {
	d, _ := recordingDeps()
	imports := fakes.NewRecordingImportStore()
	provider := &fakes.RecordingPromotionFake{StartResult: ports.RecordingTranscode{TaskID: "job_1", OutputRef: "processed/id_1.mp4"}}
	useCase := appmedia.NewReceiveRecording(d, imports, provider)

	job, err := useCase.Execute(context.Background(), actor(), recordingSource())
	if err != nil || job.State().Status != domainmedia.RecordingImportProcessing || job.State().AssetID != "id_2" || provider.Starts != 1 {
		t.Fatalf("received: %#v starts=%d err=%v", job.State(), provider.Starts, err)
	}
	again, err := useCase.Execute(context.Background(), actor(), recordingSource())
	if err != nil || again.ID() != job.ID() || provider.Starts != 1 {
		t.Fatalf("duplicate: %#v starts=%d err=%v", again.State(), provider.Starts, err)
	}
}

func TestReceiveRecordingRetriesARequestedStart(t *testing.T) {
	d, _ := recordingDeps()
	imports := fakes.NewRecordingImportStore()
	provider := &fakes.RecordingPromotionFake{StartErr: errors.New("mediaconvert down")}
	useCase := appmedia.NewReceiveRecording(d, imports, provider)

	if _, err := useCase.Execute(context.Background(), actor(), recordingSource()); err == nil {
		t.Fatal("expected start failure")
	}
	provider.StartErr = nil
	provider.StartResult = ports.RecordingTranscode{TaskID: "job_1", OutputRef: "processed/id_1.mp4"}
	job, err := useCase.Execute(context.Background(), actor(), recordingSource())
	if err != nil || job.State().Status != domainmedia.RecordingImportProcessing || provider.Starts != 2 {
		t.Fatalf("retry: %#v starts=%d err=%v", job.State(), provider.Starts, err)
	}
}

func TestProcessRecordingCreatesReadyVideoAndResumesAfterAssetSave(t *testing.T) {
	d, assets := recordingDeps()
	job, _ := domainmedia.NewRecordingImport(actor(), domainmedia.RecordingImportState{
		ID: "import_1", AssetID: "asset_1", SourceRef: "session_1", Bucket: "bucket",
		Prefix: "ivs/v1/session_1", ChannelName: "Evening News", Locale: "en", DurationSeconds: 120,
	}, now)
	job, _ = job.Start(actor(), "task_1", "processed/import_1.mp4", now)
	imports := fakes.NewRecordingImportStore(job)
	provider := &fakes.RecordingPromotionFake{CheckResult: ports.RecordingProviderResult{
		Status:   ports.RecordingProviderReady,
		Delivery: domainmedia.AssetDelivery{ProviderID: "kurasikapa/recordings/import_1", SecureURL: "https://res.cloudinary.test/import_1.mp4", Bytes: 4096, DurationSeconds: 120},
	}}
	result, err := appmedia.NewProcessRecordings(d, imports, provider).Execute(context.Background(), actor())
	if err != nil || result.Ready != 1 || imports.Rows[job.ID()].State().Status != domainmedia.RecordingImportReady || assets.Items["asset_1"].State().Status != domainmedia.AssetReady {
		t.Fatalf("process: %+v %#v err=%v", result, imports.Rows[job.ID()].State(), err)
	}

	processing, _ := domainmedia.NewRecordingImport(actor(), domainmedia.RecordingImportState{
		ID: "import_2", AssetID: "asset_2", SourceRef: "session_2", Bucket: "bucket",
		Prefix: "ivs/v1/session_2", ChannelName: "Morning News", Locale: "en", DurationSeconds: 60,
	}, now)
	processing, _ = processing.Start(actor(), "task_2", "processed/import_2.mp4", now)
	ready, _ := domainmedia.NewAsset(actor(), domainmedia.AssetState{ID: "asset_2", Kind: domainmedia.AssetVideo, Filename: "Morning News.mp4", MIMEType: "video/mp4", Locale: "en"})
	ready, _ = ready.MarkReady(actor(), domainmedia.AssetDelivery{ProviderID: "existing", SecureURL: "https://res.cloudinary.test/existing.mp4", Bytes: 10})
	assets.Items["asset_2"] = ready
	imports = fakes.NewRecordingImportStore(processing)
	result, err = appmedia.NewProcessRecordings(d, imports, provider).Execute(context.Background(), actor())
	if err != nil || result.Ready != 1 || imports.Rows[processing.ID()].State().Status != domainmedia.RecordingImportReady {
		t.Fatalf("resume: %+v err=%v", result, err)
	}
}

func TestProcessRecordingCoversProviderAndPermissionFailures(t *testing.T) {
	d, _ := recordingDeps()
	job, _ := domainmedia.NewRecordingImport(actor(), domainmedia.RecordingImportState{ID: "import", AssetID: "asset", SourceRef: "source", Bucket: "bucket", Prefix: "prefix", ChannelName: "News", Locale: "fr", DurationSeconds: 30}, now)
	job, _ = job.Start(actor(), "task", "output", now)
	imports := fakes.NewRecordingImportStore(job)
	provider := &fakes.RecordingPromotionFake{CheckResult: ports.RecordingProviderResult{Status: ports.RecordingProviderProcessing}}
	useCase := appmedia.NewProcessRecordings(d, imports, provider)
	result, err := useCase.Execute(context.Background(), actor())
	if err != nil || result.Processing != 1 {
		t.Fatalf("processing: %+v %v", result, err)
	}
	provider.CheckResult = ports.RecordingProviderResult{Status: ports.RecordingProviderFailed, FailureReason: "bad input"}
	result, err = useCase.Execute(context.Background(), actor())
	if err != nil || len(result.Failed) != 1 || imports.Rows[job.ID()].State().Status != domainmedia.RecordingImportFailed {
		t.Fatalf("failed: %+v %v", result, err)
	}
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err = appmedia.NewReceiveRecording(d, imports, provider).Execute(context.Background(), guest, recordingSource()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatalf("guest received recording: %v", err)
	}
	if _, err = useCase.Execute(context.Background(), guest); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatalf("guest processed recordings: %v", err)
	}
}

func TestRecordingImportPropagatesStorageAndProviderErrors(t *testing.T) {
	d, assets := recordingDeps()
	down := errors.New("storage down")
	imports := fakes.NewRecordingImportStore()
	imports.FindErr = down
	provider := &fakes.RecordingPromotionFake{}
	if _, err := appmedia.NewReceiveRecording(d, imports, provider).Execute(context.Background(), actor(), recordingSource()); !errors.Is(err, down) {
		t.Fatalf("find error: %v", err)
	}
	imports.FindErr, imports.SaveErr = nil, down
	if _, err := appmedia.NewReceiveRecording(d, imports, provider).Execute(context.Background(), actor(), recordingSource()); !errors.Is(err, down) || provider.Starts != 0 {
		t.Fatalf("save before start: starts=%d err=%v", provider.Starts, err)
	}

	imports = fakes.NewRecordingImportStore()
	provider.StartResult = ports.RecordingTranscode{}
	if _, err := appmedia.NewReceiveRecording(d, imports, provider).Execute(context.Background(), actor(), recordingSource()); !errors.Is(err, domainmedia.ErrRecordingImportTransition) {
		t.Fatalf("empty provider task: %v", err)
	}

	job, _ := domainmedia.NewRecordingImport(actor(), domainmedia.RecordingImportState{ID: "import", AssetID: "asset", SourceRef: "source", Bucket: "bucket", Prefix: "prefix", ChannelName: "News", Locale: "en", DurationSeconds: 30}, now)
	job, _ = job.Start(actor(), "task", "output", now)
	imports = fakes.NewRecordingImportStore(job)
	imports.ListErr = down
	if _, err := appmedia.NewProcessRecordings(d, imports, provider).Execute(context.Background(), actor()); !errors.Is(err, down) {
		t.Fatalf("list error: %v", err)
	}
	imports.ListErr = nil
	provider.CheckErr = down
	result, err := appmedia.NewProcessRecordings(d, imports, provider).Execute(context.Background(), actor())
	if err != nil || len(result.Failed) != 1 {
		t.Fatalf("check error: %+v %v", result, err)
	}
	provider.CheckErr = nil
	provider.CheckResult = ports.RecordingProviderResult{Status: "unexpected"}
	result, _ = appmedia.NewProcessRecordings(d, imports, provider).Execute(context.Background(), actor())
	if len(result.Failed) != 1 {
		t.Fatalf("unknown status: %+v", result)
	}
	provider.CheckResult = ports.RecordingProviderResult{Status: ports.RecordingProviderReady, Delivery: domainmedia.AssetDelivery{ProviderID: "id", SecureURL: "https://cdn.test/video.mp4", Bytes: 10}}
	assets.Err = down
	result, _ = appmedia.NewProcessRecordings(d, imports, provider).Execute(context.Background(), actor())
	if len(result.Failed) != 1 {
		t.Fatalf("asset error: %+v", result)
	}
}
