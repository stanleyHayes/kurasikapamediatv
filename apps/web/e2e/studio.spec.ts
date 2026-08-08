import { expect, test } from '@playwright/test'
import { seed } from './seed'

test.beforeAll(async () => {
  await seed()
})

/**
 * The studio is behind authentication. These prove the gate holds for an
 * anonymous visitor; the signed-in editorial cycle (journeys 2–4) needs a
 * seeded session and lands with the sign-in UI.
 */
test.describe('studio access', () => {
  test('an anonymous visitor is redirected away from the studio', async ({ page }) => {
    await page.goto('/en/studio')

    await expect(page).toHaveURL(/\/en$/u)
  })

  test('an anonymous visitor is redirected away from the review queue', async ({ page }) => {
    await page.goto('/en/studio/review')

    await expect(page).toHaveURL(/\/en$/u)
  })

  test('robots.txt keeps crawlers out of the studio', async ({ page }) => {
    const response = await page.goto('/robots.txt')
    const body = (await response?.text()) ?? ''

    expect(body).toContain('/en/studio/')
    expect(body).toContain('/fr/studio/')
  })
})

/**
 * Journeys 2–4 (draft → review → approve → publish) and 5 (reader accounts)
 * require a signed-in session, which needs the sign-in UI that lands next.
 * Written now and skipped, so the gap is visible in every CI run rather than
 * forgotten. docs/07-quality-gates.md § 3.
 */
test.describe('editorial cycle', () => {
  test.skip('journalist drafts with AI assist and submits for review', () => {
    // Blocked on the sign-in UI.
  })

  test.skip('editor rejects with a note, journalist revises, editor approves', () => {
    // Blocked on the sign-in UI.
  })

  test.skip('publishing makes the article live within the same request', () => {
    // Blocked on the sign-in UI.
  })

  test.skip('a scheduled article goes live at its time and invalidates the homepage', () => {
    // Blocked on the sign-in UI.
  })
})
