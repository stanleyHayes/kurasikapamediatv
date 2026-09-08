package media

import (
	"context"
	"errors"

	"github.com/kurasikapa/api/internal/app/ports"

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

/*
 * Correct an existing listing.
 *
 * The reason this is worth having: without it, fixing a typo in a public event
 * meant creating a second one, and the unique (locale, slug) index made even
 * that fail unless the title changed too.
 */
type UpdateEvent struct{ deps Deps }

func NewUpdateEvent(deps Deps) UpdateEvent { return UpdateEvent{deps: deps} }
func (u UpdateEvent) Execute(ctx context.Context, actor identity.Actor, id shared.EventID, next domainmedia.EventState) (domainmedia.Event, error) {
	event, err := u.deps.Events.FindByID(ctx, id)
	if err != nil {
		return domainmedia.Event{}, err
	}
	event, err = event.Update(actor, next)
	if err != nil {
		return domainmedia.Event{}, err
	}
	return event, u.deps.Events.Save(ctx, event)
}

/*
 * Removes an event for good.
 *
 * The domain refuses this while the event is published, so taking a live
 * listing down is always unpublish-then-delete rather than one irreversible
 * click. Deleting frees the (locale, slug) pair, which the unique index would
 * otherwise hold forever — that is what made a mistaken listing unfixable.
 */
type DeleteEvent struct{ deps Deps }

func NewDeleteEvent(deps Deps) DeleteEvent { return DeleteEvent{deps: deps} }
func (u DeleteEvent) Execute(ctx context.Context, actor identity.Actor, id shared.EventID) error {
	event, err := u.deps.Events.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if err = event.AssertRemovable(actor); err != nil {
		return err
	}
	return u.deps.Events.Delete(ctx, id)
}

/*
 * One published event, by slug, for the public detail page.
 *
 * An unpublished event is reported as ErrNotFound rather than as forbidden:
 * telling an anonymous visitor that a draft exists at this URL leaks the
 * newsroom's plans.
 */
type GetPublishedEvent struct{ deps Deps }

func NewGetPublishedEvent(deps Deps) GetPublishedEvent { return GetPublishedEvent{deps: deps} }
func (u GetPublishedEvent) Execute(ctx context.Context, locale, slug string) (EventListing, error) {
	event, err := u.deps.Events.FindBySlug(ctx, locale, slug)
	if err != nil {
		return EventListing{}, err
	}
	if !event.State().Published {
		return EventListing{}, ports.ErrNotFound
	}
	item := EventListing{Event: event}
	if imageID := event.State().ImageAssetID; imageID != nil {
		image, findErr := u.deps.Assets.FindByID(ctx, *imageID)
		if findErr != nil {
			return EventListing{}, findErr
		}
		item.Image = &image
	}
	return item, nil
}

/*
 * Back to draft.
 *
 * The counterpart to PublishEvent, and the reason a draft state is worth
 * having at all: without it a mistake in a public listing could only be
 * corrected by editing the database by hand, because there is no edit path.
 */
type UnpublishEvent struct{ deps Deps }

func NewUnpublishEvent(deps Deps) UnpublishEvent { return UnpublishEvent{deps: deps} }
func (u UnpublishEvent) Execute(ctx context.Context, actor identity.Actor, id shared.EventID) (domainmedia.Event, error) {
	event, err := u.deps.Events.FindByID(ctx, id)
	if err != nil {
		return domainmedia.Event{}, err
	}
	event, err = event.Unpublish(actor)
	if err != nil {
		return domainmedia.Event{}, err
	}
	return event, u.deps.Events.Save(ctx, event)
}

type EventListing struct {
	Event domainmedia.Event
	Image *domainmedia.Asset
}

/*
 * Everything the newsroom has, drafts included.
 *
 * Separate from ListUpcomingEvents because the two answer different questions:
 * the public one asks "what can a reader still attend", this one asks "what
 * has this newsroom got". Permission-gated, since an unpublished listing is
 * not public information.
 */
type ListEvents struct{ deps Deps }

func NewListEvents(deps Deps) ListEvents { return ListEvents{deps: deps} }
func (u ListEvents) Execute(ctx context.Context, actor identity.Actor, locale string, limit int) ([]EventListing, error) {
	if err := actor.Require(identity.PermArticleDraft); err != nil {
		return nil, err
	}
	events, err := u.deps.Events.ListAll(ctx, locale, limit)
	if err != nil {
		return nil, err
	}
	return u.withImages(ctx, events)
}

func (u ListEvents) withImages(ctx context.Context, events []domainmedia.Event) ([]EventListing, error) {
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
