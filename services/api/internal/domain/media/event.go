package media

import (
	"errors"
	"net/url"
	"slices"
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
	EventWorkshop   EventType = "workshop"
	EventCultural   EventType = "cultural"
	EventFestival   EventType = "festival"
	EventConcert    EventType = "concert"
	EventScreening  EventType = "screening"
	EventCommunity  EventType = "community"
	EventOther      EventType = "other"
	EventOnline     EventMode = "online"
	EventInPerson   EventMode = "in_person"
	EventHybrid     EventMode = "hybrid"
)

/*
 * The closed set of event types, in the order a form should offer them.
 *
 * Widened past webinar/conference/summit because a newsroom covering Ghana and
 * its diaspora convenes more than industry panels — a kente dinner in
 * Saint-Denis filed as a "conference" misdescribes it to every reader and to
 * schema.org. `other` is the deliberate escape hatch: an honest catch-all is
 * better than forcing the nearest wrong label, and keeping the set closed is
 * what lets the UI translate and icon each one.
 */
var eventTypes = []EventType{
	EventWebinar, EventConference, EventSummit, EventWorkshop, EventCultural,
	EventFestival, EventConcert, EventScreening, EventCommunity, EventOther,
}

// EventTypes returns the accepted types. The slice is copied so a caller
// cannot quietly widen the domain's own vocabulary.
func EventTypes() []EventType { return append([]EventType(nil), eventTypes...) }

var (
	ErrInvalidEventType       = errors.New("event type is not one of the supported kinds")
	ErrInvalidEventMode       = errors.New("event mode must be online, in_person or hybrid")
	ErrEmptyEventTitle        = errors.New("event title cannot be empty")
	ErrEmptyEventSummary      = errors.New("event summary cannot be empty")
	ErrInvalidEventIdentity   = errors.New("event slug and locale cannot be empty")
	ErrInvalidEventWindow     = errors.New("event end must be after its start")
	ErrEmptyEventTimezone     = errors.New("event timezone cannot be empty")
	ErrEventNeedsVenue        = errors.New("in-person and hybrid events require a venue")
	ErrInvalidRegistrationURL = errors.New("event registration URL must use HTTPS")
	ErrEventAlreadyEnded      = errors.New("an ended event cannot be published")
	ErrEventSlugFrozen        = errors.New("a published event keeps its slug")
	ErrEventStillPublished    = errors.New("unpublish an event before deleting it")
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

// HasBeenPublished stays true after an unpublish: PublishedAt is the record
// that a public URL once existed, which is what freezes the slug for good.
func (e Event) HasBeenPublished() bool { return e.state.PublishedAt != nil }

/*
 * An edit to an existing listing.
 *
 * Identity and lifecycle are taken from the stored event and NOT from the
 * caller: id, locale, createdBy, published and publishedAt are all restored
 * over whatever was submitted. A PATCH body is user input, and letting it set
 * `published` would hand anyone who can edit a way to publish without going
 * through Publish and its already-ended check.
 *
 * Locale is immutable for the same reason it is on an article: a French
 * listing is its own document, not a field someone can flip.
 *
 * The whole state is re-validated, so an edit cannot smuggle in an event that
 * NewEvent would have refused.
 */
func (e Event) Update(actor identity.Actor, next EventState) (Event, error) {
	if err := actor.Require(identity.PermArticlePublish); err != nil {
		return Event{}, err
	}

	next.ID, next.Locale, next.CreatedBy = e.state.ID, e.state.Locale, e.state.CreatedBy
	next.Published, next.PublishedAt = e.state.Published, e.state.PublishedAt

	if e.HasBeenPublished() && strings.TrimSpace(next.Slug) != e.state.Slug {
		return Event{}, ErrEventSlugFrozen
	}
	if err := validateEvent(&next); err != nil {
		return Event{}, err
	}
	next.Speakers = append([]string(nil), next.Speakers...)

	return Event{state: next}, nil
}

/*
 * Back to draft, without losing the record that it was once public.
 *
 * PublishedAt is deliberately NOT cleared: a reader who followed a link that
 * now 404s is owed an answer about when the listing existed, and the audit
 * trail reads better with it kept. Publishing again simply overwrites it.
 */
func (e Event) Unpublish(actor identity.Actor) (Event, error) {
	if err := actor.Require(identity.PermArticlePublish); err != nil {
		return Event{}, err
	}
	e.state.Published = false
	return e, nil
}

/*
 * Whether this event may be removed for good.
 *
 * A published event is refused: unpublishing takes it off the calendar and is
 * reversible, deleting is not. Requiring the two steps in order means nobody
 * removes a listing readers can currently see with one click, and it gives the
 * slug — which the unique index holds — a moment to be reconsidered.
 */
func (e Event) AssertRemovable(actor identity.Actor) error {
	if err := actor.Require(identity.PermArticlePublish); err != nil {
		return err
	}
	if e.state.Published {
		return ErrEventStillPublished
	}

	return nil
}

func validateEvent(state *EventState) error {
	state.Title, state.Slug = strings.TrimSpace(state.Title), strings.TrimSpace(state.Slug)
	state.Locale, state.Summary = strings.TrimSpace(state.Locale), strings.TrimSpace(state.Summary)
	state.Timezone, state.Venue = strings.TrimSpace(state.Timezone), strings.TrimSpace(state.Venue)
	state.City, state.RegistrationURL = strings.TrimSpace(state.City), strings.TrimSpace(state.RegistrationURL)
	if !slices.Contains(eventTypes, state.Type) {
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
