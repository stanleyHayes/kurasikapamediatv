package testing

import (
	"context"
	"errors"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type EmbeddingFake struct {
	Vector []float32
	Err    error
	Kinds  []ports.EmbeddingKind
	Texts  []string
}

func (f *EmbeddingFake) Embed(_ context.Context, text string, kind ports.EmbeddingKind) ([]float32, error) {
	f.Texts = append(f.Texts, text)
	f.Kinds = append(f.Kinds, kind)
	return f.Vector, f.Err
}

type SemanticStore struct {
	Records       map[shared.ArticleID]ports.SemanticRecord
	Hits          []ports.SemanticHit
	Err           error
	ListErr       error
	MarkReadyErr  error
	MarkFailedErr error
	SimilarErr    error
}

func NewSemanticStore(records ...ports.SemanticRecord) *SemanticStore {
	store := &SemanticStore{Records: map[shared.ArticleID]ports.SemanticRecord{}}
	for _, record := range records {
		store.Records[record.ArticleID] = record
	}
	return store
}

func (s *SemanticStore) Queue(_ context.Context, record ports.SemanticRecord) error {
	if s.Err != nil {
		return s.Err
	}
	record.Active, record.Attempts, record.LastError = true, 0, ""
	record.Embedding = nil
	s.Records[record.ArticleID] = record
	return nil
}

func (s *SemanticStore) IsCurrent(_ context.Context, id shared.ArticleID, revision shared.RevisionID) (bool, error) {
	if s.Err != nil {
		return false, s.Err
	}
	record, ok := s.Records[id]
	return ok && record.Active && record.RevisionID == revision, nil
}

func (s *SemanticStore) Deactivate(_ context.Context, id shared.ArticleID) error {
	record := s.Records[id]
	record.Active = false
	s.Records[id] = record
	return s.Err
}

func (s *SemanticStore) ListPending(_ context.Context, limit int) ([]ports.SemanticRecord, error) {
	if s.ListErr != nil {
		return nil, s.ListErr
	}
	if s.Err != nil {
		return nil, s.Err
	}
	out := []ports.SemanticRecord{}
	for _, record := range s.Records {
		if record.Active && len(record.Embedding) == 0 && record.Attempts < 5 {
			out = append(out, record)
			if len(out) == limit {
				break
			}
		}
	}
	return out, nil
}

func (s *SemanticStore) MarkReady(_ context.Context, id shared.ArticleID, revision shared.RevisionID, vector []float32, model string) error {
	if s.MarkReadyErr != nil {
		return s.MarkReadyErr
	}
	record := s.Records[id]
	if record.RevisionID != revision {
		return errors.New("stale revision")
	}
	record.Embedding, record.Model, record.LastError = vector, model, ""
	s.Records[id] = record
	return s.Err
}

func (s *SemanticStore) MarkFailed(_ context.Context, id shared.ArticleID, revision shared.RevisionID, reason string) error {
	if s.MarkFailedErr != nil {
		return s.MarkFailedErr
	}
	record := s.Records[id]
	if record.RevisionID != revision {
		return errors.New("stale revision")
	}
	record.Attempts++
	record.LastError = reason
	s.Records[id] = record
	return s.Err
}

func (s *SemanticStore) ReadyVector(_ context.Context, id shared.ArticleID) ([]float32, error) {
	record, ok := s.Records[id]
	if !ok || !record.Active || len(record.Embedding) == 0 {
		return nil, ports.ErrNotFound
	}
	return record.Embedding, nil
}

func (s *SemanticStore) Similar(_ context.Context, _ []float32, _ string, _ shared.ArticleID, limit int) ([]ports.SemanticHit, error) {
	if s.SimilarErr != nil {
		return nil, s.SimilarErr
	}
	if s.Err != nil {
		return nil, s.Err
	}
	if len(s.Hits) > limit {
		return s.Hits[:limit], nil
	}
	return s.Hits, nil
}
