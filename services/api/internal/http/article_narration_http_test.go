package http_test

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/app/ports"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
	kurahttp "github.com/kurasikapa/api/internal/http"
)

func narrationHTTPServer(t *testing.T) http.Handler {
	t.Helper()
	revisionID := shared.RevisionID("revision_1")
	slug := shared.SlugFrom("market-report")
	article := editorial.Reconstitute(editorial.ArticleState{
		ID: "article_1", FamilyID: "family_1", Locale: "en", Slug: slug,
		Title: "Market report", AuthorID: "author", Status: editorial.StatusPublished,
		ApprovedRevisionID: &revisionID,
	})
	articles := faketesting.NewArticleStore(article)
	revisions := faketesting.NewRevisionStore()
	if err := revisions.Append(context.Background(), editorial.ReconstituteRevision(editorial.RevisionState{
		ID: revisionID, ArticleID: article.ID(), Seq: 1, Title: article.Title(),
		Body: "Prices rose during the week.", AuthorID: "author", CreatedAt: now,
	})); err != nil {
		t.Fatal(err)
	}
	assets := faketesting.NewAssetStore()
	appDeps := appeditorial.Deps{
		Articles: articles, Revisions: revisions, Categories: faketesting.NewCategoryStore(),
		Assets: assets, Clock: faketesting.FixedClock{At: now}, IDs: &faketesting.SequentialIDs{},
		Events: &faketesting.RecordingEventBus{},
	}
	jobs := faketesting.NewNarrationJobStore()
	provider := &faketesting.NarrationProviderFake{TaskID: "polly_1", Result: ports.NarrationProviderResult{
		Status:   ports.NarrationProviderReady,
		Delivery: media.AssetDelivery{ProviderID: "narration/job", SecureURL: "https://cdn.test/story.mp3", Bytes: 1024, DurationSeconds: 45},
	}}
	deps := httpDeps(appDeps, map[shared.UserID][]identity.Role{"manager": {identity.RoleEditor}})
	deps.RequestArticleNarration = appeditorial.NewRequestArticleNarration(appDeps, jobs, provider)
	deps.GetLatestNarration = appeditorial.NewGetLatestArticleNarration(appDeps, jobs)
	deps.AttachArticleNarration = appeditorial.NewAttachArticleNarration(appDeps, jobs)
	deps.ProcessNarrationJobs = appeditorial.NewProcessNarrationJobs(appDeps, jobs, provider)
	return kurahttp.NewRouter(deps)
}

func TestArticleNarrationHTTPWorkflowRequiresExplicitAttachment(t *testing.T) {
	t.Parallel()
	handler := narrationHTTPServer(t)
	requested := request(handler, http.MethodPost, "/articles/article_1/narrations", "", true)
	if requested.Code != http.StatusAccepted || !bytes.Contains(requested.Body.Bytes(), []byte(`"status":"processing"`)) {
		t.Fatalf("request: %d %s", requested.Code, requested.Body.String())
	}

	before := request(handler, http.MethodGet, "/public/en/articles/market-report", "", false)
	if before.Code != http.StatusOK || !bytes.Contains(before.Body.Bytes(), []byte(`"narration":null`)) {
		t.Fatalf("public before approval: %d %s", before.Code, before.Body.String())
	}

	cron := httptest.NewRequest(http.MethodPost, "/internal/process-narrations", nil)
	cron.Header.Set("Authorization", "Bearer s3cret-value-of-known-length-0000")
	processed := do(handler, cron)
	if processed.Code != http.StatusOK || !bytes.Contains(processed.Body.Bytes(), []byte(`"ready":1`)) {
		t.Fatalf("process: %d %s", processed.Code, processed.Body.String())
	}
	latest := request(handler, http.MethodGet, "/articles/article_1/narrations/latest", "", true)
	if latest.Code != http.StatusOK || !bytes.Contains(latest.Body.Bytes(), []byte(`"status":"ready"`)) {
		t.Fatalf("latest: %d %s", latest.Code, latest.Body.String())
	}
	attached := request(handler, http.MethodPost, "/articles/article_1/narrations/id_1/attach", "", true)
	if attached.Code != http.StatusOK {
		t.Fatalf("attach: %d %s", attached.Code, attached.Body.String())
	}
	after := request(handler, http.MethodGet, "/public/en/articles/market-report", "", false)
	if after.Code != http.StatusOK || !bytes.Contains(after.Body.Bytes(), []byte(`"voice":"Amy"`)) {
		t.Fatalf("public after approval: %d %s", after.Code, after.Body.String())
	}
}

func TestArticleNarrationHTTPFailsClosed(t *testing.T) {
	t.Parallel()
	handler := narrationHTTPServer(t)
	for _, path := range []string{
		"/articles/article_1/narrations",
		"/articles/article_1/narrations/latest",
		"/articles/article_1/narrations/job_1/attach",
	} {
		method := http.MethodPost
		if path == "/articles/article_1/narrations/latest" {
			method = http.MethodGet
		}
		response := request(handler, method, path, "", false)
		if response.Code != http.StatusForbidden {
			t.Fatalf("unauthorised %s: %d %s", path, response.Code, response.Body.String())
		}
	}
	missing := request(handler, http.MethodPost, "/articles/missing/narrations", "", true)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing article: %d %s", missing.Code, missing.Body.String())
	}
	cron := request(handler, http.MethodPost, "/internal/process-narrations", "", false)
	if cron.Code != http.StatusNotFound {
		t.Fatalf("unauthorised cron: %d %s", cron.Code, cron.Body.String())
	}
}
