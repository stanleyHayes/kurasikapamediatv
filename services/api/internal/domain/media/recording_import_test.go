package media_test

import (
	"errors"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var recordingNow = time.Date(2026, 8, 31, 23, 0, 0, 0, time.UTC)

func recordingManager() identity.Actor {
	return identity.NewActor("system:ivs", []identity.Role{identity.RoleSuperAdmin})
}

func recordingState() media.RecordingImportState {
	return media.RecordingImportState{
		ID: "import_1", AssetID: "asset_1", SourceRef: "session_1",
		Bucket: "private-recordings", Prefix: "ivs/v1/session_1",
		ChannelName: "en: Evening News", Locale: "en", DurationSeconds: 3600,
	}
}

func TestRecordingImportLifecycle(t *testing.T) {
	job, err := media.NewRecordingImport(recordingManager(), recordingState(), recordingNow)
	if err != nil || job.State().Status != media.RecordingImportRequested || job.State().RequestedBy != shared.UserID("system:ivs") {
		t.Fatalf("new import: %#v %v", job.State(), err)
	}
	job, err = job.Start(recordingManager(), "mediaconvert_1", "processed/import_1.mp4", recordingNow.Add(time.Minute))
	if err != nil || job.State().Status != media.RecordingImportProcessing || job.State().OutputRef == "" {
		t.Fatalf("start: %#v %v", job.State(), err)
	}
	job, err = job.Complete(recordingManager(), recordingNow.Add(2*time.Minute))
	if err != nil || job.State().Status != media.RecordingImportReady {
		t.Fatalf("complete: %#v %v", job.State(), err)
	}
}

func TestRecordingImportGuards(t *testing.T) {
	invalid := recordingState()
	invalid.SourceRef = ""
	if _, err := media.NewRecordingImport(recordingManager(), invalid, recordingNow); !errors.Is(err, media.ErrInvalidRecordingImport) {
		t.Fatalf("invalid source: %v", err)
	}
	reader := identity.NewActor("reader", []identity.Role{identity.RoleGuest})
	if _, err := media.NewRecordingImport(reader, recordingState(), recordingNow); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatalf("reader created import: %v", err)
	}
	job, _ := media.NewRecordingImport(recordingManager(), recordingState(), recordingNow)
	if _, err := job.Start(recordingManager(), "", "output", recordingNow); !errors.Is(err, media.ErrRecordingImportTransition) {
		t.Fatalf("empty task accepted: %v", err)
	}
	if _, err := job.Complete(recordingManager(), recordingNow); !errors.Is(err, media.ErrRecordingImportTransition) {
		t.Fatalf("completed before processing: %v", err)
	}
	failed, err := job.Fail(recordingManager(), "transcode failed", recordingNow)
	if err != nil || failed.State().FailureReason != "transcode failed" {
		t.Fatalf("failed import: %#v %v", failed.State(), err)
	}
	if _, err = failed.Fail(recordingManager(), "again", recordingNow); !errors.Is(err, media.ErrRecordingImportTransition) {
		t.Fatalf("failed twice: %v", err)
	}
}

func TestRecordingImportReconstitutionAndTransitionPermissions(t *testing.T) {
	state := recordingState()
	state.Status = media.RecordingImportProcessing
	state.ProviderTaskID = "mediaconvert_1"
	job := media.ReconstituteRecordingImport(state)
	if job.ID() != state.ID || job.State().ProviderTaskID != state.ProviderTaskID {
		t.Fatalf("reconstituted import lost state: %#v", job.State())
	}

	reader := identity.NewActor("reader", []identity.Role{identity.RoleGuest})
	if _, err := job.Complete(reader, recordingNow); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatalf("reader completed import: %v", err)
	}
	if _, err := job.Fail(reader, "failed", recordingNow); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatalf("reader failed import: %v", err)
	}
	requested, _ := media.NewRecordingImport(recordingManager(), recordingState(), recordingNow)
	if _, err := requested.Start(reader, "task", "output", recordingNow); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatalf("reader started import: %v", err)
	}
	if _, err := requested.Fail(recordingManager(), "   ", recordingNow); !errors.Is(err, media.ErrRecordingImportTransition) {
		t.Fatalf("blank failure reason accepted: %v", err)
	}
}
