package ports

import (
	"context"
	"time"

	"github.com/kurasikapa/api/internal/domain/shared"
)

// EmbeddingKind lets retrieval providers distinguish stored documents from
// reader queries. The values are provider-neutral even when an adapter maps
// them to an upstream input_type field.
type EmbeddingKind string

const (
	EmbeddingDocument EmbeddingKind = "document"
	EmbeddingQuery    EmbeddingKind = "query"
)

// EmbeddingPort creates a retrieval vector without leaking an SDK type.
type EmbeddingPort interface {
	Embed(context.Context, string, EmbeddingKind) ([]float32, error)
}

// SemanticRecord is the durable indexing job and its eventual vector.
type SemanticRecord struct {
	ArticleID   shared.ArticleID
	RevisionID  shared.RevisionID
	Locale      string
	Title       string
	Slug        string
	Text        string
	PublishedAt time.Time
	Embedding   []float32
	Model       string
	Attempts    int
	LastError   string
	Active      bool
}

// SemanticHit is a ranked article identity. Article visibility is deliberately
// not trusted here; the application reloads the source aggregates before a hit
// crosses the public boundary.
type SemanticHit struct {
	ArticleID shared.ArticleID
	Score     float64
}

// SemanticRepository owns indexing state and vector retrieval.
type SemanticRepository interface {
	Queue(context.Context, SemanticRecord) error
	IsCurrent(context.Context, shared.ArticleID, shared.RevisionID) (bool, error)
	Deactivate(context.Context, shared.ArticleID) error
	ListPending(context.Context, int) ([]SemanticRecord, error)
	MarkReady(context.Context, shared.ArticleID, shared.RevisionID, []float32, string) error
	MarkFailed(context.Context, shared.ArticleID, shared.RevisionID, string) error
	ReadyVector(context.Context, shared.ArticleID) ([]float32, error)
	Similar(context.Context, []float32, string, shared.ArticleID, int) ([]SemanticHit, error)
}
