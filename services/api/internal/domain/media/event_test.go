package media_test

import (
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
)

func TestEventLifecycle(t *testing.T) {
	now := time.Date(2026, 9, 1, 9, 0, 0, 0, time.UTC)
	input := media.EventState{
		ID: "event_1", Type: media.EventSummit, Mode: media.EventHybrid,
		Title: "  Kurasikapa Media Futures Summit  ", Slug: "media-futures-summit",
		Locale: "en", Summary: "A practical forum for journalism and broadcast leaders.",
		StartsAt: now.Add(24 * time.Hour), EndsAt: now.Add(32 * time.Hour),
		Timezone: "Africa/Accra", Venue: "Accra International Conference Centre",
		City: "Accra", RegistrationURL: "https://tickets.example.org/summit",
		Speakers: []string{"Ama Mensah", "Kwesi Boateng"}, Featured: true,
	}

	if _, err := media.NewEvent(guest(), input); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	event, err := media.NewEvent(editor(), input)
	if err != nil {
		t.Fatal(err)
	}
	state := event.State()
	if state.Title != "Kurasikapa Media Futures Summit" || state.Published || event.ID() != "event_1" {
		t.Fatalf("state = %+v", state)
	}
	input.Speakers[0] = "changed"
	if event.State().Speakers[0] != "Ama Mensah" {
		t.Fatal("event retained caller-owned speakers")
	}
	if _, err = event.Publish(guest(), now); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	event, err = event.Publish(editor(), now)
	if err != nil || !event.State().Published || event.State().PublishedAt == nil {
		t.Fatalf("publish = %+v, %v", event.State(), err)
	}
	if media.ReconstituteEvent(event.State()).ID() != event.ID() {
		t.Fatal("reconstitution failed")
	}
}

func TestEventValidation(t *testing.T) {
	now := time.Date(2026, 9, 1, 9, 0, 0, 0, time.UTC)
	valid := media.EventState{
		ID: "event_1", Type: media.EventWebinar, Mode: media.EventOnline,
		Title: "Newsroom verification clinic", Slug: "verification-clinic", Locale: "en",
		Summary:  "A hands-on verification session for working journalists.",
		StartsAt: now.Add(time.Hour), EndsAt: now.Add(2 * time.Hour), Timezone: "Africa/Accra",
		RegistrationURL: "https://events.example.org/clinic",
	}
	cases := []struct {
		name string
		edit func(*media.EventState)
		want error
	}{
		{"type", func(s *media.EventState) { s.Type = "party" }, media.ErrInvalidEventType},
		{"mode", func(s *media.EventState) { s.Mode = "phone" }, media.ErrInvalidEventMode},
		{"title", func(s *media.EventState) { s.Title = " " }, media.ErrEmptyEventTitle},
		{"summary", func(s *media.EventState) { s.Summary = " " }, media.ErrEmptyEventSummary},
		{"identity", func(s *media.EventState) { s.Slug = " " }, media.ErrInvalidEventIdentity},
		{"window", func(s *media.EventState) { s.EndsAt = s.StartsAt }, media.ErrInvalidEventWindow},
		{"timezone", func(s *media.EventState) { s.Timezone = " " }, media.ErrEmptyEventTimezone},
		{"venue", func(s *media.EventState) { s.Mode, s.Venue = media.EventInPerson, " " }, media.ErrEventNeedsVenue},
		{"url", func(s *media.EventState) { s.RegistrationURL = "http://example.org" }, media.ErrInvalidRegistrationURL},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			input := valid
			tc.edit(&input)
			if _, err := media.NewEvent(editor(), input); !errors.Is(err, tc.want) {
				t.Fatalf("got %v, want %v", err, tc.want)
			}
		})
	}

	past := valid
	past.StartsAt, past.EndsAt = now.Add(-2*time.Hour), now.Add(-time.Hour)
	event, err := media.NewEvent(editor(), past)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = event.Publish(editor(), now); !errors.Is(err, media.ErrEventAlreadyEnded) {
		t.Fatal(err)
	}
}

func editor() identity.Actor {
	return identity.NewActor("editor", []identity.Role{identity.RoleEditor})
}

