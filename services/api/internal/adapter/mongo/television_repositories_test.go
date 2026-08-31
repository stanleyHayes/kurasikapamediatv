package mongo_test

import (
	"context"
	"testing"
	"time"

	adapter "github.com/kurasikapa/api/internal/adapter/mongo"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestTelevisionRepositoriesRoundTripAndFilterPublicGuide(t *testing.T) {
	t.Parallel()
	h := newHarness(t)
	store := adapter.NewTelevisionRepositories(h.DB)
	presenters := adapter.NewPresenterRepository(store)
	programmes := adapter.NewProgrammeRepository(store)
	schedule := adapter.NewScheduleRepository(store)
	ctx := context.Background()
	if err := store.EnsureIndexes(ctx); err != nil {
		t.Fatal(err)
	}

	presenter := domainmedia.ReconstitutePresenter(domainmedia.PresenterState{ID: "presenter", Name: "Ama", Slug: "ama", Locale: "en", Published: true, CreatedBy: "manager"})
	if err := presenters.Save(ctx, presenter); err != nil {
		t.Fatal(err)
	}
	if got, err := presenters.FindByID(ctx, presenter.ID()); err != nil || got.State().Name != "Ama" {
		t.Fatalf("%+v %v", got.State(), err)
	}
	if listed, err := presenters.ListPublished(ctx, "en"); err != nil || len(listed) != 1 {
		t.Fatalf("%d %v", len(listed), err)
	}

	programme := domainmedia.ReconstituteProgramme(domainmedia.ProgrammeState{ID: "programme", Title: "Morning Desk", Slug: "morning", Locale: "en", PresenterIDs: []shared.PresenterID{presenter.ID()}, Published: true, CreatedBy: "manager"})
	if err := programmes.Save(ctx, programme); err != nil {
		t.Fatal(err)
	}
	if got, err := programmes.FindByID(ctx, programme.ID()); err != nil || got.State().Title != "Morning Desk" {
		t.Fatalf("%+v %v", got.State(), err)
	}
	if listed, err := programmes.ListPublished(ctx, "en"); err != nil || len(listed) != 1 {
		t.Fatalf("%d %v", len(listed), err)
	}

	upcoming := domainmedia.ReconstituteScheduleSlot(domainmedia.ScheduleSlotState{ID: "upcoming", ProgrammeID: programme.ID(), Locale: "en", StartsAt: testNow.Add(time.Hour), EndsAt: testNow.Add(2 * time.Hour), State: domainmedia.ScheduleScheduled, CreatedBy: "manager"})
	caption, replay := shared.AssetID("caption"), shared.AssetID("replay")
	completed := domainmedia.ReconstituteScheduleSlot(domainmedia.ScheduleSlotState{ID: "replay", ProgrammeID: programme.ID(), Locale: "en", StartsAt: testNow.Add(-2 * time.Hour), EndsAt: testNow.Add(-time.Hour), State: domainmedia.ScheduleCompleted, ReplayAssetID: &replay, CaptionAssetID: &caption, CreatedBy: "manager"})
	if err := schedule.Save(ctx, upcoming); err != nil {
		t.Fatal(err)
	}
	if err := schedule.Save(ctx, completed); err != nil {
		t.Fatal(err)
	}
	if rows, err := schedule.ListUpcoming(ctx, "en", testNow, 20); err != nil || len(rows) != 1 {
		t.Fatalf("upcoming %d %v", len(rows), err)
	}
	if rows, err := schedule.ListReplays(ctx, "en", 12); err != nil || len(rows) != 1 {
		t.Fatalf("replays %d %v", len(rows), err)
	}

	for collection, names := range map[string][]string{
		adapter.CollPresenters:    {"locale_slug_unique", "public_directory"},
		adapter.CollProgrammes:    {"locale_slug_unique", "public_directory"},
		adapter.CollScheduleSlots: {"upcoming_schedule", "replay_schedule"},
	} {
		got := indexNames(t, h, collection)
		for _, name := range names {
			if !got[name] {
				t.Errorf("%s missing %s", collection, name)
			}
		}
	}
}
