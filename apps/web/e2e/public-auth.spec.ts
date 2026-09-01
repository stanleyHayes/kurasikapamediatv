import { expect, test } from '@playwright/test'

test.describe('public reader registration', () => {
  test('Create one opens the registration page', async ({ page }) => {
    await page.goto('/en/sign-in')
    await page.getByRole('link', { name: 'Create one' }).click()

    await expect(page).toHaveURL(/\/en\/sign-up$/u)
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
  })

  test('disables submission, animates progress and returns to sign-in', async ({ page }) => {
    let release: (() => void) | undefined
    const held = new Promise<void>((resolve) => {
      release = resolve
    })

    await page.route('**/api/session/register', async (route) => {
      await held
      await route.fulfill({ status: 202, contentType: 'application/json', body: '{"accepted":true}' })
    })
    await page.goto('/en/sign-up')
    await page.getByLabel('Name').fill('Demo Reader')
    await page.getByLabel('Email').fill('reader@example.com')
    await page.getByLabel('Password').fill('CarefulReader2026!')

    const submit = page.getByRole('button', { name: /create account/iu })
    await submit.click()
    await expect(page.getByRole('button', { name: /creating account/iu })).toBeDisabled()
    await expect(page.getByRole('button', { name: /creating account/iu }).locator('[aria-hidden] span')).toHaveCount(3)

    release?.()
    await expect(page).toHaveURL(/\/en\/sign-in\?registered=1$/u)
    await expect(page.getByRole('status')).toContainText('Account request accepted')
  })
})
