// Package mongo implements the repository ports against MongoDB.
//
// The documents here mirror packages/adapter-mongo/src/documents.ts field for
// field, deliberately and non-negotiably. During the ADR-0009 migration both
// implementations read and write the SAME collections in the SAME cluster, so
// a field renamed on one side and not the other is not a refactor — it is data
// loss with a passing test suite on each side.
//
// If you change a struct tag here, change the TypeScript interface in the same
// commit, or the migration stops being reversible.
package mongo

import "time"

// Collection names, matching documents.ts exactly.
const (
	CollArticles        = "articles"
	CollRevisions       = "article_revisions"
	CollRoleAssignments = "role_assignments"
	CollCategories      = "categories"
	CollBookmarks       = "bookmarks"
	CollSocialPosts     = "social_posts"
)

// articleDoc is the shape on disk. Deliberately not the domain shape.
//
// `_id` is our own branded id string, not an ObjectId — ids are minted by the
// IDs port so the domain owns identity, and a meaningful id survives an export.
// (Better Auth's `user` collection is the exception: it lets Mongo mint an
// ObjectId, which is why the directory adapter has to convert.)
type articleDoc struct {
	ID                 string               `bson:"_id"`
	FamilyID           string               `bson:"familyId"`
	Locale             string               `bson:"locale"`
	Slug               string               `bson:"slug"`
	Title              string               `bson:"title"`
	AuthorID           string               `bson:"authorId"`
	CategoryID         string               `bson:"categoryId"`
	TagIDs             []string             `bson:"tagIds"`
	Hero               *articleHeroDoc      `bson:"hero,omitempty"`
	Narration          *articleNarrationDoc `bson:"narration,omitempty"`
	Status             string               `bson:"status"`
	ApprovedRevisionID *string              `bson:"approvedRevisionId"`
	ScheduledAt        *time.Time           `bson:"scheduledAt"`
	PublishedAt        *time.Time           `bson:"publishedAt"`
	// UpdatedAt is persistence metadata, not a domain concept. It exists so
	// the CMS can sort "my drafts" by recency without the domain modelling a
	// field no business rule reads.
	UpdatedAt time.Time `bson:"updatedAt"`
}

type articleNarrationDoc struct {
	AssetID          string  `bson:"assetId"`
	SourceRevisionID string  `bson:"sourceRevisionId"`
	SecureURL        string  `bson:"secureUrl"`
	MIMEType         string  `bson:"mimeType"`
	DurationSeconds  float64 `bson:"durationSeconds"`
	Voice            string  `bson:"voice"`
}

type articleHeroDoc struct {
	AssetID   string `bson:"assetId"`
	SecureURL string `bson:"secureUrl"`
	AltText   string `bson:"altText"`
	Caption   string `bson:"caption"`
	Credit    string `bson:"credit"`
	Width     int    `bson:"width"`
	Height    int    `bson:"height"`
}

type revisionDoc struct {
	ID        string    `bson:"_id"`
	ArticleID string    `bson:"articleId"`
	Seq       int       `bson:"seq"`
	Title     string    `bson:"title"`
	Body      string    `bson:"body"`
	AuthorID  string    `bson:"authorId"`
	CreatedAt time.Time `bson:"createdAt"`
}

type categoryDoc struct {
	ID       string            `bson:"_id"`
	ParentID *string           `bson:"parentId"`
	Slugs    map[string]string `bson:"slugs"`
	Names    map[string]string `bson:"names"`
	// Descriptions is omitempty because documents written before the field
	// existed simply do not carry it, and an absent map reads the same as
	// "no description in any locale".
	Descriptions map[string]string `bson:"descriptions,omitempty"`
	Order        int               `bson:"order"`
}

type roleAssignmentDoc struct {
	// ID is the auth library's user id, as a hex string. Roles are stored
	// against it, never inside the user document — that collection belongs to
	// Better Auth and we only ever read it.
	ID    string   `bson:"_id"`
	Roles []string `bson:"roles"`
}
