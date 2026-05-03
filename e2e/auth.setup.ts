import { test as setup } from '@playwright/test'
import * as path from 'path'

const authFile = path.join(__dirname, '../.playwright/auth.json')

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('input[type="email"]', { timeout: 10000 })
  await page.fill('input[type="email"]', process.env.TEST_EMAIL ?? '')
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD ?? '')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/app/**', { timeout: 15000 })
  await page.context().storageState({ path: authFile })
})
