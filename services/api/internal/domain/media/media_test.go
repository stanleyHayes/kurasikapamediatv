package media_test

import (
	"errors"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func manager() identity.Actor {
	return identity.NewActor("manager", []identity.Role{identity.RoleVideoEditor})
}
func guest() identity.Actor { return identity.NewActor("guest", []identity.Role{identity.RoleGuest}) }

func TestPresenterLifecycle(t *testing.T) {
	input := media.PresenterState{ID: "presenter", Name: "  Ama Mensah  ", Locale: "en"}
	if _, err := media.NewPresenter(guest(), input); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	input.Name = " "
	if _, err := media.NewPresenter(manager(), input); !errors.Is(err, media.ErrEmptyPresenterName) {
		t.Fatal(err)
	}
	input.Name = " Ama Mensah "
	presenter, err := media.NewPresenter(manager(), input)
	if err != nil {
		t.Fatal(err)
	}
	if presenter.State().Name != "Ama Mensah" || presenter.State().Published {
		t.Fatal(presenter.State())
	}
	if presenter.ID() != "presenter" {
		t.Fatal(presenter.ID())
	}
	if _, err = presenter.Publish(guest()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	presenter, err = presenter.Publish(manager())
	if err != nil || !presenter.State().Published {
		t.Fatal(err)
	}
	if media.ReconstitutePresenter(presenter.State()).ID() != presenter.ID() {
		t.Fatal("reconstitution failed")
	}
}

func TestProgrammeLifecycleAndCopies(t *testing.T) {
	input := media.ProgrammeState{ID: "programme", Title: " ", PresenterIDs: []shared.PresenterID{"p"}}
	if _, err := media.NewProgramme(manager(), input); !errors.Is(err, media.ErrEmptyProgrammeTitle) {
		t.Fatal(err)
	}
	input.Title, input.PresenterIDs = "Morning Desk", nil
	if _, err := media.NewProgramme(manager(), input); !errors.Is(err, media.ErrProgrammeNeedsPresenter) {
		t.Fatal(err)
	}
	input.PresenterIDs = []shared.PresenterID{"p"}
	if _, err := media.NewProgramme(guest(), input); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	programme, err := media.NewProgramme(manager(), input)
	if err != nil {
		t.Fatal(err)
	}
	input.PresenterIDs[0] = "changed"
	if programme.State().PresenterIDs[0] != "p" || programme.ID() != "programme" {
		t.Fatal(programme.State())
	}
	if _, err = programme.Publish(guest()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	programme, err = programme.Publish(manager())
	if err != nil || !programme.State().Published {
		t.Fatal(err)
	}
	if media.ReconstituteProgramme(programme.State()).ID() != programme.ID() {
		t.Fatal("reconstitution failed")
	}
}

func TestScheduleAndAccessibleReplay(t *testing.T) {
	now := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	input := media.ScheduleSlotState{ID: "slot", ProgrammeID: "programme", StartsAt: now, EndsAt: now.Add(time.Hour)}
	if _, err := media.NewScheduleSlot(manager(), input, now); !errors.Is(err, media.ErrScheduleInPast) {
		t.Fatal(err)
	}
	input.StartsAt, input.EndsAt = now.Add(time.Hour), now.Add(30*time.Minute)
	if _, err := media.NewScheduleSlot(manager(), input, now); !errors.Is(err, media.ErrInvalidScheduleWindow) {
		t.Fatal(err)
	}
	input.EndsAt = now.Add(2 * time.Hour)
	if _, err := media.NewScheduleSlot(guest(), input, now); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	slot, err := media.NewScheduleSlot(manager(), input, now)
	if err != nil || slot.ID() != "slot" || slot.State().State != media.ScheduleScheduled {
		t.Fatal(err)
	}
	if _, err = slot.PublishReplay(manager(), "replay", nil); !errors.Is(err, media.ErrReplayNeedsCaptions) {
		t.Fatal(err)
	}
	caption := shared.AssetID("captions")
	if _, err = slot.PublishReplay(guest(), "replay", &caption); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	slot, err = slot.PublishReplay(manager(), "replay", &caption)
	if err != nil || slot.State().State != media.ScheduleCompleted {
		t.Fatal(err)
	}
	if _, err = slot.Cancel(guest()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	slot, err = slot.Cancel(manager())
	if err != nil {
		t.Fatal(err)
	}
	if _, err = slot.Cancel(manager()); !errors.Is(err, media.ErrSlotAlreadyCancelled) {
		t.Fatal(err)
	}
	if media.ReconstituteScheduleSlot(slot.State()).ID() != slot.ID() {
		t.Fatal("reconstitution failed")
	}
}
