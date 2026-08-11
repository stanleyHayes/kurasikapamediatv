// Package editorial orchestrates the publishing use cases.
//
// Each use case loads what the domain needs, asks the domain to decide, and
// writes the result. It never decides anything itself — if there is an `if`
// here that encodes a business rule rather than a sequencing concern, the rule
// is in the wrong ring.
package editorial

import (
	"context"
	"errors"
	"fmt"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

// Errors the editorial use cases raise.
var (
	// ErrSlugTaken means another article already occupies that URL in the locale.
	ErrSlugTaken = errors.New("slug is already in use for this locale")
	// ErrUntitled means the title yields nothing that could be a URL.
	ErrUntitled = errors.New("title contains nothing to build a slug from")
)

// Deps is everything the editorial use cases need from outside.
//
// One struct rather than a parameter per constructor: these use cases share
// most of their dependencies, and threading six arguments through each is how
// a wiring mistake hides.
type Deps struct {
	Articles   ports.ArticleRepository
	Revisions  ports.RevisionRepository
	Categories ports.CategoryRepository
	Clock      ports.Clock
	IDs        ports.IDs
	Events     ports.EventBus
}

// CreateDraftInput is a request to start a new article.
type CreateDraftInput struct {
	Actor    identity.Actor
	Locale   string
	Title    string
	Body     string
	Category shared.CategoryID
	// FamilyID ties this to an existing story's other translations. Empty
	// starts a new family — a genuinely new story rather than a translation.
	FamilyID shared.FamilyID
}

// CreateDraft starts an article and its first revision.
type CreateDraft struct {
	deps Deps
}

// NewCreateDraft wires the use case.
func NewCreateDraft(deps Deps) CreateDraft { return CreateDraft{deps: deps} }

// Execute creates the article and its opening revision.
//
// The revision is written before the article. If the process dies between the
// two, the result is an orphaned revision — invisible, harmless, and
// collectable. The other order would leave an article whose approved text does
// not exist, which is a reader-facing hole.
func (uc CreateDraft) Execute(ctx context.Context, in CreateDraftInput) (editorial.Article, error) {
	if err := in.Actor.Require(identity.PermArticleDraft); err != nil {
		return editorial.Article{}, err
	}

	slug := shared.SlugFrom(in.Title)
	if slug.IsZero() {
		return editorial.Article{}, fmt.Errorf("%w: %q", ErrUntitled, in.Title)
	}

	taken, err := uc.deps.Articles.SlugTaken(ctx, slug.String(), in.Locale)
	if err != nil {
		return editorial.Article{}, fmt.Errorf("checking slug: %w", err)
	}
	if taken {
		return editorial.Article{}, fmt.Errorf("%w: %s (%s)", ErrSlugTaken, slug, in.Locale)
	}

	now := uc.deps.Clock.Now()
	articleID := shared.ArticleID(uc.deps.IDs.NewID())

	familyID := in.FamilyID
	if familyID == "" {
		familyID = shared.FamilyID(uc.deps.IDs.NewID())
	}

	revision := editorial.NewRevision(
		shared.RevisionID(uc.deps.IDs.NewID()),
		articleID, nil, in.Title, in.Body, in.Actor.ID(), now,
	)
	if err := uc.deps.Revisions.Append(ctx, revision); err != nil {
		return editorial.Article{}, fmt.Errorf("appending first revision: %w", err)
	}

	article := editorial.Reconstitute(editorial.ArticleState{
		ID:         articleID,
		FamilyID:   familyID,
		Locale:     in.Locale,
		Slug:       slug,
		Title:      in.Title,
		AuthorID:   in.Actor.ID(),
		CategoryID: in.Category,
		Status:     editorial.StatusDraft,
	})

	if err := uc.deps.Articles.Save(ctx, article); err != nil {
		return editorial.Article{}, fmt.Errorf("saving article: %w", err)
	}

	// No event. A draft is not news, and publishing one would invalidate
	// caches for something no reader can see.
	return article, nil
}
