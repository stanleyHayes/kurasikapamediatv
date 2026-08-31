package editorial_test

import (
	"context"
	"errors"
	"testing"

	app "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/app/ports"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/media"
)

func TestGetLatestArticleNarrationSurfacesMissingDependencies(t *testing.T) {
	t.Parallel()
	h, article := narrationFixture(t, "en", "Approved report.")
	missingJobs := faketesting.NewNarrationJobStore()
	useCase := app.NewGetLatestArticleNarration(h.deps, missingJobs)
	if _, err := useCase.Execute(context.Background(), editor(), "missing"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("missing article error = %v", err)
	}
	missingJobs.Err = errors.New("jobs unavailable")
	if _, err := useCase.Execute(context.Background(), editor(), article.ID()); err == nil {
		t.Fatal("job repository error was swallowed")
	}
	job, err := readyNarrationJob(editor(), article.ID(), "job_missing_asset", "asset_missing")
	if err != nil {
		t.Fatal(err)
	}
	useCase = app.NewGetLatestArticleNarration(h.deps, faketesting.NewNarrationJobStore(job))
	if _, err := useCase.Execute(context.Background(), editor(), article.ID()); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("missing preview asset error = %v", err)
	}
}

func TestAttachArticleNarrationRejectsWrongAssetAndSaveFailure(t *testing.T) {
	t.Parallel()
	h, article := narrationFixture(t, "en", "Approved report.")
	job, err := readyNarrationJob(editor(), article.ID(), "job_wrong_asset", "asset_wrong")
	if err != nil {
		t.Fatal(err)
	}
	h.assets.Items["asset_wrong"] = media.ReconstituteAsset(media.AssetState{
		ID: "asset_wrong", Kind: media.AssetVideo, Locale: "en", Status: media.AssetReady,
		MIMEType: "video/mp4", SecureURL: "https://cdn.test/report.mp4", DurationSeconds: 10,
	})
	useCase := app.NewAttachArticleNarration(h.deps, faketesting.NewNarrationJobStore(job))
	if _, err = useCase.Execute(context.Background(), editor(), article.ID(), job.ID()); !errors.Is(err, app.ErrNarrationJobNotUsable) {
		t.Fatalf("wrong asset error = %v", err)
	}
	h.assets.Items["asset_wrong"] = media.ReconstituteAsset(media.AssetState{
		ID: "asset_wrong", Kind: media.AssetAudio, Locale: "en", Status: media.AssetReady,
		MIMEType: "audio/mpeg", SecureURL: "https://cdn.test/report.mp3", DurationSeconds: 10,
	})
	h.articles.FailSave = errors.New("save down")
	if _, err = useCase.Execute(context.Background(), editor(), article.ID(), job.ID()); err == nil {
		t.Fatal("article save failure was swallowed")
	}
}

func TestProcessNarrationsRecordsUnknownStatusAndAssetFailure(t *testing.T) {
	t.Parallel()
	h, article := narrationFixture(t, "en", "Approved report.")
	job := processingNarrationJob(t, article.ID(), "job_provider_error")
	jobs := faketesting.NewNarrationJobStore(job)
	result, err := app.NewProcessNarrationJobs(h.deps, jobs, &faketesting.NarrationProviderFake{}).Execute(context.Background(), editor())
	if err != nil || len(result.Failed) != 1 {
		t.Fatalf("unknown status result = %+v error = %v", result, err)
	}
	h.assets.Err = errors.New("asset store down")
	provider := &faketesting.NarrationProviderFake{Result: ports.NarrationProviderResult{
		Status:   ports.NarrationProviderReady,
		Delivery: media.AssetDelivery{ProviderID: "audio", SecureURL: "https://cdn.test/a.mp3", Bytes: 10, DurationSeconds: 2},
	}}
	result, err = app.NewProcessNarrationJobs(h.deps, jobs, provider).Execute(context.Background(), editor())
	if err != nil || len(result.Failed) != 1 {
		t.Fatalf("asset failure result = %+v error = %v", result, err)
	}
}
