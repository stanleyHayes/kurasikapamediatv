import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { MongoClient } from 'mongodb'
import { DRAFT, EDITOR, seed, seedEditor } from './seed'

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
    await expect(page.getByRole('heading', { name: 'Editorial desk', level: 1 })).toBeVisible()
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

    // "Left the studio", not `/\/en$/`. That pattern also matches the studio's
    // OWN /studio/en, so it was already satisfied the moment it was evaluated:
    // the wait returned immediately, the next goto raced the in-flight action,
    // and the sign-out was reported as broken when it had simply not finished.
    await page.waitForURL((url) => !url.pathname.startsWith('/studio'))

    // Returning to the studio must require signing in again. A sign-out that
    // only navigates away leaves the session alive — and now that sign-out is
    // a server action on a different origin from the form that signed in,
    // "the cookie was actually cleared" is worth proving, not assuming.
    await page.goto(`${STUDIO}/en`)
    await expect(page).toHaveURL(/\/sign-in$/u)
  })
})

test.describe('workflow transitions', () => {
  test('an editor moves a draft through review and approval to scheduled', async ({ page }) => {
    // Re-seeded here rather than only in the file's beforeAll: a CI retry must
    // find the draft a draft again, not whatever the failed attempt left behind.
    // The revision is what an approval approves — without one the Approve
    // button deliberately does not render.
    await resetDraft()
    await resetSignInAllowance()
    await signIn(page)

    await page.goto(`${STUDIO}/en/articles/${DRAFT._id}`)

    await page.getByRole('button', { name: 'Submit for review' }).click()
    await expect(page.getByText('In review')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByText('Approved', { exact: true })).toBeVisible({ timeout: 15_000 })

    const [date, time] = inOneDay().split('T') as [string, string]
    await page.getByLabel('Date').fill(date)
    await page.getByLabel('Time').fill(time)
    await page.getByRole('button', { name: 'Schedule' }).click()
    await expect(page.getByText('Scheduled')).toBeVisible({ timeout: 15_000 })
  })
})

/** Local shapes, not the adapter's — the same discipline as seed.ts. */
const URI =
  process.env['MONGODB_URI'] ?? 'mongodb://127.0.0.1:37017/kurasikapa_e2e?directConnection=true'
const DB = process.env['MONGODB_DB'] ?? 'kurasikapa_e2e'

interface DraftRevision {
  readonly _id: string
  readonly articleId: string
  readonly seq: number
  readonly title: string
  readonly body: string
  readonly authorId: string
  readonly createdAt: Date
}

/**
 * The seeded draft plus one revision of it, written directly to MongoDB for
 * the reason seed.ts gives: a journey cannot use the thing under test to
 * create its own fixtures. Revision ids are looked up by the UI, never
 * assumed — the test drives the buttons, not the wire shape.
 */
async function resetDraft(): Promise<void> {
  const client = new MongoClient(URI)
  await client.connect()
  const db = client.db(DB)

  const articles = db.collection<typeof DRAFT>('articles')
  await articles.deleteOne({ _id: DRAFT._id })
  await articles.insertOne({ ...DRAFT })

  const revisions = db.collection<DraftRevision>('article_revisions')
  await revisions.deleteMany({ articleId: DRAFT._id })
  await revisions.insertOne({
    _id: 'e2e_draft_rev',
    articleId: DRAFT._id,
    seq: 1,
    title: DRAFT.title,
    body: 'The scoop, written but not yet published.',
    authorId: DRAFT.authorId,
    createdAt: new Date('2026-08-04T09:00:00Z'),
  })

  await client.close()
}

/**
 * Better Auth rate-limits credential endpoints in the database — measured at
 * three sign-ins per minute, stricter than the app's own limiter
 * (composition/auth.ts documents why it is left that way). This file signs in
 * through the real form once per signed-in test, so the fourth journey would
 * be refused for doing nothing wrong. Clearing the counter keeps each journey
 * about its own subject, not about the tests that ran before it.
 */
async function resetSignInAllowance(): Promise<void> {
  const client = new MongoClient(URI)
  await client.connect()
  await client.db(DB).collection('rateLimit').deleteMany({})
  await client.close()
}

/**
 * Tomorrow, wall-clock, in the `YYYY-MM-DDTHH:mm` shape a `datetime-local`
 * input accepts. A day of slack keeps the domain's "not in the past" guard
 * green regardless of which zone the runner sits in.
 */
function inOneDay(): string {
  const date = new Date(Date.now() + 86_400_000)
  const pad = (value: number): string => String(value).padStart(2, '0')
  const day = `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

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
