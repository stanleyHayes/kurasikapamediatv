package editorial

import (
	"context"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
)

type QueueSemanticResult struct {
	Queued  int `json:"queued"`
	Current int `json:"current"`
}

type QueueSemanticInventory struct{ deps Deps }

func NewQueueSemanticInventory(deps Deps) QueueSemanticInventory {
	return QueueSemanticInventory{deps: deps}
}

func (u QueueSemanticInventory) Execute(ctx context.Context, locales []string) (QueueSemanticResult, error) {
	result := QueueSemanticResult{}
	for _, locale := range locales {
		after := ""
		for {
			page, err := u.deps.Articles.ListPublished(ctx, ports.PublishedQuery{
				Locale: locale, Cursor: ports.Cursor{After: after, Limit: 100},
			})
			if err != nil {
				return result, err
			}
			if err := u.queuePage(ctx, page.Items, &result); err != nil {
				return result, err
			}
			if page.NextCursor == "" || page.NextCursor == after {
				break
			}
			after = page.NextCursor
		}
	}
	return result, nil
}

func (u QueueSemanticInventory) queuePage(ctx context.Context, articles []editorial.Article, result *QueueSemanticResult) error {
	for _, article := range articles {
		revisionID, ok := article.ApprovedRevisionID()
		if !ok {
			continue
		}
		current, err := u.deps.Semantic.IsCurrent(ctx, article.ID(), revisionID)
		if err != nil {
			return err
		}
		if current {
			result.Current++
			continue
		}
		if err := queueSemanticArticle(ctx, u.deps, article); err != nil {
			return err
		}
		result.Queued++
	}
	return nil
}
