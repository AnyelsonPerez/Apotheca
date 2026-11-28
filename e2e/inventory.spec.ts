import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Login as the seeded user before each inventory test
  await page.goto('/')
  await page.fill('input[placeholder="tu@email.com"]', 'e2e@example.com')
  await page.fill('input[placeholder="••••••••"]', 'e2etestpassword123')
  await page.getByRole('button', { name: /entrar/i }).click()
  await expect(page.getByRole('main').getByText('Dashboard')).toBeVisible({ timeout: 15_000 })
})

test.describe('Inventory', () => {
  test('navigate to inventory page', async ({ page }) => {
    await page.getByRole('link', { name: 'Inventario' }).click()
    await expect(page).toHaveURL(/.*\/inventory/, { timeout: 10_000 })
  })

  test('inventory page shows seeded medication', async ({ page }) => {
    await page.getByRole('link', { name: 'Inventario' }).click()
    await expect(page).toHaveURL(/.*\/inventory/, { timeout: 10_000 })
    // The seeded medication might take a moment to load
    await expect(page.locator('text=Test')).toBeVisible({ timeout: 15_000 })
  })

  test('navigate to search page', async ({ page }) => {
    await page.getByRole('link', { name: 'Buscar' }).click()
    await expect(page).toHaveURL(/.*\/search/, { timeout: 10_000 })
  })

  test('search page has a search input', async ({ page }) => {
    await page.getByRole('link', { name: 'Buscar' }).click()
    await expect(page).toHaveURL(/.*\/search/, { timeout: 10_000 })
    // The search page should have some kind of input
    await expect(page.locator('input')).toBeVisible({ timeout: 10_000 })
  })
})
