import { test, expect } from '@playwright/test'

test.use({ storageState: '.playwright/auth.json' })

test('dashboard loads with operations summary', async ({ page }) => {
  await page.goto('/app/dashboard')
  await expect(page.getByText("Today's Operations Summary")).toBeVisible({ timeout: 10000 })
  await expect(page.getByText("Build Today's Plan")).toBeVisible()
})

test('workboard loads and shows board date', async ({ page }) => {
  await page.goto('/app/workboard')
  await expect(page.getByText('Workflow')).toBeVisible({ timeout: 10000 })
})

test('field page loads with clock in button', async ({ page }) => {
  await page.goto('/app/field')
  await expect(page.getByRole('button', { name: /clock in/i })).toBeVisible({ timeout: 10000 })
})

test('scheduler loads with weekly grid', async ({ page }) => {
  await page.goto('/app/scheduler')
  await expect(page.getByText('Weekly Schedule')).toBeVisible({ timeout: 10000 })
})

test('settings loads with sidebar nav', async ({ page }) => {
  await page.goto('/app/settings')
  await expect(page.getByText('Brand & Identity')).toBeVisible({ timeout: 10000 })
})

test('login page is accessible when signed out', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8000 })
})
