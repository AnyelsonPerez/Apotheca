import { test, expect } from '@playwright/test'

test.describe('Auth flow', () => {
  test('register a new user and see dashboard', async ({ page }) => {
    await page.goto('/')
    // Switch to register mode
    await page.getByText('Regístrate').click()
    await expect(page.getByText('Crea tu cuenta')).toBeVisible()

    // Fill the registration form
    const uniqueEmail = `e2e-auth-${Date.now()}@example.com`
    await page.fill('input[placeholder="Tu nombre"]', 'E2E Auth Test')
    await page.fill('input[placeholder="tu@email.com"]', uniqueEmail)
    await page.fill('input[placeholder="••••••••"]', 'e2etestpassword123')
    await page.getByRole('button', { name: /crear cuenta/i }).click()

    // Should redirect to dashboard (protected route)
    await expect(page).toHaveURL(/.*\//, { timeout: 15_000 })
    // Dashboard should show nav items
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Inventario')).toBeVisible()
  })

  test('login with seeded user and logout', async ({ page }) => {
    await page.goto('/')
    // Login with seeded user
    await page.fill('input[placeholder="tu@email.com"]', 'e2e@example.com')
    await page.fill('input[placeholder="••••••••"]', 'e2etestpassword123')
    await page.getByRole('button', { name: /entrar/i }).click()

    // Should see dashboard
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 15_000 })

    // Logout
    await page.getByText('Cerrar sesión').click()
    // Should redirect back to login
    await expect(page.locator('text=Inicia sesión')).toBeVisible({ timeout: 10_000 })
  })

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[placeholder="tu@email.com"]', 'e2e@example.com')
    await page.fill('input[placeholder="••••••••"]', 'wrongpassword')
    await page.getByRole('button', { name: /entrar/i }).click()
    // Should show an error notification
    await expect(page.locator('text=/incorrectos/i')).toBeVisible({ timeout: 10_000 })
  })
})
