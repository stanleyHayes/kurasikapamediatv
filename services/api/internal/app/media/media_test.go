package media_test

import (
	"context"
	"errors"
	"testing"
	"time"

	appmedia "github.com/kurasikapa/api/internal/app/media"
	fakes "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var now = time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)

func actor() identity.Actor {
	return identity.NewActor("manager", []identity.Role{identity.RoleVideoEditor})
}
func deps() (appmedia.Deps, *fakes.PresenterStore, *fakes.ProgrammeStore, *fakes.ScheduleStore) {
	p, g, s := fakes.NewPresenterStore(), fakes.NewProgrammeStore(), fakes.NewScheduleStore()
	return appmedia.Deps{Presenters: p, Programmes: g, Schedule: s, Clock: fakes.FixedClock{At: now}, IDs: &fakes.SequentialIDs{}}, p, g, s
}

func TestTelevisionWorkflow(t *testing.T) {
	d, presenters, programmes, schedule := deps()
	presenter, err := appmedia.NewCreatePresenter(d).Execute(context.Background(), actor(), domainmedia.PresenterState{Name: "Ama", Locale: "en"})
	if err != nil || presenter.ID() != "id_1" {
		t.Fatal(err)
	}
	presenter, err = appmedia.NewPublishPresenter(d).Execute(context.Background(), actor(), presenter.ID())
	if err != nil || !presenter.State().Published {
		t.Fatal(err)
	}
	programme, err := appmedia.NewCreateProgramme(d).Execute(context.Background(), actor(), domainmedia.ProgrammeState{Title: "Morning", Locale: "en", PresenterIDs: []shared.PresenterID{presenter.ID()}})
	if err != nil {
		t.Fatal(err)
	}
	programme, err = appmedia.NewPublishProgramme(d).Execute(context.Background(), actor(), programme.ID())
	if err != nil || !programme.State().Published {
		t.Fatal(err)
	}
	slot, err := appmedia.NewScheduleProgramme(d).Execute(context.Background(), actor(), domainmedia.ScheduleSlotState{ProgrammeID: programme.ID(), Locale: "en", StartsAt: now.Add(time.Hour), EndsAt: now.Add(2 * time.Hour)})
	if err != nil {
		t.Fatal(err)
	}
	guide, err := appmedia.NewListTelevisionGuide(d).Execute(context.Background(), "en")
	if err != nil || len(guide.Presenters) != 1 || len(guide.Programmes) != 1 || len(guide.Upcoming) != 1 {
		t.Fatalf("%+v %v", guide, err)
	}
	_ = presenters
	_ = programmes
	_ = schedule
	_ = slot
}

func TestCommandsPropagateRulesAndStorageFailures(t *testing.T) {
	d, presenters, programmes, schedule := deps()
	if _, err := appmedia.NewPublishPresenter(d).Execute(context.Background(), actor(), "missing"); !errors.Is(err, errors.New("x")) && err == nil {
		t.Fatal("expected missing")
	}
	unpublished := domainmedia.ReconstituteProgramme(domainmedia.ProgrammeState{ID: "programme", Title: "Draft", PresenterIDs: []shared.PresenterID{"host"}})
	programmes.Items[unpublished.ID()] = unpublished
	if _, err := appmedia.NewScheduleProgramme(d).Execute(context.Background(), actor(), domainmedia.ScheduleSlotState{ProgrammeID: unpublished.ID()}); !errors.Is(err, appmedia.ErrProgrammeNotPublished) {
		t.Fatal(err)
	}
	presenters.Err = errors.New("presenter store down")
	if _, err := appmedia.NewCreatePresenter(d).Execute(context.Background(), actor(), domainmedia.PresenterState{Name: "Ama"}); err == nil {
		t.Fatal("expected save failure")
	}
	presenters.Err = nil
	programmes.Err = errors.New("programme store down")
	if _, err := appmedia.NewListTelevisionGuide(d).Execute(context.Background(), "en"); err == nil {
		t.Fatal("expected list failure")
	}
	programmes.Err = nil
	schedule.Err = errors.New("schedule store down")
	if _, err := appmedia.NewListTelevisionGuide(d).Execute(context.Background(), "en"); err == nil {
		t.Fatal("expected schedule failure")
	}
}