// A newsroom covering Ghana and its diaspora convenes more than webinars. The
// original three types forced a cultural dinner to be filed as a "conference",
// which is a lie the calendar then tells its readers.
func TestEventTypesCoverWhatTheNewsroomActuallyStages(t *testing.T) {
	now := time.Date(2026, 9, 1, 9, 0, 0, 0, time.UTC)
	base := media.EventState{
		ID: "event_1", Mode: media.EventOnline, Title: "A gathering", Slug: "a-gathering",
		Locale: "en", Summary: "Something worth attending.", StartsAt: now.Add(time.Hour),
		EndsAt: now.Add(2 * time.Hour), Timezone: "Europe/Paris",
	}

	for _, kind := range media.EventTypes() {
		t.Run(string(kind), func(t *testing.T) {
			input := base
			input.Type = kind
			if _, err := media.NewEvent(editor(), input); err != nil {
				t.Fatalf("type %q rejected: %v", kind, err)
			}
		})
	}

	// `other` is the honest escape hatch, so nothing has to be mislabelled.
	if !slices.Contains(media.EventTypes(), media.EventOther) {
		t.Fatal("EventTypes must include `other`")
	}
	// The list is still closed: an invented type is refused.
	input := base
	input.Type = "kickabout"
	if _, err := media.NewEvent(editor(), input); !errors.Is(err, media.ErrInvalidEventType) {
		t.Fatalf("got %v, want ErrInvalidEventType", err)
	}
}

// Publishing was one-way: a typo in a public listing could only be corrected
// by editing Mongo by hand. Unpublish returns it to draft.
func TestEventUnpublishReturnsItToDraft(t *testing.T) {
	now := time.Date(2026, 9, 1, 9, 0, 0, 0, time.UTC)
	event, err := media.NewEvent(editor(), media.EventState{
		ID: "event_1", Type: media.EventCultural, Mode: media.EventInPerson,
		Title: "Kente Cultural Dinner", Slug: "kente-cultural-dinner", Locale: "fr",
		Summary: "La deuxième édition du Dîner culturel Kente.", StartsAt: now.Add(24 * time.Hour),
		EndsAt: now.Add(33 * time.Hour), Timezone: "Europe/Paris", Venue: "6 place de la Légion d'Honneur",
		City: "Saint-Denis",
	})
	if err != nil {
		t.Fatal(err)
	}
	if event.State().Published {
		t.Fatal("a new event must start as a draft")
	}

	published, err := event.Publish(editor(), now)
	if err != nil || !published.State().Published {
		t.Fatalf("publish = %v", err)
	}

	if _, err = published.Unpublish(guest()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatalf("guest unpublish = %v, want ErrNotPermitted", err)
	}

	draft, err := published.Unpublish(editor())
	if err != nil || draft.State().Published {
		t.Fatalf("unpublish = %+v, %v", draft.State(), err)
	}
	// PublishedAt survives: it records that this WAS public, which matters when
	// someone asks why a URL that used to work now 404s.
	if draft.State().PublishedAt == nil {
		t.Fatal("PublishedAt must be kept as the record of a past publication")
	}
	// And it can go back out again.
	if again, againErr := draft.Publish(editor(), now); againErr != nil || !again.State().Published {
		t.Fatalf("republish = %v", againErr)
	}
}

