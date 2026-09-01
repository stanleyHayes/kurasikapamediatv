package editorial

import (
	"context"
	"strings"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type SemanticSearchInput struct {
	Terms  string
	Locale string
	Limit  int
}

type SemanticSearch struct {
	deps       Deps
	embeddings ports.EmbeddingPort
	repository ports.SemanticRepository
}

func NewSemanticSearch(deps Deps, embeddings ports.EmbeddingPort, repository ports.SemanticRepository) SemanticSearch {
	return SemanticSearch{deps: deps, embeddings: embeddings, repository: repository}
}

func (u SemanticSearch) Execute(ctx context.Context, in SemanticSearchInput) ([]ListedPublic, error) {
	terms := strings.TrimSpace(in.Terms)
	if len([]rune(terms)) < 2 {
		return []ListedPublic{}, nil
	}
	vector, err := u.embeddings.Embed(ctx, terms, ports.EmbeddingQuery)
	if err != nil {
		return nil, err
	}
	return u.resolve(ctx, vector, in.Locale, "", clampWithin(in.Limit, 20, 50))
}

func (u SemanticSearch) resolve(ctx context.Context, vector []float32, locale string, exclude shared.ArticleID, limit int) ([]ListedPublic, error) {
	hits, err := u.repository.Similar(ctx, vector, locale, exclude, limit*2)
	if err != nil {
		return nil, err
	}
	ids := make([]shared.ArticleID, 0, len(hits))
	for _, hit := range hits {
		ids = append(ids, hit.ArticleID)
	}
	articles, err := u.deps.Articles.FindManyByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	byID := make(map[shared.ArticleID]editorial.Article, len(articles))
	for _, article := range articles {
		byID[article.ID()] = article
	}
	ordered := make([]editorial.Article, 0, limit)
	for _, hit := range hits {
		if hit.ArticleID == exclude {
			continue
		}
		article, ok := byID[hit.ArticleID]
		if !ok || article.Locale() != locale || !editorial.IsPubliclyVisible(article.Status()) {
			continue
		}
		ordered = append(ordered, article)
		if len(ordered) == limit {
			break
		}
	}
	return withApprovedExcerpts(ctx, u.deps.Revisions, ordered)
}

type SemanticRelated struct {
	deps       Deps
	repository ports.SemanticRepository
}

func NewSemanticRelated(deps Deps, repository ports.SemanticRepository) SemanticRelated {
	return SemanticRelated{deps: deps, repository: repository}
}

func (u SemanticRelated) Execute(ctx context.Context, id shared.ArticleID, requested int) ([]ListedPublic, error) {
	article, err := u.deps.Articles.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !editorial.IsPubliclyVisible(article.Status()) {
		return []ListedPublic{}, nil
	}
	vector, err := u.repository.ReadyVector(ctx, id)
	if err != nil {
		return nil, err
	}
	search := SemanticSearch{deps: u.deps, repository: u.repository}
	return search.resolve(ctx, vector, article.Locale(), id, clampWithin(requested, 4, 12))
}
