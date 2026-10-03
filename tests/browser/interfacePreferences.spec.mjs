import { expect, test } from '@playwright/test'

const languageKey = 'system-self-language-preference'
const themeKey = 'system-self-theme-preference'

async function setBrowserLanguages(page, languages, language = languages[0] ?? 'de-DE') {
  await page.addInitScript(({ languages, language }) => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => languages })
    Object.defineProperty(navigator, 'language', { configurable: true, get: () => language })
    requestAnimationFrame(() => {
      window.__firstFramePreferences = {
        language: document.documentElement.lang,
        theme: document.documentElement.dataset.theme,
      }
    })
  }, { languages, language })
}

for (const [languages, expected] of [
  [['fr-FR', 'en-US'], 'fr'],
  [['en-US', 'fr-FR'], 'en'],
  [['de-DE', 'fr-FR'], 'fr'],
  [['de-DE'], 'en'],
  [['fr-CA'], 'fr'],
]) {
  test(`fresh preferences choose ${expected.toUpperCase()} for ${languages.join(', ')}`, async ({ page }) => {
    await setBrowserLanguages(page, languages)
    await page.goto('/')

    await expect(page.locator('html')).toHaveAttribute('lang', expected)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'black')
    await expect(page.getByRole('button', { name: expected.toUpperCase(), exact: true }))
      .toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => page.evaluate(() => window.__firstFramePreferences)).toEqual({
      language: expected,
      theme: 'black',
    })
    expect(await page.evaluate(({ languageKey, themeKey }) => ({
      language: localStorage.getItem(languageKey),
      theme: localStorage.getItem(themeKey),
    }), { languageKey, themeKey })).toEqual({ language: null, theme: null })
  })
}

test('navigator.language is used when navigator.languages has no supported locale', async ({ page }) => {
  await setBrowserLanguages(page, ['de-DE'], 'fr-BE')
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
})

for (const [browserLanguage, savedLanguage] of [
  ['fr-FR', 'en'],
  ['en-US', 'fr'],
]) {
  test(`saved ${savedLanguage.toUpperCase()} overrides ${browserLanguage}`, async ({ page }) => {
    await setBrowserLanguages(page, [browserLanguage])
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: languageKey,
      value: savedLanguage,
    })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', savedLanguage)
    await expect.poll(() => page.evaluate(() => window.__firstFramePreferences.language))
      .toBe(savedLanguage)
  })
}

for (const savedTheme of ['white', 'black']) {
  test(`saved ${savedTheme.toUpperCase()} theme wins before first paint`, async ({ page }) => {
    await setBrowserLanguages(page, ['en-US'])
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: themeKey,
      value: savedTheme,
    })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', savedTheme)
    await expect.poll(() => page.evaluate(() => window.__firstFramePreferences.theme))
      .toBe(savedTheme)
    await expect(page.getByRole('button', { name: savedTheme.toUpperCase(), exact: true }))
      .toHaveAttribute('aria-pressed', 'true')
  })
}

test('manual language and theme choices persist across refresh and study pages', async ({ page }) => {
  await setBrowserLanguages(page, ['fr-FR', 'en-US'])
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'black')

  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await page.getByRole('button', { name: 'WHITE', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'white')
  expect(await page.evaluate(({ languageKey, themeKey }) => ({
    language: localStorage.getItem(languageKey),
    theme: localStorage.getItem(themeKey),
  }), { languageKey, themeKey })).toEqual({ language: 'en', theme: 'white' })

  await page.reload()
  await expect(page.getByRole('button', { name: 'EN', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'WHITE', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => page.evaluate(() => window.__firstFramePreferences)).toEqual({
    language: 'en',
    theme: 'white',
  })

  await page.goto('/experiment/00/explanations')
  await expect(page.getByRole('heading', { name: 'EXPLANATIONS' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'white')
  await page.getByRole('button', { name: 'FR', exact: true }).click()
  await page.getByRole('button', { name: 'BLACK', exact: true }).click()
  await page.goto('/experiment/00/part-05')
  await expect(page.getByRole('heading', { name: 'PARTIE 05' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'black')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'black')
})
