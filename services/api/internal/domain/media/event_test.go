package media_test

import (
	"errors"
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
