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

// UpdateDraftInput is a request to save editor changes as a new revision.
type UpdateDraftInput struct {
	Actor     identity.Actor
	ArticleID shared.ArticleID
	Title     string
	Body      string
}

// UpdateDraftResult is what the editor needs after a save.
type UpdateDraftResult struct {
	RevisionID shared.RevisionID `json:"revisionId"`
	Seq        int               `json:"seq"`
	Slug       string            `json:"slug"`
}

// UpdateDraft saves editor changes as a new revision.
//
// Autosave calls this, so it runs often. It appends rather than overwrites:
// history is the product feature, and the cost of a row per save is trivial
// next to an editor losing an afternoon's work.
//
// No event is published. A draft save changes nothing a reader can see.
type UpdateDraft struct {
	deps Deps
}

// NewUpdateDraft wires the use case.
func NewUpdateDraft(deps Deps) UpdateDraft { return UpdateDraft{deps: deps} }

// Execute appends a revision and updates the article title/slug when allowed.
func (uc UpdateDraft) Execute(ctx context.Context, in UpdateDraftInput) (UpdateDraftResult, error) {
	article, err := uc.deps.Articles.FindByID(ctx, in.ArticleID)
	if err != nil {
		return UpdateDraftResult{}, err
	}

	retitled, err := article.Retitle(in.Title, in.Actor)
	if err != nil {
		return UpdateDraftResult{}, err
	}

	if err := uc.guardSlugFree(ctx, retitled); err != nil {
		return UpdateDraftResult{}, err
	}

	previous, err := uc.deps.Revisions.FindLatest(ctx, article.ID())
	var previousPtr *editorial.Revision
	if err == nil {
		previousPtr = &previous
	} else if !errors.Is(err, ports.ErrNotFound) {
		return UpdateDraftResult{}, fmt.Errorf("loading latest revision: %w", err)
	}

	revision := editorial.NewRevision(
		shared.RevisionID(uc.deps.IDs.NewID()),
		article.ID(),
		previousPtr,
		in.Title,
		in.Body,
		in.Actor.ID(),
		uc.deps.Clock.Now(),
	)

	if err := uc.deps.Articles.Save(ctx, retitled); err != nil {
		return UpdateDraftResult{}, fmt.Errorf("saving article: %w", err)
	}
	if err := uc.deps.Revisions.Append(ctx, revision); err != nil {
		return UpdateDraftResult{}, fmt.Errorf("appending revision: %w", err)
	}

	return UpdateDraftResult{
		RevisionID: revision.ID(),
		Seq:        revision.Seq(),
		Slug:       retitled.Slug().String(),
	}, nil
}

// guardSlugFree refuses a rename that would steal another article's URL.
//
// Renaming a draft to the slug it already has is not a clash — FindBySlug would
// return self, and SlugTaken alone would falsely refuse that no-op.
func (uc UpdateDraft) guardSlugFree(ctx context.Context, article editorial.Article) error {
	clash, err := uc.deps.Articles.FindBySlug(ctx, article.Slug().String(), article.Locale())
	if errors.Is(err, ports.ErrNotFound) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("checking slug: %w", err)
	}
	if clash.ID() != article.ID() {
		return fmt.Errorf("%w: %s (%s)", ErrSlugTaken, article.Slug(), article.Locale())
	}

	return nil
}
