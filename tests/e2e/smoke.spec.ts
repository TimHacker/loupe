import { test, expect } from '@playwright/test'

test('home renders the app title', async ({ page }) => {
  await page.goto('/loupe/')
  await expect(page.getByRole('heading', { name: 'Loupe' })).toBeVisible()
})
