package editorial

import (
	"context"
	"fmt"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

const historyExcerpt = 160

// RevisionList is an article's history, newest first.
type RevisionList struct {
	Items []RevisionView `json:"items"`
}

// ListRevisions returns the full history. Authorised like reading the draft.
type ListRevisions struct{ deps Deps }

// NewListRevisions wires the use case.
func NewListRevisions(deps Deps) ListRevisions { return ListRevisions{deps: deps} }

// HistoryInput names the article whose history to load.
type HistoryInput struct {
	Actor     identity.Actor
	ArticleID shared.ArticleID
}

// Execute lists revisions, newest first.
func (uc ListRevisions) Execute(ctx context.Context, in HistoryInput) (RevisionList, error) {
	article, err := uc.deps.Articles.FindByID(ctx, in.ArticleID)
	if err != nil {
		return RevisionList{}, err
	}
	if err := article.AssertReadable(in.Actor); err != nil {
		return RevisionList{}, err
	}

	history, err := uc.deps.Revisions.ListFor(ctx, article.ID())
	if err != nil {
		return RevisionList{}, err
	}

	items := make([]RevisionView, 0, len(history))
	for i := len(history) - 1; i >= 0; i-- {
		items = append(items, revisionView(history[i], historyExcerpt))
	}

	return RevisionList{Items: items}, nil
}

// RestoreResult is the new revision written forward.
type RestoreResult struct {
	ID  shared.RevisionID `json:"id"`
	Seq int               `json:"seq"`
}

// RestoreRevision brings older text back as a NEW revision, not a rewind.
type RestoreRevision struct{ deps Deps }

// NewRestoreRevision wires the use case.
func NewRestoreRevision(deps Deps) RestoreRevision { return RestoreRevision{deps: deps} }

// RestoreInput names the article and the revision to bring forward.
type RestoreInput struct {
	Actor      identity.Actor
	ArticleID  shared.ArticleID
	RevisionID shared.RevisionID
}

// Execute writes the restored text forward.
func (uc RestoreRevision) Execute(ctx context.Context, in RestoreInput) (RestoreResult, error) {
	article, err := uc.deps.Articles.FindByID(ctx, in.ArticleID)
	if err != nil {
		return RestoreResult{}, err
	}
	if err := article.AssertEditable(in.Actor); err != nil {
		return RestoreResult{}, err
	}

	history, err := uc.deps.Revisions.ListFor(ctx, article.ID())
	if err != nil {
		return RestoreResult{}, err
	}

	source, latest, ok := findRestorePair(history, in.RevisionID)
	if !ok {
		return RestoreResult{}, fmt.Errorf("%w: %s", ports.ErrNotFound, in.RevisionID)
	}

	restored, err := source.RestoreOnto(
		shared.RevisionID(uc.deps.IDs.NewID()),
		latest,
		in.Actor.ID(),
		uc.deps.Clock.Now(),
	)
	if err != nil {
		return RestoreResult{}, err
	}
	if err := uc.deps.Revisions.Append(ctx, restored); err != nil {
		return RestoreResult{}, fmt.Errorf("appending restored revision: %w", err)
	}

	return RestoreResult{ID: restored.ID(), Seq: restored.Seq()}, nil
}

func findRestorePair(
	history []editorial.Revision,
	want shared.RevisionID,
) (editorial.Revision, editorial.Revision, bool) {
	if len(history) == 0 {
		return editorial.Revision{}, editorial.Revision{}, false
	}

	var source editorial.Revision
	found := false
	for _, r := range history {
		if r.ID() == want {
			source = r
			found = true
			break
		}
	}
	if !found {
		return editorial.Revision{}, editorial.Revision{}, false
	}

	return source, history[len(history)-1], true
}
