package editorial

import (
	"context"
	"strings"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
)

func queueSemanticArticle(ctx context.Context, deps Deps, article editorial.Article) error {
	if deps.Semantic == nil {
		return nil
	}
	revisionID, ok := article.ApprovedRevisionID()
	if !ok {
		return nil
	}
	revision, err := deps.Revisions.FindByID(ctx, revisionID)
	if err != nil {
		return err
	}
	publishedAt, ok := article.PublishedAt()
	if !ok {
		return nil
	}
	text := strings.TrimSpace(revision.Title() + "\n\n" + revision.Body())
	return deps.Semantic.Queue(ctx, ports.SemanticRecord{
		ArticleID: article.ID(), RevisionID: revision.ID(), Locale: article.Locale(),
		Title: article.Title(), Slug: article.Slug().String(), Text: text,
		PublishedAt: publishedAt, Active: true,
	})
}