func TestEventUpdate(t *testing.T) {
	now := time.Date(2026, 9, 1, 9, 0, 0, 0, time.UTC)
	original := media.EventState{
		ID: "event_1", Type: media.EventCultural, Mode: media.EventInPerson,
		Title: "Kente Cultural Dinner", Slug: "kente-cultural-dinner", Locale: "fr",
		Summary: "La deuxième édition du Dîner culturel Kente.", StartsAt: now.Add(24 * time.Hour),
		EndsAt: now.Add(33 * time.Hour), Timezone: "Europe/Paris",
		Venue: "6 place de la Légion d'Honneur", City: "Saint-Denis", Speakers: []string{"Gyenyame Band"},
	}
	event, err := media.NewEvent(editor(), original)
	if err != nil {
		t.Fatal(err)
	}

	t.Run("rejects an actor who may not publish", func(t *testing.T) {
		if _, updateErr := event.Update(guest(), original); !errors.Is(updateErr, identity.ErrNotPermitted) {
			t.Fatalf("got %v, want ErrNotPermitted", updateErr)
		}
	})

	t.Run("edits the mutable fields", func(t *testing.T) {
		next := original
		next.Title, next.Venue, next.City = "Kente Cultural Dinner — 2nd Edition", "Salle des fêtes", "Saint-Ouen"
		next.Speakers = []string{"Gyenyame Band", "DJ Kwame"}
		updated, updateErr := event.Update(editor(), next)
		if updateErr != nil {
			t.Fatal(updateErr)
		}
		state := updated.State()
		if state.Title != "Kente Cultural Dinner — 2nd Edition" || state.City != "Saint-Ouen" || len(state.Speakers) != 2 {
			t.Fatalf("state = %+v", state)
		}
	})

	t.Run("re-validates, so an edit cannot smuggle in an invalid event", func(t *testing.T) {
		next := original
		next.EndsAt = next.StartsAt
		if _, updateErr := event.Update(editor(), next); !errors.Is(updateErr, media.ErrInvalidEventWindow) {
			t.Fatalf("got %v, want ErrInvalidEventWindow", updateErr)
		}
	})

	t.Run("never lets an edit change identity or lifecycle", func(t *testing.T) {
		next := original
		next.ID, next.Locale, next.CreatedBy = "hijacked", "en", "someone-else"
		next.Published, next.PublishedAt = true, &now
		updated, updateErr := event.Update(editor(), next)
		if updateErr != nil {
			t.Fatal(updateErr)
		}
		state := updated.State()
		if state.ID != "event_1" || state.Locale != "fr" || state.Published || state.PublishedAt != nil {
			t.Fatalf("identity or lifecycle moved: %+v", state)
		}
	})

	t.Run("slug moves freely while the event is a draft", func(t *testing.T) {
		next := original
		next.Slug = "kente-cultural-dinner-2026"
		updated, updateErr := event.Update(editor(), next)
		if updateErr != nil || updated.State().Slug != "kente-cultural-dinner-2026" {
			t.Fatalf("draft slug = %+v, %v", updated.State().Slug, updateErr)
		}
	})

	/*
	 * Once a listing has been public its URL is someone else's bookmark. Same
	 * rule the article aggregate applies, and it survives unpublishing —
	 * PublishedAt is kept, so a pulled event cannot quietly move either.
	 */
	t.Run("slug freezes after first publication", func(t *testing.T) {
		published, publishErr := event.Publish(editor(), now)
		if publishErr != nil {
			t.Fatal(publishErr)
		}
		next := original
		next.Slug = "somewhere-else"
		if _, updateErr := published.Update(editor(), next); !errors.Is(updateErr, media.ErrEventSlugFrozen) {
			t.Fatalf("got %v, want ErrEventSlugFrozen", updateErr)
		}
		// Everything else on a published event is still editable.
		same := original
		same.Summary = "Programme mis à jour : tapis rouge dès 19 h."
		if _, updateErr := published.Update(editor(), same); updateErr != nil {
			t.Fatalf("editing a published event = %v", updateErr)
		}
		// And the freeze outlives an unpublish.
		draft, unpublishErr := published.Unpublish(editor())
		if unpublishErr != nil {
			t.Fatal(unpublishErr)
		}
		if _, updateErr := draft.Update(editor(), next); !errors.Is(updateErr, media.ErrEventSlugFrozen) {
			t.Fatalf("unpublished slug = %v, want still frozen", updateErr)
		}
	})
}

/*
 * Deleting is guarded, unpublishing is not. Removing a listing readers can see
 * is a different act from taking it down, so it takes two deliberate steps:
 * unpublish, then delete.
 */
func TestEventRemoval(t *testing.T) {
	now := time.Date(2026, 9, 1, 9, 0, 0, 0, time.UTC)
	event, err := media.NewEvent(editor(), media.EventState{
		ID: "event_1", Type: media.EventFestival, Mode: media.EventInPerson,
		Title: "Homowo in Paris", Slug: "homowo-in-paris", Locale: "fr",
		Summary: "Une célébration de la moisson ga.", StartsAt: now.Add(24 * time.Hour),
		EndsAt: now.Add(30 * time.Hour), Timezone: "Europe/Paris", Venue: "Mairie du 18e", City: "Paris",
	})
	if err != nil {
		t.Fatal(err)
	}

	if err = event.AssertRemovable(guest()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatalf("guest = %v, want ErrNotPermitted", err)
	}
	if err = event.AssertRemovable(editor()); err != nil {
		t.Fatalf("a draft must be removable: %v", err)
	}

	published, err := event.Publish(editor(), now)
	if err != nil {
		t.Fatal(err)
	}
	if err = published.AssertRemovable(editor()); !errors.Is(err, media.ErrEventStillPublished) {
		t.Fatalf("published = %v, want ErrEventStillPublished", err)
	}

	draft, err := published.Unpublish(editor())
	if err != nil {
		t.Fatal(err)
	}
	if err = draft.AssertRemovable(editor()); err != nil {
		t.Fatalf("after unpublish = %v, want removable", err)
	}
}
