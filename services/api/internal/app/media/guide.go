package media

import (
	"context"

	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type ProgrammeView struct {
	Programme  domainmedia.Programme
	Presenters []domainmedia.Presenter
}
type SlotView struct {
	Slot      domainmedia.ScheduleSlot
	Programme domainmedia.Programme
}
type TelevisionGuide struct {
	Presenters        []domainmedia.Presenter
	Programmes        []ProgrammeView
	Upcoming, Replays []SlotView
}
type ListTelevisionGuide struct{ deps Deps }

func NewListTelevisionGuide(deps Deps) ListTelevisionGuide { return ListTelevisionGuide{deps: deps} }

func (u ListTelevisionGuide) Execute(ctx context.Context, locale string) (TelevisionGuide, error) {
	presenters, err := u.deps.Presenters.ListPublished(ctx, locale)
	if err != nil {
		return TelevisionGuide{}, err
	}
	programmes, err := u.deps.Programmes.ListPublished(ctx, locale)
	if err != nil {
		return TelevisionGuide{}, err
	}
	upcoming, err := u.deps.Schedule.ListUpcoming(ctx, locale, u.deps.Clock.Now(), 20)
	if err != nil {
		return TelevisionGuide{}, err
	}
	replays, err := u.deps.Schedule.ListReplays(ctx, locale, 12)
	if err != nil {
		return TelevisionGuide{}, err
	}
	return buildGuide(presenters, programmes, upcoming, replays), nil
}

func buildGuide(presenters []domainmedia.Presenter, programmes []domainmedia.Programme, upcoming, replays []domainmedia.ScheduleSlot) TelevisionGuide {
	byPresenter := make(map[shared.PresenterID]domainmedia.Presenter, len(presenters))
	for _, presenter := range presenters {
		byPresenter[presenter.ID()] = presenter
	}
	byProgramme := make(map[shared.ProgrammeID]domainmedia.Programme, len(programmes))
	views := make([]ProgrammeView, 0, len(programmes))
	for _, programme := range programmes {
		byProgramme[programme.ID()] = programme
		hosts := make([]domainmedia.Presenter, 0, len(programme.State().PresenterIDs))
		for _, id := range programme.State().PresenterIDs {
			if host, ok := byPresenter[id]; ok {
				hosts = append(hosts, host)
			}
		}
		views = append(views, ProgrammeView{Programme: programme, Presenters: hosts})
	}
	return TelevisionGuide{Presenters: presenters, Programmes: views, Upcoming: enrich(upcoming, byProgramme), Replays: enrich(replays, byProgramme)}
}

func enrich(slots []domainmedia.ScheduleSlot, programmes map[shared.ProgrammeID]domainmedia.Programme) []SlotView {
	out := make([]SlotView, 0, len(slots))
	for _, slot := range slots {
		if programme, ok := programmes[slot.State().ProgrammeID]; ok {
			out = append(out, SlotView{Slot: slot, Programme: programme})
		}
	}
	return out
}
