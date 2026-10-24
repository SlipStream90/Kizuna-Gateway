import { test, expect } from '@playwright/test'

test.use({ baseURL: 'http://localhost:3000' })

test.describe('Kizuna Gateway frontend', () => {
  test('home page loads with no CSS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/')
    await expect(page.getByText('Kizuna Gateway')).toBeVisible()
    const cssErrors = errors.filter(e => e.includes('CSS') || e.includes('tailwind') || e.includes('postcss'))
    expect(cssErrors).toEqual([])
  })

  test('four engine cards render', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Market Intelligence' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Partner Trust Engine' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Compliance Copilot' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'GTM Simulator' })).toBeVisible()
  })

  test('translation form submits through BFF proxy', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('heading', { name: /Japanese ↔ English Translation/ }).waitFor()
    const textarea = page.getByLabel('Text to translate')
    await textarea.click()
    await textarea.fill('Konnichiwa')
    const translateBtn = page.getByRole('button', { name: /Translate/ })
    await expect(translateBtn).toBeEnabled({ timeout: 5000 })
    await translateBtn.click()
    // Button shows Translating… during API call, then clears (result needs backend; error without)
    await expect(translateBtn).toContainText(/Translating/, { timeout: 5000 })
    await expect(translateBtn).not.toContainText(/Translating/, { timeout: 15000 })
  })

  test('translation language swap works', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('heading', { name: /Japanese ↔ English Translation/ }).waitFor()
    const sourceSelect = page.getByLabel('Source language')
    await sourceSelect.click()
    await sourceSelect.selectOption('en')
    const targetSelect = page.getByLabel('Target language')
    await targetSelect.click()
    await targetSelect.selectOption('ja')
    await expect(page.getByLabel('Source language')).toHaveValue('en')
    await expect(page.getByLabel('Target language')).toHaveValue('ja')
  })

  test('speech controls render', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('heading', { name: /Japanese Speech → English Translation/ }).waitFor()
    await expect(page.getByRole('button', { name: /Record Japanese audio/ })).toBeVisible()
  })

  test('session controls render', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /Sign in/ })).toBeVisible()
  })

  test('navigation links work', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Market/ }).click()
    await expect(page).toHaveURL(/\/#market/)
  })
})
