package media

import (
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type EventType string
type EventMode string

const (
	EventWebinar    EventType = "webinar"
	EventConference EventType = "conference"
	EventSummit     EventType = "summit"
	EventOnline     EventMode = "online"
	EventInPerson   EventMode = "in_person"
	EventHybrid     EventMode = "hybrid"
)

var (
	ErrInvalidEventType       = errors.New("event type must be webinar, conference or summit")
	ErrInvalidEventMode       = errors.New("event mode must be online, in_person or hybrid")
	ErrEmptyEventTitle        = errors.New("event title cannot be empty")
	ErrEmptyEventSummary      = errors.New("event summary cannot be empty")
	ErrInvalidEventIdentity   = errors.New("event slug and locale cannot be empty")
	ErrInvalidEventWindow     = errors.New("event end must be after its start")
	ErrEmptyEventTimezone     = errors.New("event timezone cannot be empty")
	ErrEventNeedsVenue        = errors.New("in-person and hybrid events require a venue")
	ErrInvalidRegistrationURL = errors.New("event registration URL must use HTTPS")
	ErrEventAlreadyEnded      = errors.New("an ended event cannot be published")
)

type EventState struct {
	ID                                     shared.EventID
	Type                                   EventType
	Mode                                   EventMode
	Title, Slug, Locale, Summary           string
	Timezone, Venue, City, RegistrationURL string
	StartsAt, EndsAt                       time.Time
	ImageAssetID                           *shared.AssetID
	Speakers                               []string
	Featured, Published                    bool
	PublishedAt                            *time.Time
	CreatedBy                              shared.UserID
}

type Event struct{ state EventState }

func NewEvent(actor identity.Actor, state EventState) (Event, error) {
	if err := actor.Require(identity.PermArticlePublish); err != nil {
		return Event{}, err
	}
	if err := validateEvent(&state); err != nil {
		return Event{}, err
	}
	state.Published, state.PublishedAt, state.CreatedBy = false, nil, actor.ID()
	state.Speakers = append([]string(nil), state.Speakers...)
	return Event{state: state}, nil
}

func ReconstituteEvent(state EventState) Event {
	state.Speakers = append([]string(nil), state.Speakers...)
	return Event{state: state}
}

func (e Event) ID() shared.EventID { return e.state.ID }
func (e Event) State() EventState {
	e.state.Speakers = append([]string(nil), e.state.Speakers...)
	return e.state
}

func (e Event) Publish(actor identity.Actor, now time.Time) (Event, error) {
	if err := actor.Require(identity.PermArticlePublish); err != nil {
		return Event{}, err
	}
	if !e.state.EndsAt.After(now) {
		return Event{}, ErrEventAlreadyEnded
	}
	e.state.Published, e.state.PublishedAt = true, &now
	return e, nil
}

func validateEvent(state *EventState) error {
	state.Title, state.Slug = strings.TrimSpace(state.Title), strings.TrimSpace(state.Slug)
	state.Locale, state.Summary = strings.TrimSpace(state.Locale), strings.TrimSpace(state.Summary)
	state.Timezone, state.Venue = strings.TrimSpace(state.Timezone), strings.TrimSpace(state.Venue)
	state.City, state.RegistrationURL = strings.TrimSpace(state.City), strings.TrimSpace(state.RegistrationURL)
	if state.Type != EventWebinar && state.Type != EventConference && state.Type != EventSummit {
		return ErrInvalidEventType
	}
	if state.Mode != EventOnline && state.Mode != EventInPerson && state.Mode != EventHybrid {
		return ErrInvalidEventMode
	}
	if state.Title == "" {
		return ErrEmptyEventTitle
	}
	if state.Summary == "" {
		return ErrEmptyEventSummary
	}
	if state.Slug == "" || state.Locale == "" {
		return ErrInvalidEventIdentity
	}
	if !state.EndsAt.After(state.StartsAt) {
		return ErrInvalidEventWindow
	}
	if state.Timezone == "" {
		return ErrEmptyEventTimezone
	}
	if state.Mode != EventOnline && state.Venue == "" {
		return ErrEventNeedsVenue
	}
	if state.RegistrationURL != "" && !isHTTPS(state.RegistrationURL) {
		return ErrInvalidRegistrationURL
	}
	return nil
}

func isHTTPS(raw string) bool {
	parsed, err := url.ParseRequestURI(raw)
	return err == nil && parsed.Scheme == "https" && parsed.Host != ""
}
