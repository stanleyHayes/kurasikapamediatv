package media

import (
	"context"
	"errors"

	"github.com/kurasikapa/api/internal/domain/identity"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var ErrEventImageNotReady = errors.New("event image is not ready or is not an image")

type CreateEvent struct{ deps Deps }

func NewCreateEvent(deps Deps) CreateEvent { return CreateEvent{deps: deps} }
func (u CreateEvent) Execute(ctx context.Context, actor identity.Actor, input domainmedia.EventState) (domainmedia.Event, error) {
	input.ID = shared.EventID(u.deps.IDs.NewID())
	event, err := domainmedia.NewEvent(actor, input)
	if err != nil {
		return domainmedia.Event{}, err
	}
	return event, u.deps.Events.Save(ctx, event)
}

type PublishEvent struct{ deps Deps }

func NewPublishEvent(deps Deps) PublishEvent { return PublishEvent{deps: deps} }
func (u PublishEvent) Execute(ctx context.Context, actor identity.Actor, id shared.EventID) (domainmedia.Event, error) {
	event, err := u.deps.Events.FindByID(ctx, id)
	if err != nil {
		return domainmedia.Event{}, err
	}
	if imageID := event.State().ImageAssetID; imageID != nil {
		asset, findErr := u.deps.Assets.FindByID(ctx, *imageID)
		if findErr != nil {
			return domainmedia.Event{}, findErr
		}
		state := asset.State()
		if state.Kind != domainmedia.AssetImage || state.Status != domainmedia.AssetReady {
			return domainmedia.Event{}, ErrEventImageNotReady
		}
	}
	event, err = event.Publish(actor, u.deps.Clock.Now())
	if err != nil {
		return domainmedia.Event{}, err
	}
	return event, u.deps.Events.Save(ctx, event)
}

type EventListing struct {
	Event domainmedia.Event
	Image *domainmedia.Asset
}

type ListUpcomingEvents struct{ deps Deps }

func NewListUpcomingEvents(deps Deps) ListUpcomingEvents { return ListUpcomingEvents{deps: deps} }
func (u ListUpcomingEvents) Execute(ctx context.Context, locale string, limit int) ([]EventListing, error) {
	events, err := u.deps.Events.ListUpcoming(ctx, locale, u.deps.Clock.Now(), limit)
	if err != nil {
		return nil, err
	}
	out := make([]EventListing, 0, len(events))
	for _, event := range events {
		item := EventListing{Event: event}
		if imageID := event.State().ImageAssetID; imageID != nil {
			image, findErr := u.deps.Assets.FindByID(ctx, *imageID)
			if findErr != nil {
				return nil, findErr
			}
			item.Image = &image
		}
		out = append(out, item)
	}
	return out, nil
}
