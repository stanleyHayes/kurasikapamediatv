package insight_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	app "github.com/kurasikapa/api/internal/app/insight"
	"github.com/kurasikapa/api/internal/app/ports"
	fakes "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var reportNow = time.Date(2026, 9, 1, 8, 0, 0, 0, time.UTC)

func article(id, author string, hero *editorial.ArticleHero) editorial.Article {
	revisionID := shared.RevisionID("rev_" + id)
	return editorial.Reconstitute(editorial.ArticleState{
		ID: shared.ArticleID(id), Locale: "en", Slug: shared.SlugFrom("story-" + id),
		Title: "A reported story", AuthorID: shared.UserID(author), CategoryID: "news",
		Hero: hero, Status: editorial.StatusPublished, ApprovedRevisionID: &revisionID,
		PublishedAt: &reportNow,
	})
}

func revision(id, body string) editorial.Revision {
	return editorial.NewRevision(shared.RevisionID("rev_"+id), shared.ArticleID(id), nil,
		"A reported story", body, "reporter", reportNow)
}

func publishedProfile(user string) identity.StaffProfile {
	return identity.ReconstituteStaffProfile(identity.StaffProfileState{
		ID: shared.StaffProfileID("profile_" + user), UserID: shared.UserID(user), Locale: "en",
		Slug: shared.SlugFrom(user), DisplayName: "Ama Mensah", JobTitle: "Reporter",
		Biography: "Reports on public affairs.", Published: true,
	})
}

func TestBuildSEOReportClassifiesPublishedInventory(t *testing.T) {
	t.Parallel()
	large := &editorial.ArticleHero{AssetID: "hero", SecureURL: "https://cdn.test/hero.jpg", AltText: "Parliament", Credit: "Kurasikapa", Width: 1200, Height: 675}
	articles := fakes.NewArticleStore(article("ready", "ama", large), article("broken", "missing", nil))
	revisions := fakes.NewRevisionStore(revision("ready", strings.Repeat("reported detail ", 320)), revision("broken", "Brief update."))
	profiles := fakes.NewStaffProfileStore(publishedProfile("ama"))
	useCase := app.NewBuildSEOReport(app.Deps{Articles: articles, Revisions: revisions, Profiles: profiles, Clock: fakes.FixedClock{At: reportNow}}, []string{"en"})

	report, err := useCase.Execute(context.Background(), identity.NewActor("editor", []identity.Role{identity.RoleEditor}))
	if err != nil {
		t.Fatal(err)
	}
	if report.TotalPublished != 2 || report.ReadyArticles != 1 || report.CriticalArticles != 1 || report.WarningArticles != 0 {
		t.Fatalf("summary = %+v", report)
	}
	if len(report.Issues) != 3 {
		t.Fatalf("issues = %+v", report.Issues)
	}
	if report.Locales[0].Locale != "en" || report.Locales[0].Ready != 1 || report.Locales[0].Critical != 1 {
		t.Fatalf("locale = %+v", report.Locales[0])
	}
}

func TestBuildSEOReportRequiresAnalyticsPermission(t *testing.T) {
	t.Parallel()
	useCase := app.NewBuildSEOReport(app.Deps{
		Articles: fakes.NewArticleStore(), Revisions: fakes.NewRevisionStore(),
		Profiles: fakes.NewStaffProfileStore(), Clock: fakes.FixedClock{At: reportNow},
	}, []string{"en", "fr"})

	_, err := useCase.Execute(context.Background(), identity.NewActor("author", []identity.Role{identity.RoleAuthor}))
	if !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatalf("error = %v", err)
	}
}

func TestBuildSEOReportPropagatesRepositoryFailure(t *testing.T) {
	t.Parallel()
	articles := fakes.NewArticleStore()
	articles.FailListPublished = ports.ErrNotFound
	useCase := app.NewBuildSEOReport(app.Deps{
		Articles: articles, Revisions: fakes.NewRevisionStore(),
		Profiles: fakes.NewStaffProfileStore(), Clock: fakes.FixedClock{At: reportNow},
	}, []string{"en"})

	_, err := useCase.Execute(context.Background(), identity.NewActor("admin", []identity.Role{identity.RoleAdministrator}))
	if !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("error = %v", err)
	}
}
