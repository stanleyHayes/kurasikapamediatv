package editorial_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	app "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/app/ports"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func narrationFixture(t *testing.T, locale, body string) (harness, editorial.Article) {
	t.Helper()
	slug, _ := shared.NewSlug("market-report")
	revisionID := shared.RevisionID("revision_1")
	article := editorial.Reconstitute(editorial.ArticleState{
		ID: "article_1", FamilyID: "family_1", Locale: locale, Slug: slug,
		Title: "Market report", AuthorID: author().ID(), Status: editorial.StatusApproved,
		ApprovedRevisionID: &revisionID,
	})
	h := newHarness(article)
	revision := editorial.ReconstituteRevision(editorial.RevisionState{
		ID: revisionID, ArticleID: article.ID(), Seq: 1, Title: article.Title(),
		Body: body, AuthorID: author().ID(), CreatedAt: now,
	})
	if err := h.revisions.Append(context.Background(), revision); err != nil {
		t.Fatal(err)
	}
	return h, article
}

func TestRequestArticleNarrationStartsReviewableJob(t *testing.T) {
	t.Parallel()
	h, article := narrationFixture(t, "en", "## The market\n\nPrices [rose](https://example.test). **Traders** responded.")
	jobs := faketesting.NewNarrationJobStore()
	provider := &faketesting.NarrationProviderFake{TaskID: "polly_1"}

	job, err := app.NewRequestArticleNarration(h.deps, jobs, provider).Execute(
		context.Background(), editor(), article.ID(),
	)
	if err != nil {
		t.Fatal(err)
	}
	if job.Status != string(media.NarrationProcessing) || provider.LastRequest.Voice != "Amy" {
		t.Fatalf("job = %+v request = %+v", job, provider.LastRequest)
	}
	if strings.Contains(provider.LastRequest.Text, "##") || strings.Contains(provider.LastRequest.Text, "https://") {
		t.Fatalf("provider received markdown instead of narration text: %q", provider.LastRequest.Text)
	}
	if _, ok := article.Narration(); ok {
		t.Fatal("requesting synthesis made audio public before editor approval")
	}
}

func TestRequestArticleNarrationFailsClosed(t *testing.T) {
	t.Parallel()
	h, article := narrationFixture(t, "fr", strings.Repeat("a", 100_001))
	jobs := faketesting.NewNarrationJobStore()
	provider := &faketesting.NarrationProviderFake{TaskID: "polly_1"}

	_, err := app.NewRequestArticleNarration(h.deps, jobs, provider).Execute(context.Background(), editor(), article.ID())
	if !errors.Is(err, app.ErrNarrationTextTooLong) {
		t.Fatalf("long text error = %v", err)
	}
	if len(jobs.Items) != 0 || provider.LastRequest.JobID != "" {
		t.Fatal("invalid narration request reached persistence or provider")
	}

	short, shortArticle := narrationFixture(t, "fr", "Texte approuvé.")
	failing := &faketesting.NarrationProviderFake{StartErr: errors.New("polly unavailable")}
	failedJobs := faketesting.NewNarrationJobStore()
	_, err = app.NewRequestArticleNarration(short.deps, failedJobs, failing).Execute(context.Background(), editor(), shortArticle.ID())
	if err == nil || len(failedJobs.Items) != 1 {
		t.Fatal("provider failure was not returned and recorded")
	}
	for _, job := range failedJobs.Items {
		if job.State().Status != media.NarrationFailed {
			t.Fatalf("failed job status = %s", job.State().Status)
		}
	}
}

