// Package media coordinates station programming use cases.
package media

import (
	"context"
	"errors"
	"fmt"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var ErrProgrammeNotPublished = errors.New("programme must be published before scheduling")

type Deps struct {
	Presenters ports.PresenterRepository
	Programmes ports.ProgrammeRepository
	Schedule   ports.ScheduleRepository
	Podcasts   ports.PodcastRepository
	Episodes   ports.EpisodeRepository
	Assets     ports.AssetRepository
	Clock      ports.Clock
	IDs        ports.IDs
}

type CreatePresenter struct{ deps Deps }

func NewCreatePresenter(deps Deps) CreatePresenter { return CreatePresenter{deps: deps} }
func (u CreatePresenter) Execute(ctx context.Context, actor identity.Actor, input domainmedia.PresenterState) (domainmedia.Presenter, error) {
	input.ID = shared.PresenterID(u.deps.IDs.NewID())
	presenter, err := domainmedia.NewPresenter(actor, input)
	if err != nil {
		return domainmedia.Presenter{}, err
	}
	if err = u.deps.Presenters.Save(ctx, presenter); err != nil {
		return domainmedia.Presenter{}, err
	}
	return presenter, nil
}

type PublishPresenter struct{ deps Deps }

func NewPublishPresenter(deps Deps) PublishPresenter { return PublishPresenter{deps: deps} }
func (u PublishPresenter) Execute(ctx context.Context, actor identity.Actor, id shared.PresenterID) (domainmedia.Presenter, error) {
	presenter, err := u.deps.Presenters.FindByID(ctx, id)
	if err != nil {
		return domainmedia.Presenter{}, err
	}
	presenter, err = presenter.Publish(actor)
	if err != nil {
		return domainmedia.Presenter{}, err
	}
	return presenter, u.deps.Presenters.Save(ctx, presenter)
}

type CreateProgramme struct{ deps Deps }

func NewCreateProgramme(deps Deps) CreateProgramme { return CreateProgramme{deps: deps} }
func (u CreateProgramme) Execute(ctx context.Context, actor identity.Actor, input domainmedia.ProgrammeState) (domainmedia.Programme, error) {
	input.ID = shared.ProgrammeID(u.deps.IDs.NewID())
	for _, id := range input.PresenterIDs {
		presenter, err := u.deps.Presenters.FindByID(ctx, id)
		if err != nil {
			return domainmedia.Programme{}, err
		}
		if !presenter.State().Published {
			return domainmedia.Programme{}, fmt.Errorf("presenter %s is not published", id)
		}
	}
	programme, err := domainmedia.NewProgramme(actor, input)
	if err != nil {
		return domainmedia.Programme{}, err
	}
	if err = u.deps.Programmes.Save(ctx, programme); err != nil {
		return domainmedia.Programme{}, err
	}
	return programme, nil
}

type PublishProgramme struct{ deps Deps }

func NewPublishProgramme(deps Deps) PublishProgramme { return PublishProgramme{deps: deps} }
func (u PublishProgramme) Execute(ctx context.Context, actor identity.Actor, id shared.ProgrammeID) (domainmedia.Programme, error) {
	programme, err := u.deps.Programmes.FindByID(ctx, id)
	if err != nil {
		return domainmedia.Programme{}, err
	}
	programme, err = programme.Publish(actor)
	if err != nil {
		return domainmedia.Programme{}, err
	}
	return programme, u.deps.Programmes.Save(ctx, programme)
}

type ScheduleProgramme struct{ deps Deps }

func NewScheduleProgramme(deps Deps) ScheduleProgramme { return ScheduleProgramme{deps: deps} }
func (u ScheduleProgramme) Execute(ctx context.Context, actor identity.Actor, input domainmedia.ScheduleSlotState) (domainmedia.ScheduleSlot, error) {
	programme, err := u.deps.Programmes.FindByID(ctx, input.ProgrammeID)
	if err != nil {
		return domainmedia.ScheduleSlot{}, err
	}
	if !programme.State().Published {
		return domainmedia.ScheduleSlot{}, ErrProgrammeNotPublished
	}
	input.ID = shared.ScheduleSlotID(u.deps.IDs.NewID())
	slot, err := domainmedia.NewScheduleSlot(actor, input, u.deps.Clock.Now())
	if err != nil {
		return domainmedia.ScheduleSlot{}, err
	}
	if err = u.deps.Schedule.Save(ctx, slot); err != nil {
		return domainmedia.ScheduleSlot{}, err
	}
	return slot, nil
}
