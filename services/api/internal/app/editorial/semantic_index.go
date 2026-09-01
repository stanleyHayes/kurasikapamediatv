package editorial

import (
	"context"

	"github.com/kurasikapa/api/internal/app/ports"
)

const semanticBatchMax = 100

type ProcessSemanticResult struct {
	Indexed int      `json:"indexed"`
	Failed  int      `json:"failed"`
	Errors  []string `json:"errors"`
}

type ProcessSemanticIndex struct {
	repository ports.SemanticRepository
	embeddings ports.EmbeddingPort
	model      string
}

func NewProcessSemanticIndex(repository ports.SemanticRepository, embeddings ports.EmbeddingPort, model string) ProcessSemanticIndex {
	return ProcessSemanticIndex{repository: repository, embeddings: embeddings, model: model}
}

func (u ProcessSemanticIndex) Execute(ctx context.Context, requested int) (ProcessSemanticResult, error) {
	limit := requested
	if limit < 1 || limit > semanticBatchMax {
		limit = semanticBatchMax
	}
	records, err := u.repository.ListPending(ctx, limit)
	if err != nil {
		return ProcessSemanticResult{}, err
	}
	result := ProcessSemanticResult{Errors: []string{}}
	for _, record := range records {
		vector, embedErr := u.embeddings.Embed(ctx, record.Text, ports.EmbeddingDocument)
		if embedErr != nil {
			result.Failed++
			result.Errors = append(result.Errors, record.ArticleID.String()+": "+embedErr.Error())
			if err := u.repository.MarkFailed(ctx, record.ArticleID, record.RevisionID, embedErr.Error()); err != nil {
				return result, err
			}
			continue
		}
		if err := u.repository.MarkReady(ctx, record.ArticleID, record.RevisionID, vector, u.model); err != nil {
			return result, err
		}
		result.Indexed++
	}
	return result, nil
}
