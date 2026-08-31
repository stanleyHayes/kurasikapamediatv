// Package ports declares what the application needs from the outside world.
//
// Interfaces are declared here, by the consumer, and implemented in
// internal/adapter. That direction is the whole hexagon: the application says
// "I need to load an article by slug", and MongoDB's job is to satisfy that —
// not the other way round.
//
// Nothing in this package mentions a driver, a wire format or a vendor. If an
// interface here starts leaking bson.M, an *http.Response or a Cloudinary
// type, the boundary has already been crossed.
package ports

import (
	"context"
	"errors"
	"time"

	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

// ErrNotFound is returned when a lookup finds nothing.
//
// One sentinel rather than one per repository: callers almost always want to
// distinguish "absent" from "broken", and rarely need to know which collection
// was absent.
var (
	ErrNotFound              = errors.New("not found")
	ErrInvalidPaymentWebhook = errors.New("invalid payment webhook")
)

// Clock supplies the current time.
//
// Injected rather than read from the package, so a test can control it. A test
// that cannot control time is not a test — it is a coin flip that usually
// lands the same way.
type Clock interface {
	Now() time.Time
}

// IDs mints new identifiers.
type IDs interface {
	NewID() string
}

// Event is something that happened, stated in the past tense.
type Event struct {
	Name       string
	ArticleID  shared.ArticleID
	Locale     string
	Slug       string
	OccurredAt time.Time
	// Detail carries event-specific fields. Deliberately a plain map: the
	// alternative is a type per event, and the only consumer today is cache
	// invalidation, which reads two fields.
	Detail map[string]string
}

// EventBus publishes domain events to whoever is listening.
//
// Best-effort by contract. Callers that have already committed a state change
// must not fail because delivery did, so they discard the error — which means
// an implementation is REQUIRED to report its own failures (log, metric,
// dead-letter). Returning an error nobody reads and reporting nothing is how a
// silent failure gets built out of two reasonable-looking halves.
type EventBus interface {
	Publish(ctx context.Context, event Event) error
}

// Cursor is keyset pagination input.
//
// Keyset, never offset. An offset query re-scans everything it skips, and on a
// feed that grows at the top it also silently repeats and drops rows as the
// reader pages.
type Cursor struct {
	// After is the last key from the previous page. Empty means the first page.
	After string
	Limit int
}

// Page is one page of results plus the key to fetch the next.
type Page[T any] struct {
	Items []T
	// NextCursor is empty when there is no further page.
	NextCursor string
}

// PublishedQuery selects articles a reader may see.
type PublishedQuery struct {
	Locale     string
	CategoryID shared.CategoryID
	Cursor     Cursor
}

// AuthoredQuery selects one author's own work.
type AuthoredQuery struct {
	AuthorID shared.UserID
	Cursor   Cursor
}

// ArticleRepository stores and retrieves articles.
type ArticleRepository interface {
	FindByID(ctx context.Context, id shared.ArticleID) (editorial.Article, error)
	FindBySlug(ctx context.Context, slug, locale string) (editorial.Article, error)
	FindManyByIDs(ctx context.Context, ids []shared.ArticleID) ([]editorial.Article, error)
	// SlugTaken reports whether a slug is already used in a locale. Separate
	// from FindBySlug because the caller wants a yes/no, and loading a whole
	// aggregate to answer it is waste on every draft save.
	SlugTaken(ctx context.Context, slug, locale string) (bool, error)
	ListPublished(ctx context.Context, q PublishedQuery) (Page[editorial.Article], error)
	ListAuthoredBy(ctx context.Context, q AuthoredQuery) (Page[editorial.Article], error)
	ListAwaitingReview(ctx context.Context, cursor Cursor) (Page[editorial.Article], error)
	// ListDueForPublication returns scheduled articles whose time has come.
	ListDueForPublication(ctx context.Context, now time.Time) ([]editorial.Article, error)
	Save(ctx context.Context, article editorial.Article) error
}

// RevisionRepository stores article history. Append-only by contract: there is
// deliberately no Update and no Delete.
type RevisionRepository interface {
	FindByID(ctx context.Context, id shared.RevisionID) (editorial.Revision, error)
	FindLatest(ctx context.Context, articleID shared.ArticleID) (editorial.Revision, error)
	FindManyByIDs(ctx context.Context, ids []shared.RevisionID) ([]editorial.Revision, error)
	// FindLatestForArticles is the batch form, so a listing is two queries
	// rather than one per row.
	FindLatestForArticles(ctx context.Context, ids []shared.ArticleID) ([]editorial.Revision, error)
	ListFor(ctx context.Context, articleID shared.ArticleID) ([]editorial.Revision, error)
	Append(ctx context.Context, revision editorial.Revision) error
}

// CategoryRepository stores sections.
type CategoryRepository interface {
	FindBySlug(ctx context.Context, slug, locale string) (editorial.Category, error)
	ListForLocale(ctx context.Context, locale string) ([]editorial.Category, error)
	Save(ctx context.Context, category editorial.Category) error
}

// RoleRepository holds our own role grants.
//
// Ours, not the auth library's. Better Auth says who someone is; this is what
// says what they may do, and keeping it in a collection we own is what lets a
// revocation land on the very next request.
type RoleRepository interface {
	RolesFor(ctx context.Context, userID shared.UserID) ([]identity.Role, error)
	Replace(ctx context.Context, userID shared.UserID, roles []identity.Role) error
}

// DirectoryUser is a person as the roles screen shows them.
type DirectoryUser struct {
	ID    shared.UserID
	Email string
	Name  string
	Roles []identity.Role
}

// UserDirectory reads the auth library's user collection, and only reads it.
type UserDirectory interface {
	List(ctx context.Context, cursor Cursor) (Page[DirectoryUser], error)
}

type PresenterRepository interface {
	FindByID(context.Context, shared.PresenterID) (media.Presenter, error)
	ListPublished(context.Context, string) ([]media.Presenter, error)
	Save(context.Context, media.Presenter) error
}

type ProgrammeRepository interface {
	FindByID(context.Context, shared.ProgrammeID) (media.Programme, error)
	ListPublished(context.Context, string) ([]media.Programme, error)
	Save(context.Context, media.Programme) error
}

type ScheduleRepository interface {
	ListUpcoming(context.Context, string, time.Time, int) ([]media.ScheduleSlot, error)
	ListReplays(context.Context, string, int) ([]media.ScheduleSlot, error)
	Save(context.Context, media.ScheduleSlot) error
}

type AssetRepository interface {
	FindByID(context.Context, shared.AssetID) (media.Asset, error)
	List(context.Context, string, int) ([]media.Asset, error)
	Save(context.Context, media.Asset) error
}

type PodcastRepository interface {
	FindByID(context.Context, shared.PodcastID) (media.Podcast, error)
	ListPublished(context.Context, string, int) ([]media.Podcast, error)
	Save(context.Context, media.Podcast) error
}

type EpisodeRepository interface {
	FindByID(context.Context, shared.EpisodeID) (media.Episode, error)
	ListPublished(context.Context, shared.PodcastID, int) ([]media.Episode, error)
	Save(context.Context, media.Episode) error
}

type GalleryRepository interface {
	FindByID(context.Context, shared.GalleryID) (media.Gallery, error)
	ListPublished(context.Context, string, int) ([]media.Gallery, error)
	Save(context.Context, media.Gallery) error
}

type UploadRequest struct {
	AssetID   shared.AssetID
	Kind      media.AssetKind
	Timestamp time.Time
}
type UploadTicket struct {
	URL, APIKey, Signature, PublicID, ResourceType, Folder string
	Timestamp                                              int64
}
type UploadReceipt struct {
	PublicID, SecureURL, Signature string
	Version, Bytes                 int64
	Width, Height                  int
	DurationSeconds                float64
}
type MediaUploadPort interface {
	SignUpload(UploadRequest) (UploadTicket, error)
	VerifyUpload(UploadReceipt) error
}

type MembershipPlanRepository interface {
	FindByID(context.Context, shared.MembershipPlanID) (revenue.MembershipPlan, error)
	ListActive(context.Context) ([]revenue.MembershipPlan, error)
	Save(context.Context, revenue.MembershipPlan) error
}

type SubscriptionRepository interface {
	FindByID(context.Context, shared.SubscriptionID) (revenue.Subscription, error)
	FindEntitledForReader(context.Context, shared.UserID, time.Time) (revenue.Subscription, error)
	ListRecent(context.Context, time.Time, int) ([]revenue.Subscription, error)
	Save(context.Context, revenue.Subscription) error
}

type DonationRepository interface {
	FindByID(context.Context, shared.DonationID) (revenue.Donation, error)
	ListRecent(context.Context, time.Time, int) ([]revenue.Donation, error)
	Save(context.Context, revenue.Donation) error
}

type CheckoutRequest struct {
	Reference string
	Purpose   string
	Amount    revenue.Money
	Interval  revenue.BillingInterval
	Email     string
	ReturnURL string
}

type CheckoutSession struct {
	Provider    revenue.PaymentProvider
	ProviderRef string
	CheckoutURL string
}

type PaymentGateway interface {
	StartCheckout(context.Context, CheckoutRequest) (CheckoutSession, error)
}

type VerifiedPayment struct {
	Purpose, ResourceID, PaymentRef string
}

type PaymentWebhookVerifier interface {
	Verify(revenue.PaymentProvider, string, []byte, time.Time) (VerifiedPayment, error)
}
