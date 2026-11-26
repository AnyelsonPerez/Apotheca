import { test, expect } from '@playwright/test'

test.describe('Smoke', () => {
  test('app loads and shows login page', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Apotheca')).toBeVisible({ timeout: 30_000 })
  })

  test('login form is visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Inicia sesión')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('input[placeholder="tu@email.com"]')).toBeVisible()
    await expect(page.locator('input[placeholder="••••••••"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible()
  })
})
