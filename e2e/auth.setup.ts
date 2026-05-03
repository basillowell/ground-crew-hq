import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '../.playwright/auth.json')

setup('authenticate', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('Email').fill(process.env.TEST_EMAIL || '')
  await page.getByPlaceholder('Password').fill(process.env.TEST_PASSWORD || '')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/app/**')
  await page.context().storageState({ path: authFile })
  await expect(page).toHaveURL(/\/app\//)
})
