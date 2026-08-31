package media

import (
	"context"
	"errors"

	"github.com/kurasikapa/api/internal/domain/identity"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var (
	ErrReplayNeedsReadyVideo    = errors.New("replay requires a ready video asset")
	ErrReplayNeedsReadyCaptions = errors.New("replay requires a ready caption asset")
	ErrReplayCaptionsMustBeVTT  = errors.New("replay captions must be a WebVTT file")
)

type PublishReplayInput struct {
	SlotID         shared.ScheduleSlotID
	ReplayAssetID  shared.AssetID
	CaptionAssetID shared.AssetID
}

type PublishReplay struct{ deps Deps }

func NewPublishReplay(deps Deps) PublishReplay { return PublishReplay{deps: deps} }

func (u PublishReplay) Execute(ctx context.Context, actor identity.Actor, input PublishReplayInput) (domainmedia.ScheduleSlot, error) {
	if err := actor.Require(identity.PermStreamManage); err != nil {
		return domainmedia.ScheduleSlot{}, err
	}
	slot, err := u.deps.Schedule.FindByID(ctx, input.SlotID)
	if err != nil {
		return domainmedia.ScheduleSlot{}, err
	}
	video, err := u.deps.Assets.FindByID(ctx, input.ReplayAssetID)
	if err != nil {
		return domainmedia.ScheduleSlot{}, err
	}
	if !readyKind(video, domainmedia.AssetVideo) {
		return domainmedia.ScheduleSlot{}, ErrReplayNeedsReadyVideo
	}
	captions, err := u.deps.Assets.FindByID(ctx, input.CaptionAssetID)
	if err != nil {
		return domainmedia.ScheduleSlot{}, err
	}
	if !readyKind(captions, domainmedia.AssetCaption) {
		return domainmedia.ScheduleSlot{}, ErrReplayNeedsReadyCaptions
	}
	if captions.State().MIMEType != "text/vtt" {
		return domainmedia.ScheduleSlot{}, ErrReplayCaptionsMustBeVTT
	}
	captionID := captions.ID()
	slot, err = slot.PublishReplay(actor, video.ID(), &captionID, u.deps.Clock.Now())
	if err != nil {
		return domainmedia.ScheduleSlot{}, err
	}
	return slot, u.deps.Schedule.Save(ctx, slot)
}

func readyKind(asset domainmedia.Asset, kind domainmedia.AssetKind) bool {
	state := asset.State()
	return state.Status == domainmedia.AssetReady && state.Kind == kind && state.SecureURL != ""
}

type ListReplayCandidates struct{ deps Deps }

func NewListReplayCandidates(deps Deps) ListReplayCandidates { return ListReplayCandidates{deps: deps} }

func (u ListReplayCandidates) Execute(ctx context.Context, actor identity.Actor, locale string) ([]SlotView, error) {
	if err := actor.Require(identity.PermStreamManage); err != nil {
		return nil, err
	}
	slots, err := u.deps.Schedule.ListAwaitingReplay(ctx, locale, u.deps.Clock.Now(), 20)
	if err != nil {
		return nil, err
	}
	views := make([]SlotView, 0, len(slots))
	for _, slot := range slots {
		programme, findErr := u.deps.Programmes.FindByID(ctx, slot.State().ProgrammeID)
		if findErr != nil {
			return nil, findErr
		}
		views = append(views, SlotView{Slot: slot, Programme: programme})
	}
	return views, nil
}
