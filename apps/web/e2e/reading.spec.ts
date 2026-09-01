import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { DRAFT, PUBLISHED, seed } from './seed'

test.beforeAll(async () => {
  await seed()
})

/**
 * Journey 1 — a reader finds an article and reads it, in both locales.
 * docs/07-quality-gates.md § 3.
 */
test.describe('reading', () => {
  test('the homepage lists the published article', async ({ page }) => {
    await page.goto('/en')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: PUBLISHED.title })).toBeVisible()
  })

  test('the article page renders its headline', async ({ page }) => {
    await page.goto(`/en/articles/${PUBLISHED.slug}`)

    await expect(page.getByRole('heading', { name: PUBLISHED.title, level: 1 })).toBeVisible()
  })

  test('a consenting reader records privacy-safe view and attention signals', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('kurasikapa-analytics-consent', 'granted'))
    const recorded = page.waitForResponse((response) => response.url().endsWith('/api/analytics/page-view'))
    const engaged = page.waitForResponse((response) => response.url().endsWith('/api/analytics/engagement'))
    await page.goto(`/en/articles/${PUBLISHED.slug}`)
    await page.locator('#article-transcript').scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    expect((await recorded).status()).toBe(204)
    expect((await engaged).status()).toBe(204)
  })

  test('first-party consent remains available without a GA provider id', async ({ page }) => {
    await page.goto('/en')
    await expect(page.getByRole('dialog', { name: 'Analytics cookies' })).toBeVisible()
  })

  test('the article carries NewsArticle structured data', async ({ page }) => {
    await page.goto(`/en/articles/${PUBLISHED.slug}`)

    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent()
    const parsed = JSON.parse((jsonLd ?? '').replace(/\\u003c/gu, '<')) as Record<string, unknown>

    expect(parsed['@type']).toBe('NewsArticle')
    expect(parsed['headline']).toBe(PUBLISHED.title)
  })

  test('the French locale serves its own chrome', async ({ page }) => {
    await page.goto('/fr')

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  })

  test('an unknown article renders not-found and is marked noindex', async ({ page }) => {
    // 200, not 404 — Cache Components flushes the shell before the boundary
    // can set a status, and Next offers no per-route opt-out that coexists
    // with it. The harm from a soft 404 is indexing, so that is what we block.
    // See the comment on the article page.
    await page.goto('/en/articles/no-such-article')

    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/u)
  })
})

/**
 * The rule that matters most on the public site: an unpublished draft is
 * unreachable, by URL and by search. Tested through the browser because the
 * unit tests can only prove the use case refuses — not that every route
 * actually goes through it.
 */
test.describe('drafts are not readable by the public', () => {
  test('a draft URL never renders the draft', async ({ page }) => {
    // The status is 200 for the reason above; what matters is that no word of
    // the draft reaches the page, and that crawlers are told not to keep it.
    await page.goto(`/en/articles/${DRAFT.slug}`)

    await expect(page.getByText(DRAFT.title)).toHaveCount(0)
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/u)
  })

  test('a draft never appears in search results', async ({ page }) => {
    await page.goto('/en/search?q=secret')

    await expect(page.getByText(DRAFT.title)).toHaveCount(0)
  })

  test('a draft is absent from the sitemap', async ({ page }) => {
    const response = await page.goto('/sitemap.xml')
    const body = (await response?.text()) ?? ''

    expect(body).toContain(PUBLISHED.slug)
    expect(body).not.toContain(DRAFT.slug)
  })
})

test.describe('search', () => {
  test('finds a published article by a word in its headline', async ({ page }) => {
    await page.goto('/en/search?q=budget')

    await expect(page.getByRole('link', { name: PUBLISHED.title })).toBeVisible()
  })

  test('says so when nothing matches, rather than showing everything', async ({ page }) => {
    await page.goto('/en/search?q=zzzznothing')

    await expect(page.getByText(/no reporting matched/iu)).toBeVisible()
  })
})

test.describe('sections', () => {
  test('a section lists only its own published articles', async ({ page }) => {
    await page.goto('/en/sections/business')

    await expect(page.getByRole('heading', { name: 'Business', level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: PUBLISHED.title })).toBeVisible()
  })

  test('the localised slug reaches the same section', async ({ page }) => {
    await page.goto('/fr/sections/economie')

    await expect(page.getByRole('heading', { name: 'Économie', level: 1, exact: true })).toBeVisible()
  })

  test('an English slug does not resolve under a French URL', async ({ page }) => {
    await page.goto('/fr/sections/business')

    await expect(page.getByRole('heading', { name: 'Business', level: 1 })).toHaveCount(0)
  })
})

/**
 * WCAG 2.2 AA is a commitment in docs/01-brd.md § 5, not an aspiration.
 * Checked on every public page a reader can reach.
 *
 * One run per path, not per test: the sweep covers the distinct public paths
 * the journeys visit — both locales' homepages and sections, an article,
 * search, contact, sign-in — plus the static reader pages (about, newsletter)
 * no journey asserts on but every reader can still open. Error boundaries
 * (unknown article, draft URL) are excluded on purpose: they render the same
 * chrome inside a not-found boundary, so they would audit the same layout
 * twice for no new signal.
 */
const SWEPT_PATHS = [
  '/en',
  '/fr',
  `/en/articles/${PUBLISHED.slug}`,
  '/en/sections/business',
  '/fr/sections/economie',
  '/en/search',
  '/en/contact',
  '/en/about',
  '/en/newsletter',
  '/en/podcasts',
  '/en/galleries',
  '/en/sign-in',
]

test.describe('accessibility', () => {
  for (const path of SWEPT_PATHS) {
    test(`${path} has no WCAG 2.2 AA violations`, async ({ page }) => {
      await page.goto(path)

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()

      expect(results.violations).toEqual([])
    })
  }
})
