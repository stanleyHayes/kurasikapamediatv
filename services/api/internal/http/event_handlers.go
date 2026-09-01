package http

import (
	"net/http"
	"time"

	appmedia "github.com/kurasikapa/api/internal/app/media"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type eventRequest struct {
	Type                                   domainmedia.EventType
	Mode                                   domainmedia.EventMode
	Title, Slug, Locale, Summary           string
	Timezone, Venue, City, RegistrationURL string
	StartsAt, EndsAt                       time.Time
	ImageAssetID                           *shared.AssetID
	Speakers                               []string
	Featured                               bool
}

func (d Deps) handleCreateEvent(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input eventRequest
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	event, err := d.CreateEvent.Execute(r.Context(), actor, domainmedia.EventState{Type: input.Type, Mode: input.Mode, Title: input.Title, Slug: input.Slug, Locale: input.Locale, Summary: input.Summary, Timezone: input.Timezone, Venue: input.Venue, City: input.City, RegistrationURL: input.RegistrationURL, StartsAt: input.StartsAt, EndsAt: input.EndsAt, ImageAssetID: input.ImageAssetID, Speakers: input.Speakers, Featured: input.Featured})
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, eventView(appmedia.EventListing{Event: event}))
}

func (d Deps) handlePublishEvent(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	event, err := d.PublishEvent.Execute(r.Context(), actor, shared.EventID(r.PathValue("id")))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, eventView(appmedia.EventListing{Event: event}))
}

func (d Deps) handleUpcomingEvents(w http.ResponseWriter, r *http.Request) {
	items, err := d.ListUpcomingEvents.Execute(r.Context(), r.PathValue("locale"), 50)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	views := make([]map[string]any, len(items))
	for i, item := range items {
		views[i] = eventView(item)
	}
	writeJSON(w, d.Log, http.StatusOK, map[string]any{"items": views})
}

func eventView(item appmedia.EventListing) map[string]any {
	s := item.Event.State()
	view := map[string]any{"id": s.ID.String(), "type": s.Type, "mode": s.Mode, "title": s.Title, "slug": s.Slug, "locale": s.Locale, "summary": s.Summary, "timezone": s.Timezone, "venue": s.Venue, "city": s.City, "registrationUrl": s.RegistrationURL, "startsAt": s.StartsAt, "endsAt": s.EndsAt, "speakers": s.Speakers, "featured": s.Featured, "published": s.Published, "publishedAt": s.PublishedAt}
	if item.Image != nil {
		view["image"] = map[string]any{"url": item.Image.State().SecureURL, "altText": item.Image.State().AltText}
	}
	return view
}
