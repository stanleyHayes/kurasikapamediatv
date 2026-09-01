package shared

import "errors"

// ErrEmptyID is returned when an identifier would be blank.
//
// A blank id is never a valid reference, and letting one through means a query
// that matches nothing while looking like it matched something.
var ErrEmptyID = errors.New("id: cannot be empty")

// Distinct named types rather than bare strings.
//
// Go's type system will not let an ArticleID be passed where a RevisionID is
// expected, which is the whole point: ApproveArticle takes both, and swapping
// them would silently approve the wrong thing. The TypeScript side gets the
// same protection through branded types.
type (
	// ArticleID identifies one article in one locale.
	ArticleID string
	// FamilyID ties an article's translations together. A French article is
	// its own document; the family is what says they are the same story.
	FamilyID string
	// RevisionID identifies one immutable snapshot of an article's text.
	RevisionID string
	// CategoryID identifies a section.
	CategoryID string
	// TagID identifies a tag.
	TagID string
	// UserID is Better Auth's user id, as a hex string.
	//
	// Better Auth lets Mongo mint the key, so the stored `_id` is an ObjectId
	// while its API reports `user.id` as hex. Anything joining to that
	// collection must convert; treating the two as interchangeable produced a
	// silent, total failure of role lookup once already.
	UserID string
	// StaffProfileID identifies one public newsroom identity.
	StaffProfileID string
	// AssetID identifies a media asset.
	AssetID string
	// PresenterID identifies a public station presenter.
	PresenterID string
	// ProgrammeID identifies a recurring television programme.
	ProgrammeID string
	// ScheduleSlotID identifies one airing of a programme.
	ScheduleSlotID string
	// PodcastID identifies one podcast series.
	PodcastID string
	// EpisodeID identifies one instalment of a podcast.
	EpisodeID string
	// GalleryID identifies one curated photo or video collection.
	GalleryID string
	// NarrationJobID identifies one article-to-audio generation attempt.
	NarrationJobID string
	// RecordingImportID identifies one IVS recording promotion attempt.
	RecordingImportID string
	// MembershipPlanID identifies one purchasable membership tier.
	MembershipPlanID string
	// SubscriptionID identifies one reader membership lifecycle.
	SubscriptionID string
	// DonationID identifies one supporter contribution.
	DonationID string
	// AdCampaignID identifies one advertiser-funded campaign.
	AdCampaignID string
	// AdEventID identifies one immutable impression or click event.
	AdEventID string
	// ProductID identifies one item sold by the publisher.
	ProductID string
	// ProductOrderID identifies one product checkout lifecycle.
	ProductOrderID string
	// ClassifiedID identifies one paid community listing.
	ClassifiedID string
	// AffiliateLinkID identifies one disclosed partner recommendation.
	AffiliateLinkID string
)

func (id ArticleID) String() string         { return string(id) }
func (id FamilyID) String() string          { return string(id) }
func (id RevisionID) String() string        { return string(id) }
func (id CategoryID) String() string        { return string(id) }
func (id TagID) String() string             { return string(id) }
func (id UserID) String() string            { return string(id) }
func (id StaffProfileID) String() string    { return string(id) }
func (id AssetID) String() string           { return string(id) }
func (id PresenterID) String() string       { return string(id) }
func (id ProgrammeID) String() string       { return string(id) }
func (id ScheduleSlotID) String() string    { return string(id) }
func (id PodcastID) String() string         { return string(id) }
func (id EpisodeID) String() string         { return string(id) }
func (id GalleryID) String() string         { return string(id) }
func (id NarrationJobID) String() string    { return string(id) }
func (id RecordingImportID) String() string { return string(id) }
func (id MembershipPlanID) String() string  { return string(id) }
func (id SubscriptionID) String() string    { return string(id) }
func (id DonationID) String() string        { return string(id) }
func (id AdCampaignID) String() string      { return string(id) }
func (id AdEventID) String() string         { return string(id) }
func (id ProductID) String() string         { return string(id) }
func (id ProductOrderID) String() string    { return string(id) }
func (id ClassifiedID) String() string      { return string(id) }
func (id AffiliateLinkID) String() string   { return string(id) }

// NewArticleID validates and wraps an article identifier.
func NewArticleID(raw string) (ArticleID, error) {
	if raw == "" {
		return "", ErrEmptyID
	}

	return ArticleID(raw), nil
}

// NewFamilyID validates and wraps a family identifier.
func NewFamilyID(raw string) (FamilyID, error) {
	if raw == "" {
		return "", ErrEmptyID
	}

	return FamilyID(raw), nil
}

// NewRevisionID validates and wraps a revision identifier.
func NewRevisionID(raw string) (RevisionID, error) {
	if raw == "" {
		return "", ErrEmptyID
	}

	return RevisionID(raw), nil
}

// NewCategoryID validates and wraps a category identifier.
func NewCategoryID(raw string) (CategoryID, error) {
	if raw == "" {
		return "", ErrEmptyID
	}

	return CategoryID(raw), nil
}

// NewUserID validates and wraps a user identifier.
func NewUserID(raw string) (UserID, error) {
	if raw == "" {
		return "", ErrEmptyID
	}

	return UserID(raw), nil
}