func TestRequestArticleNarrationRejectsUnsupportedOrUnapprovedStories(t *testing.T) {
	t.Parallel()
	h, article := narrationFixture(t, "tw", "Amanneɛbɔ no.")
	useCase := app.NewRequestArticleNarration(h.deps, faketesting.NewNarrationJobStore(), &faketesting.NarrationProviderFake{})
	if _, err := useCase.Execute(context.Background(), editor(), article.ID()); !errors.Is(err, media.ErrUnsupportedNarrationLocale) {
		t.Fatalf("Twi error = %v", err)
	}
	if _, err := useCase.Execute(context.Background(), reader(), article.ID()); err == nil {
		t.Fatal("subscriber requested article narration")
	}

	slug, _ := shared.NewSlug("unapproved-report")
	unapproved := editorial.Reconstitute(editorial.ArticleState{
		ID: "article_unapproved", FamilyID: "family_2", Locale: "en", Slug: slug,
		Title: "Unapproved", AuthorID: author().ID(), Status: editorial.StatusDraft,
	})
	unapprovedHarness := newHarness(unapproved)
	useCase = app.NewRequestArticleNarration(unapprovedHarness.deps, faketesting.NewNarrationJobStore(), &faketesting.NarrationProviderFake{})
	if _, err := useCase.Execute(context.Background(), editor(), unapproved.ID()); !errors.Is(err, editorial.ErrNoApprovedRevision) {
		t.Fatalf("approval error = %v", err)
	}
}

func TestProcessAndAttachArticleNarration(t *testing.T) {
	t.Parallel()
	h, article := narrationFixture(t, "en", "Approved report.")
	job, err := media.NewNarrationJob(editor(), media.NarrationJobState{
		ID: "job_1", ArticleID: article.ID(), RevisionID: "revision_1", Locale: "en", Voice: "Amy",
	}, now)
	if err != nil {
		t.Fatal(err)
	}
	job, err = job.Start(editor(), "polly_1", now)
	if err != nil {
		t.Fatal(err)
	}
	jobs := faketesting.NewNarrationJobStore(job)
	provider := &faketesting.NarrationProviderFake{Result: ports.NarrationProviderResult{
		Status:   ports.NarrationProviderReady,
		Delivery: media.AssetDelivery{ProviderID: "kurasikapa/narrations/job_1", SecureURL: "https://cdn.test/story.mp3", Bytes: 4096, DurationSeconds: 92},
	}}
	system := identity.NewActor("system", []identity.Role{identity.RoleSuperAdmin})

	processed, err := app.NewProcessNarrationJobs(h.deps, jobs, provider).Execute(context.Background(), system)
	if err != nil || processed.Ready != 1 {
		t.Fatalf("processed = %+v error = %v", processed, err)
	}
	ready := jobs.Items[job.ID()]
	if ready.State().AssetID == nil {
		t.Fatal("ready job has no generated audio asset")
	}

	view, err := app.NewAttachArticleNarration(h.deps, jobs).Execute(context.Background(), editor(), article.ID(), job.ID())
	if err != nil {
		t.Fatal(err)
	}
	if view.SourceRevisionID != "revision_1" || view.AssetID == "" {
		t.Fatalf("narration view = %+v", view)
	}
	stored, _ := h.articles.FindByID(context.Background(), article.ID())
	if _, ok := stored.Narration(); !ok {
		t.Fatal("approved narration was not attached")
	}
}

func TestAttachArticleNarrationRejectsUnreadyJob(t *testing.T) {
	t.Parallel()
	h, article := narrationFixture(t, "en", "Approved report.")
	job := processingNarrationJob(t, article.ID(), "job_unready")
	useCase := app.NewAttachArticleNarration(h.deps, faketesting.NewNarrationJobStore(job))
	if _, err := useCase.Execute(context.Background(), editor(), article.ID(), job.ID()); !errors.Is(err, app.ErrNarrationJobNotUsable) {
		t.Fatalf("unready job error = %v", err)
	}
	if _, err := useCase.Execute(context.Background(), reader(), article.ID(), job.ID()); err == nil {
		t.Fatal("subscriber attached narration")
	}
}

