import { test, expect } from '@playwright/test'

test.use({ storageState: '.playwright/auth.json' })

test('dashboard loads with crew summary', async ({ page }) => {
  await page.goto('/app/dashboard')
  await expect(page.getByText("Today's Operations Summary")).toBeVisible()
  await expect(page.getByText("Build Today's Plan")).toBeVisible()
})

test('field page loads on mobile', async ({ page }) => {
  await page.goto('/app/field')
  await expect(page.getByText('Clock In')).toBeVisible()
})

test('workboard loads', async ({ page }) => {
  await page.goto('/app/workboard')
  await expect(page.getByText('Workflow')).toBeVisible()
})
