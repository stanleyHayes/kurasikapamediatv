package media

import (
	"context"

	"github.com/kurasikapa/api/internal/app/ports"
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
	Replay    *ReplayDelivery
}
type ReplayDelivery struct {
	PlaybackURL     string `json:"playbackUrl"`
	PosterURL       string `json:"posterUrl"`
	MIMEType        string `json:"mimeType"`
	CaptionURL      string `json:"captionUrl"`
	CaptionMIMEType string `json:"captionMimeType"`
}
type TelevisionGuide struct {
	Presenters        []domainmedia.Presenter
	Programmes        []ProgrammeView
	Upcoming, Replays []SlotView
}
type ListTelevisionGuide struct {
	deps     Deps
	delivery ports.VideoDeliveryPort
}

func NewListTelevisionGuide(deps Deps, delivery ports.VideoDeliveryPort) ListTelevisionGuide {
	return ListTelevisionGuide{deps: deps, delivery: delivery}
}

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
	guide := buildGuide(presenters, programmes, upcoming, replays)
	if err = u.attachReplayDelivery(ctx, guide.Replays); err != nil {
		return TelevisionGuide{}, err
	}
	return guide, nil
}

func (u ListTelevisionGuide) attachReplayDelivery(ctx context.Context, views []SlotView) error {
	for i := range views {
		state := views[i].Slot.State()
		video, err := u.deps.Assets.FindByID(ctx, *state.ReplayAssetID)
		if err != nil {
			return err
		}
		captions, err := u.deps.Assets.FindByID(ctx, *state.CaptionAssetID)
		if err != nil {
			return err
		}
		projected := u.delivery.Project(video)
		views[i].Replay = &ReplayDelivery{PlaybackURL: projected.PlaybackURL, PosterURL: projected.PosterURL,
			MIMEType: projected.MIMEType, CaptionURL: captions.State().SecureURL, CaptionMIMEType: captions.State().MIMEType}
	}
	return nil
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
