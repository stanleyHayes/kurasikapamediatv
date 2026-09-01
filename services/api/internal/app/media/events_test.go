package media_test

import (
	"context"
	"errors"
	"testing"
	"time"

	appmedia "github.com/kurasikapa/api/internal/app/media"
	"github.com/kurasikapa/api/internal/app/ports"
	fakes "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func eventInput(now time.Time, imageID *shared.AssetID) domainmedia.EventState {
	return domainmedia.EventState{
		Type: domainmedia.EventConference, Mode: domainmedia.EventHybrid,
		Title: "Media Futures Forum", Slug: "media-futures-forum", Locale: "en",
		Summary:  "A newsroom-led conference on trustworthy digital journalism.",
		StartsAt: now.Add(24 * time.Hour), EndsAt: now.Add(30 * time.Hour),
		Timezone: "Africa/Accra", Venue: "National Theatre", City: "Accra",
		RegistrationURL: "https://events.example.org/forum", ImageAssetID: imageID,
	}
}

func TestCreatePublishAndListUpcomingEvent(t *testing.T) {
	d, _, _, _ := deps()
	d.Events, d.Assets = fakes.NewEventStore(), fakes.NewAssetStore()
	now := d.Clock.Now()
	image, imageErr := domainmedia.NewAsset(eventEditor(), domainmedia.AssetState{ID: "event-image", Kind: domainmedia.AssetImage, Filename: "summit.jpg", AltText: "Delegates seated in the summit hall"})
	if imageErr != nil {
		t.Fatal(imageErr)
	}
	image, imageErr = image.MarkReady(eventEditor(), domainmedia.AssetDelivery{ProviderID: "event-image", SecureURL: "https://cdn.test/summit.jpg", Bytes: 1_024})
	if imageErr != nil {
		t.Fatal(imageErr)
	}
	if err := d.Assets.Save(context.Background(), image); err != nil {
		t.Fatal(err)
	}
	event, err := appmedia.NewCreateEvent(d).Execute(context.Background(), eventEditor(), eventInput(now, ptrAsset(image.ID())))
	if err != nil || event.State().Published {
		t.Fatalf("create = %+v, %v", event.State(), err)
	}
	event, err = appmedia.NewPublishEvent(d).Execute(context.Background(), eventEditor(), event.ID())
	if err != nil || !event.State().Published {
		t.Fatalf("publish = %+v, %v", event.State(), err)
	}
	items, err := appmedia.NewListUpcomingEvents(d).Execute(context.Background(), "en", 20)
	if err != nil || len(items) != 1 || items[0].Image == nil || items[0].Image.ID() != image.ID() {
		t.Fatalf("items = %+v, %v", items, err)
	}
}

func TestEventUseCaseFailuresAndFilters(t *testing.T) {
	d, _, _, _ := deps()
	events, assets := fakes.NewEventStore(), fakes.NewAssetStore()
	d.Events, d.Assets = events, assets
	now := d.Clock.Now()
	missingID := shared.AssetID("missing")
	event, err := appmedia.NewCreateEvent(d).Execute(context.Background(), eventEditor(), eventInput(now, &missingID))
	if err != nil {
		t.Fatal(err)
	}
	if _, err = appmedia.NewPublishEvent(d).Execute(context.Background(), eventEditor(), event.ID()); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal(err)
	}
	wrong := readyAsset(t, actor(), "missing", domainmedia.AssetVideo)
	if err = assets.Save(context.Background(), wrong); err != nil {
		t.Fatal(err)
	}
	if _, err = appmedia.NewPublishEvent(d).Execute(context.Background(), eventEditor(), event.ID()); !errors.Is(err, appmedia.ErrEventImageNotReady) {
		t.Fatal(err)
	}
	sentinel := errors.New("event store unavailable")
	events.Err = sentinel
	if _, err = appmedia.NewCreateEvent(d).Execute(context.Background(), eventEditor(), eventInput(now, nil)); !errors.Is(err, sentinel) {
		t.Fatal(err)
	}
	if _, err = appmedia.NewPublishEvent(d).Execute(context.Background(), eventEditor(), "missing"); !errors.Is(err, sentinel) {
		t.Fatal(err)
	}
	if _, err = appmedia.NewListUpcomingEvents(d).Execute(context.Background(), "en", 20); !errors.Is(err, sentinel) {
		t.Fatal(err)
	}
}

func ptrAsset(id shared.AssetID) *shared.AssetID { return &id }

func eventEditor() identity.Actor {
	return identity.NewActor("editor", []identity.Role{identity.RoleEditor})
}
