// Package insight builds evidence-backed newsroom intelligence.
package insight

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

const (
	reportPageSize = 100
	minimumWords   = 300
	minimumPixels  = 50_000
)

type Deps struct {
	Articles  ports.ArticleRepository
	Revisions ports.RevisionRepository
	Profiles  ports.StaffProfileRepository
	Clock     ports.Clock
}

type SEOIssue struct {
	ArticleID      string `json:"articleId"`
	Locale         string `json:"locale"`
	Slug           string `json:"slug"`
	Title          string `json:"title"`
	Severity       string `json:"severity"`
	Code           string `json:"code"`
	Message        string `json:"message"`
	Recommendation string `json:"recommendation"`
}

type LocaleSummary struct {
	Locale           string `json:"locale"`
	Published        int    `json:"published"`
	Ready            int    `json:"ready"`
	Warning          int    `json:"warning"`
	Critical         int    `json:"critical"`
	ReadinessPercent int    `json:"readinessPercent"`
}

type SEOReport struct {
	GeneratedAt      time.Time       `json:"generatedAt"`
	TotalPublished   int             `json:"totalPublished"`
	ReadyArticles    int             `json:"readyArticles"`
	WarningArticles  int             `json:"warningArticles"`
	CriticalArticles int             `json:"criticalArticles"`
	ReadinessPercent int             `json:"readinessPercent"`
	Locales          []LocaleSummary `json:"locales"`
	Issues           []SEOIssue      `json:"issues"`
}

type BuildSEOReport struct {
	deps    Deps
	locales []string
}

func NewBuildSEOReport(deps Deps, locales []string) BuildSEOReport {
	return BuildSEOReport{deps: deps, locales: append([]string(nil), locales...)}
}

func (u BuildSEOReport) Execute(ctx context.Context, actor identity.Actor) (SEOReport, error) {
	if err := actor.Require(identity.PermAnalyticsRead); err != nil {
		return SEOReport{}, err
	}
	report := SEOReport{GeneratedAt: u.deps.Clock.Now(), Locales: []LocaleSummary{}, Issues: []SEOIssue{}}
	for _, locale := range u.locales {
		summary, issues, err := u.localeReport(ctx, locale)
		if err != nil {
			return SEOReport{}, err
		}
		report.Locales = append(report.Locales, summary)
		report.Issues = append(report.Issues, issues...)
		report.TotalPublished += summary.Published
		report.ReadyArticles += summary.Ready
		report.WarningArticles += summary.Warning
		report.CriticalArticles += summary.Critical
	}
	report.ReadinessPercent = percent(report.ReadyArticles, report.TotalPublished)
	sortIssues(report.Issues)
	return report, nil
}

func (u BuildSEOReport) localeReport(ctx context.Context, locale string) (LocaleSummary, []SEOIssue, error) {
	articles, err := u.published(ctx, locale)
	if err != nil {
		return LocaleSummary{}, nil, err
	}
	profiles, err := u.deps.Profiles.ListPublished(ctx, locale)
	if err != nil {
		return LocaleSummary{}, nil, err
	}
	revisions, err := u.approvedRevisions(ctx, articles)
	if err != nil {
		return LocaleSummary{}, nil, err
	}
	profiled := map[shared.UserID]bool{}
	for _, profile := range profiles {
		profiled[profile.State().UserID] = true
	}
	summary := LocaleSummary{Locale: locale, Published: len(articles)}
	issues := []SEOIssue{}
	for _, article := range articles {
		found := inspect(article, revisions[article.ID()], profiled[article.AuthorID()])
		issues = append(issues, found...)
		classify(&summary, found)
	}
	summary.ReadinessPercent = percent(summary.Ready, summary.Published)
	return summary, issues, nil
}

func (u BuildSEOReport) published(ctx context.Context, locale string) ([]editorial.Article, error) {
	items, after := []editorial.Article{}, ""
	for {
		page, err := u.deps.Articles.ListPublished(ctx, ports.PublishedQuery{Locale: locale, Cursor: ports.Cursor{After: after, Limit: reportPageSize}})
		if err != nil {
			return nil, err
		}
		items = append(items, page.Items...)
		if page.NextCursor == "" || page.NextCursor == after {
			return items, nil
		}
		after = page.NextCursor
	}
}

func (u BuildSEOReport) approvedRevisions(ctx context.Context, articles []editorial.Article) (map[shared.ArticleID]editorial.Revision, error) {
	ids := []shared.RevisionID{}
	for _, article := range articles {
		if id, ok := article.ApprovedRevisionID(); ok {
			ids = append(ids, id)
		}
	}
	revisions, err := u.deps.Revisions.FindManyByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	byArticle := map[shared.ArticleID]editorial.Revision{}
	for _, revision := range revisions {
		byArticle[revision.ArticleID()] = revision
	}
	return byArticle, nil
}

func inspect(article editorial.Article, revision editorial.Revision, profiled bool) []SEOIssue {
	issues := []SEOIssue{}
	add := func(severity, code, message, recommendation string) {
		issues = append(issues, SEOIssue{ArticleID: article.ID().String(), Locale: article.Locale(), Slug: article.Slug().String(), Title: article.Title(), Severity: severity, Code: code, Message: message, Recommendation: recommendation})
	}
	if revision.ID() == "" {
		add("critical", "missing_approved_copy", "The published story has no resolvable approved revision.", "Restore or approve the correct revision before keeping this URL live.")
	} else if len(strings.Fields(revision.Body())) < minimumWords {
		add("warning", "thin_copy", "Approved copy is below the newsroom's 300-word depth check.", "Confirm the story is intentionally brief or strengthen its original reporting.")
	}
	hero, hasHero := article.Hero()
	if !hasHero {
		add("critical", "missing_hero", "The story has no credited lead image.", "Attach a rights-cleared image with alt text, caption and credit.")
	} else if hero.Width*hero.Height < minimumPixels {
		add("warning", "small_hero", "The lead image is below Google's 50,000-pixel recommendation.", "Replace it with a relevant, crawlable high-resolution image.")
	}
	if !profiled {
		add("critical", "missing_author_profile", "The byline does not resolve to a published journalist profile in this language.", "Publish the author's biography, portrait and profile page.")
	}
	return issues
}

func classify(summary *LocaleSummary, issues []SEOIssue) {
	critical := false
	for _, issue := range issues {
		critical = critical || issue.Severity == "critical"
	}
	if critical {
		summary.Critical++
	} else if len(issues) > 0 {
		summary.Warning++
	} else {
		summary.Ready++
	}
}

func percent(part, whole int) int {
	if whole == 0 {
		return 0
	}
	return (part*100 + whole/2) / whole
}

func sortIssues(issues []SEOIssue) {
	sort.SliceStable(issues, func(i, j int) bool {
		if issues[i].Severity != issues[j].Severity {
			return issues[i].Severity == "critical"
		}
		return issues[i].Title < issues[j].Title
	})
}
