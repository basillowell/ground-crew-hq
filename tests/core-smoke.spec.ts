import { test, expect } from '../playwright-fixture';
import type { Page } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8080';
const testEmail = process.env.PLAYWRIGHT_TEST_EMAIL;
const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD;

async function signIn(page: Page) {
  if (!testEmail || !testPassword) {
    test.skip(true, 'Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD to run authenticated tests.');
  }

  await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('input#email').fill(testEmail as string);
  await page.locator('input#password').fill(testPassword as string);
  await page.getByRole('button', { name: /get started|signing in/i }).click();
  await page.waitForURL('**/app/**', { timeout: 20000 });
}

test('user can load dashboard without crash', async ({ page }) => {
  await signIn(page);
  await page.goto(`${baseURL}/app/dashboard`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/workspace error recovered/i)).toHaveCount(0);
  await expect(page.getByText(/operations summary|today/i).first()).toBeVisible();
});

test('user can open weather page without runtime error', async ({ page }) => {
  await signIn(page);
  await page.goto(`${baseURL}/app/weather`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/workspace error recovered/i)).toHaveCount(0);
  await expect(page.getByText(/weather/i).first()).toBeVisible();
});

test('user can create a task successfully', async ({ page }) => {
  await signIn(page);
  await page.goto(`${baseURL}/app/tasks`, { waitUntil: 'domcontentloaded' });

  const taskName = `E2E Task ${Date.now()}`;
  await page.getByRole('button', { name: /add task/i }).first().click();
  await page.getByLabel(/task name/i).fill(taskName);
  await page.getByLabel(/^category$/i).fill('Operations');
  await page.getByLabel(/duration/i).fill('45');
  await page.getByRole('button', { name: /save task/i }).click();

  await expect(page.getByText(taskName)).toBeVisible({ timeout: 10000 });
});
