import { expect, test } from '@playwright/test'
import { resetRateLimits } from './seed'

test.beforeEach(async () => {
  await resetRateLimits()
})

/**
 * Journey — a reader writes to the newsroom (KUR-62).
 *
 * Mail is deliberately unconfigured under e2e, so the honest outcome is the
 * fail-closed delivery error, not a success screen. A green "sent" here would
 * mean the form claims a delivery it did not make.
 */
test.describe('contact', () => {
  test('the page offers the newsroom form', async ({ page }) => {
    await page.goto('/en/contact')

    await expect(
      page.getByRole('heading', { name: 'Write to the newsroom', level: 2 }),
    ).toBeVisible()
    await expect(page.getByLabel('Name')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Message')).toBeVisible()
  })

  test('an undeliverable message says so instead of pretending', async ({ page }) => {
    await page.goto('/en/contact')
    await page.getByLabel('Name').fill('E2E Reader')
    await page.getByLabel('Email').fill('reader@example.com')
    await page.getByLabel('Message').fill('Correction: the budget figure is from 2025.')

    await page.getByRole('button', { name: 'Send message' }).click()

    await expect(page.getByRole('status')).toHaveText(/could not deliver/iu)
  })

  test('the form refuses to be a spam cannon', async ({ page }) => {
    await page.goto('/en/contact')
    await page.getByLabel('Name').fill('E2E Reader')
    await page.getByLabel('Email').fill('reader@example.com')
    await page.getByLabel('Message').fill('Same note, again.')

    // RULES.contact allows 5 per minute and fails closed; a failed delivery
    // still consumes, so the sixth click is the one refused. The fields are
    // only cleared on success, which is what makes resubmitting possible.
    const send = page.getByRole('button', { name: 'Send message' })
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await send.click()
      await expect(page.getByRole('status')).toHaveText(/could not deliver/iu)
    }

    await send.click()

    await expect(page.getByRole('status')).toHaveText(/too many requests/iu)
  })
})
