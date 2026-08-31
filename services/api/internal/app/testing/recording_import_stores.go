package testing

import (
	"context"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type RecordingImportStore struct {
	Rows    map[shared.RecordingImportID]media.RecordingImport
	SaveErr error
	ListErr error
	FindErr error
}

func NewRecordingImportStore(rows ...media.RecordingImport) *RecordingImportStore {
	store := &RecordingImportStore{Rows: map[shared.RecordingImportID]media.RecordingImport{}}
	for _, row := range rows {
		store.Rows[row.ID()] = row
	}
	return store
}

func (s *RecordingImportStore) FindByID(_ context.Context, id shared.RecordingImportID) (media.RecordingImport, error) {
	if s.FindErr != nil {
		return media.RecordingImport{}, s.FindErr
	}
	row, ok := s.Rows[id]
	if !ok {
		return media.RecordingImport{}, ports.ErrNotFound
	}
	return row, nil
}

func (s *RecordingImportStore) FindBySourceRef(_ context.Context, source string) (media.RecordingImport, error) {
	if s.FindErr != nil {
		return media.RecordingImport{}, s.FindErr
	}
	for _, row := range s.Rows {
		if row.State().SourceRef == source {
			return row, nil
		}
	}
	return media.RecordingImport{}, ports.ErrNotFound
}

func (s *RecordingImportStore) ListProcessing(_ context.Context, _ int) ([]media.RecordingImport, error) {
	if s.ListErr != nil {
		return nil, s.ListErr
	}
	rows := []media.RecordingImport{}
	for _, row := range s.Rows {
		if row.State().Status == media.RecordingImportProcessing {
			rows = append(rows, row)
		}
	}
	return rows, nil
}

func (s *RecordingImportStore) Save(_ context.Context, row media.RecordingImport) error {
	if s.SaveErr != nil {
		return s.SaveErr
	}
	s.Rows[row.ID()] = row
	return nil
}

type RecordingPromotionFake struct {
	StartResult ports.RecordingTranscode
	StartErr    error
	CheckResult ports.RecordingProviderResult
	CheckErr    error
	Starts      int
	Checks      int
}

func (f *RecordingPromotionFake) Start(context.Context, shared.RecordingImportID, ports.RecordingSource) (ports.RecordingTranscode, error) {
	f.Starts++
	return f.StartResult, f.StartErr
}

func (f *RecordingPromotionFake) Check(context.Context, shared.RecordingImportID, string, string) (ports.RecordingProviderResult, error) {
	f.Checks++
	return f.CheckResult, f.CheckErr
}
