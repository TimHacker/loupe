import { test, expect } from '@playwright/test'

test('home renders the app title', async ({ page }) => {
  await page.goto('/claude-reader/')
  await expect(page.getByRole('heading', { name: 'Claude Reader' })).toBeVisible()
})
