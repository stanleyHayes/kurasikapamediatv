package testing

import (
	"context"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type NarrationJobStore struct {
	Items map[shared.NarrationJobID]media.NarrationJob
	Err   error
}

func NewNarrationJobStore(seed ...media.NarrationJob) *NarrationJobStore {
	store := &NarrationJobStore{Items: map[shared.NarrationJobID]media.NarrationJob{}}
	for _, job := range seed {
		store.Items[job.ID()] = job
	}
	return store
}

func (s *NarrationJobStore) FindByID(_ context.Context, id shared.NarrationJobID) (media.NarrationJob, error) {
	if s.Err != nil {
		return media.NarrationJob{}, s.Err
	}
	job, ok := s.Items[id]
	if !ok {
		return media.NarrationJob{}, ports.ErrNotFound
	}
	return job, nil
}

func (s *NarrationJobStore) FindLatestForArticle(_ context.Context, id shared.ArticleID) (media.NarrationJob, error) {
	if s.Err != nil {
		return media.NarrationJob{}, s.Err
	}
	var latest media.NarrationJob
	for _, job := range s.Items {
		if job.State().ArticleID == id && (latest.ID() == "" || job.State().CreatedAt.After(latest.State().CreatedAt)) {
			latest = job
		}
	}
	if latest.ID() == "" {
		return media.NarrationJob{}, ports.ErrNotFound
	}
	return latest, nil
}

func (s *NarrationJobStore) ListProcessing(_ context.Context, limit int) ([]media.NarrationJob, error) {
	if s.Err != nil {
		return nil, s.Err
	}
	items := []media.NarrationJob{}
	for _, job := range s.Items {
		if job.State().Status == media.NarrationProcessing && len(items) < limit {
			items = append(items, job)
		}
	}
	return items, nil
}

func (s *NarrationJobStore) Save(_ context.Context, job media.NarrationJob) error {
	if s.Err != nil {
		return s.Err
	}
	s.Items[job.ID()] = job
	return nil
}

type NarrationProviderFake struct {
	TaskID       string
	StartErr     error
	CheckErr     error
	Result       ports.NarrationProviderResult
	LastRequest  ports.NarrationRequest
	CheckedJobID shared.NarrationJobID
}

func (f *NarrationProviderFake) Start(_ context.Context, request ports.NarrationRequest) (string, error) {
	f.LastRequest = request
	return f.TaskID, f.StartErr
}

func (f *NarrationProviderFake) Check(_ context.Context, jobID shared.NarrationJobID, _ string) (ports.NarrationProviderResult, error) {
	f.CheckedJobID = jobID
	return f.Result, f.CheckErr
}
