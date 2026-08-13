import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { EDITOR, seed, seedEditor } from './seed'

/**
 * The one suite that spans both deployments.
 *
 * `baseURL` is the public site; the studio answers on its own origin, so its
 * URLs are absolute. That asymmetry is the point — these journeys exist to
 * prove the handover between the two deployments still works: the session
 * cookie reaches the studio, the studio's guard sends an anonymous visitor
 * back to the site, and the site sends an editor forward to the studio.
 */
const STUDIO = process.env['STUDIO_URL'] ?? 'http://127.0.0.1:31743/studio'

test.beforeAll(async ({ baseURL }) => {
  await seed()
  await seedEditor(baseURL ?? '')
})

/** Signs in through the real form — the same path a newsroom uses. */
async function signIn(page: Page): Promise<void> {
  await page.goto('/en/sign-in')
  await page.getByLabel('Email').fill(EDITOR.email)
  await page.getByLabel('Password').fill(EDITOR.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`${STUDIO}/en`)
}

/**
 * The studio is behind authentication. These prove the gate holds for an
 * anonymous visitor; the signed-in editorial cycle (journeys 2–4) needs a
 * seeded session and lands with the sign-in UI.
 */
test.describe('studio access', () => {
  test('an anonymous visitor is sent to sign in, not to the homepage', async ({ page }) => {
    // Sending them home would leave them guessing how to get back. Sending a
    // signed-in but unauthorised reader to sign-in would be worse — a form
    // that cannot help, since they are already who they are.
    // Across origins now: the studio bounces them onto the SITE's sign-in.
    await page.goto(`${STUDIO}/en`)

    await expect(page).toHaveURL(/\/en\/sign-in$/u)
  })

  test('an anonymous visitor is sent to sign in from the review queue too', async ({ page }) => {
    await page.goto(`${STUDIO}/en/review`)

    await expect(page).toHaveURL(/\/en\/sign-in$/u)
  })

  test('robots.txt keeps crawlers out of the studio', async ({ page }) => {
    const response = await page.goto('/robots.txt')
    const body = (await response?.text()) ?? ''

    // One prefix, not one per locale: the studio's basePath comes before the
    // locale now (`/studio/en/...`), so `/en/studio/` would match nothing.
    expect(body).toContain('/studio/')
  })
})

/**
 * Journeys 2–4 (draft → review → approve → publish) and 5 (reader accounts)
 * require a signed-in session, which needs the sign-in UI that lands next.
 * Written now and skipped, so the gap is visible in every CI run rather than
 * forgotten. docs/07-quality-gates.md § 3.
 */
/** Journeys 2–4, now that a real sign-in exists. docs/07-quality-gates.md § 3. */
test.describe('signed in', () => {
  test('an editor reaches the studio through the real sign-in form', async ({ page }) => {
    await signIn(page)

    // The studio's own shell, not the public masthead: the Stitch editorial CMS
    // is a full-screen admin surface, so reaching it must show its top bar AND
    // must not show the reader's site chrome.
    await expect(page.getByRole('heading', { name: 'Editorial Workflow', level: 1 })).toBeVisible()
    await expect(page.locator('footer')).toHaveCount(0)
  })

  test('the review queue opens for someone who may approve', async ({ page }) => {
    await signIn(page)
    await page.goto(`${STUDIO}/en/review`)

    await expect(page).toHaveURL(`${STUDIO}/en/review`)
  })

  test('signing out ends the session, not just the page', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL(/\/en$/u)

    // Returning to the studio must require signing in again. A sign-out that
    // only navigates away leaves the session alive — and now that sign-out is
    // a server action on a different origin from the form that signed in,
    // "the cookie was actually cleared" is worth proving, not assuming.
    await page.goto(`${STUDIO}/en`)
    await expect(page).toHaveURL(/\/sign-in$/u)
  })
})

test.describe('failed sign-in', () => {
  test('a wrong password does not reveal whether the account exists', async ({ page }) => {
    // The message is the only place that could leak which addresses are
    // registered, so it says the same thing either way.
    await page.goto('/en/sign-in')
    await page.getByLabel('Email').fill(EDITOR.email)
    await page.getByLabel('Password').fill('definitely-not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Those details did not match an account.')).toBeVisible()
  })

  test('an unknown email gets the identical message', async ({ page }) => {
    await page.goto('/en/sign-in')
    await page.getByLabel('Email').fill('nobody@kurasikapa.test')
    await page.getByLabel('Password').fill('anything-at-all')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Those details did not match an account.')).toBeVisible()
  })
})
