package media_test

import (
	"errors"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var narrationNow = time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)

func narrationEditor() identity.Actor {
	return identity.NewActor("editor", []identity.Role{identity.RoleEditor})
}

func narrationReader() identity.Actor {
	return identity.NewActor("reader", []identity.Role{identity.RoleSubscriber})
}

func narrationState() media.NarrationJobState {
	return media.NarrationJobState{
		ID: "job_1", ArticleID: "article_1", RevisionID: "revision_1",
		Locale: "en", Voice: "Amy",
	}
}

func TestNarrationJobLifecycle(t *testing.T) {
	t.Parallel()

	job, err := media.NewNarrationJob(narrationEditor(), narrationState(), narrationNow)
	if err != nil {
		t.Fatal(err)
	}
	if job.State().Status != media.NarrationRequested {
		t.Fatalf("status = %s", job.State().Status)
	}

	job, err = job.Start(narrationEditor(), "polly-task-1", narrationNow)
	if err != nil {
		t.Fatal(err)
	}
	assetID := shared.AssetID("audio_1")
	job, err = job.Complete(narrationEditor(), assetID, narrationNow)
	if err != nil {
		t.Fatal(err)
	}
	if state := job.State(); state.Status != media.NarrationReady || state.AssetID == nil || *state.AssetID != assetID {
		t.Fatalf("completed state = %#v", state)
	}
}

func TestNarrationJobRefusesInvalidOrOutOfOrderChanges(t *testing.T) {
	t.Parallel()

	if _, err := media.NewNarrationJob(narrationReader(), narrationState(), narrationNow); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatalf("reader error = %v, want ErrNotPermitted", err)
	}
	invalid := narrationState()
	invalid.Locale = "tw"
	if _, err := media.NewNarrationJob(narrationEditor(), invalid, narrationNow); !errors.Is(err, media.ErrUnsupportedNarrationLocale) {
		t.Fatalf("locale error = %v, want ErrUnsupportedNarrationLocale", err)
	}
	job, err := media.NewNarrationJob(narrationEditor(), narrationState(), narrationNow)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = job.Complete(narrationEditor(), "audio_1", narrationNow); !errors.Is(err, media.ErrNarrationJobTransition) {
		t.Fatalf("early completion error = %v, want ErrNarrationJobTransition", err)
	}
	failed, err := job.Fail(narrationEditor(), "provider unavailable", narrationNow)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = failed.Start(narrationEditor(), "task", narrationNow); !errors.Is(err, media.ErrNarrationJobTransition) {
		t.Fatalf("restart error = %v, want ErrNarrationJobTransition", err)
	}
}