func TestGetLatestArticleNarrationIncludesPrivatePreview(t *testing.T) {
	t.Parallel()
	h, article := narrationFixture(t, "en", "Approved report.")
	job, err := readyNarrationJob(editor(), article.ID(), "job_latest", "asset_audio")
	if err != nil {
		t.Fatal(err)
	}
	asset := media.ReconstituteAsset(media.AssetState{
		ID: "asset_audio", Kind: media.AssetAudio, Locale: "en", Status: media.AssetReady,
		MIMEType: "audio/mpeg", SecureURL: "https://cdn.test/story.mp3", DurationSeconds: 62,
	})
	h.assets.Items[asset.ID()] = asset

	view, err := app.NewGetLatestArticleNarration(h.deps, faketesting.NewNarrationJobStore(job)).Execute(context.Background(), editor(), article.ID())
	if err != nil || view.SecureURL == nil || *view.SecureURL != "https://cdn.test/story.mp3" {
		t.Fatalf("view = %+v error = %v", view, err)
	}
}

func TestGetLatestArticleNarrationKeepsProcessingJobPrivate(t *testing.T) {
	t.Parallel()
	h, article := narrationFixture(t, "en", "Approved report.")
	job := processingNarrationJob(t, article.ID(), "job_private")
	view, err := app.NewGetLatestArticleNarration(h.deps, faketesting.NewNarrationJobStore(job)).Execute(context.Background(), editor(), article.ID())
	if err != nil || view.SecureURL != nil || view.Status != string(media.NarrationProcessing) {
		t.Fatalf("view = %+v error = %v", view, err)
	}
}

func TestProcessNarrationsCoversProviderOutcomes(t *testing.T) {
	t.Parallel()
	h, article := narrationFixture(t, "en", "Approved report.")
	system := identity.NewActor("system", []identity.Role{identity.RoleSuperAdmin})
	job := processingNarrationJob(t, article.ID(), "job_states")

	processing := &faketesting.NarrationProviderFake{Result: ports.NarrationProviderResult{Status: ports.NarrationProviderProcessing}}
	result, err := app.NewProcessNarrationJobs(h.deps, faketesting.NewNarrationJobStore(job), processing).Execute(context.Background(), system)
	if err != nil || result.Processing != 1 {
		t.Fatalf("processing result = %+v error = %v", result, err)
	}

	failedJobs := faketesting.NewNarrationJobStore(job)
	failed := &faketesting.NarrationProviderFake{Result: ports.NarrationProviderResult{Status: ports.NarrationProviderFailed}}
	result, err = app.NewProcessNarrationJobs(h.deps, failedJobs, failed).Execute(context.Background(), system)
	if err != nil || len(result.Failed) != 1 || failedJobs.Items[job.ID()].State().FailureReason == "" {
		t.Fatalf("failed result = %+v error = %v", result, err)
	}

	checking := &faketesting.NarrationProviderFake{CheckErr: errors.New("provider down")}
	result, err = app.NewProcessNarrationJobs(h.deps, faketesting.NewNarrationJobStore(job), checking).Execute(context.Background(), system)
	if err != nil || len(result.Failed) != 1 {
		t.Fatalf("check error result = %+v error = %v", result, err)
	}
}

func TestProcessNarrationsRequiresPublisherAndRepository(t *testing.T) {
	t.Parallel()
	h, _ := narrationFixture(t, "en", "Approved report.")
	useCase := app.NewProcessNarrationJobs(h.deps, faketesting.NewNarrationJobStore(), &faketesting.NarrationProviderFake{})
	if _, err := useCase.Execute(context.Background(), reader()); err == nil {
		t.Fatal("subscriber processed private narration jobs")
	}
	jobs := faketesting.NewNarrationJobStore()
	jobs.Err = errors.New("database down")
	useCase = app.NewProcessNarrationJobs(h.deps, jobs, &faketesting.NarrationProviderFake{})
	if _, err := useCase.Execute(context.Background(), editor()); err == nil {
		t.Fatal("repository error was swallowed")
	}
}

func processingNarrationJob(t *testing.T, articleID shared.ArticleID, id shared.NarrationJobID) media.NarrationJob {
	t.Helper()
	job, err := media.NewNarrationJob(editor(), media.NarrationJobState{
		ID: id, ArticleID: articleID, RevisionID: "revision_1", Locale: "en", Voice: "Amy",
	}, now)
	if err == nil {
		job, err = job.Start(editor(), "polly_1", now)
	}
	if err != nil {
		t.Fatal(err)
	}
	return job
}
