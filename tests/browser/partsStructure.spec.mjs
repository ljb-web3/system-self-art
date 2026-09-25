import { expect, test } from '@playwright/test'

const storageKey = 'system-self-experiment-00-study'

async function completeRatings(page) {
  await page.getByRole('button', { name: 'WATCHED THE VIDEO?' }).click()
  await page.getByRole('button', { name: 'YES', exact: true }).click()
  await page.getByRole('button', { name: 'SUBJECT 1', exact: true }).click()
  await page.getByRole('button', { name: '5', exact: true }).click()
  await page.getByRole('button', { name: 'SUBJECT 2', exact: true }).click()
  await page.getByRole('button', { name: '6', exact: true }).last().click()
}

async function completeObservationWords(page) {
  const inputs = page.locator('.observations-word-input')
  for (let index = 0; index < await inputs.count(); index += 1) {
    await inputs.nth(index).fill(`word-${index + 1}`)
  }
}

test('Part 02 follows the shared main, observations, Reveal, and End flow into Part 03', async ({ page }) => {
  await page.goto('/experiment/00/part-02')
  await expect(page.getByRole('heading', { name: 'PART 02' })).toBeVisible()
  await expect(page.getByText('PART 02 VIDEO PLACEHOLDER', { exact: true })).toBeVisible()
  await expect(page.locator('.timestamp-option')).toHaveCount(3)

  await completeRatings(page)
  let continueLink = page.getByRole('link', { name: /CONTINUE/ })
  await expect(continueLink).toHaveAttribute('href', '/experiment/00/part-02/observations')
  await continueLink.click()

  await expect(page).toHaveURL(/\/part-02\/observations$/)
  await expect(page.getByLabel('1 / 2')).toBeVisible()
  await page.getByRole('button', { name: 'SUBJECT 1', exact: true }).click()
  await page.getByRole('link', { name: /CONTINUE/ }).click()

  await expect(page).toHaveURL(/\/part-02\/observations\/2$/)
  await expect(page.getByLabel('2 / 2')).toBeVisible()
  await expect(page.locator('.observations-word-question')).toHaveCount(2)
  await expect(page.locator('.observations-word-input')).toHaveCount(6)
  await completeObservationWords(page)
  await page.getByRole('link', { name: /CONTINUE/ }).click()

  await expect(page).toHaveURL(/\/part-02\/reveal$/)
  await expect(page.getByRole('heading', { name: 'PART 02 : REVEAL' })).toBeVisible()
  await expect(page.locator('.reveal-media .video-placeholder')).toHaveCount(2)
  await expect(page.locator('.reveal-subject-label')).toHaveText(['SUBJECT 1', 'SUBJECT 2'])
  continueLink = page.getByRole('link', { name: /CONTINUE/ })
  await expect(continueLink).toHaveAttribute('href', '/experiment/00/part-02/end')
  await continueLink.click()

  await expect(page.getByRole('heading', { name: 'END OF PART 02' })).toBeVisible()
  await expect(page.getByText('ARE YOU READY FOR PART 03?', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'YES', exact: true }).click()
  continueLink = page.getByRole('link', { name: /CONTINUE/ })
  await expect(continueLink).toHaveAttribute('href', '/experiment/00/part-03')
  await continueLink.click()

  await expect(page).toHaveURL(/\/experiment\/00\/part-03$/)
  await expect(page.getByRole('heading', { name: 'PART 03' })).toBeVisible()
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).currentStep, storageKey))
    .toBe('part-03')
})

test('Part 03 exposes every route and continues to Part 04', async ({ page }) => {
  await page.goto('/experiment/00/part-03')
  await expect(page.getByRole('heading', { name: 'PART 03' })).toBeVisible()
  await expect(page.getByText('PART 03 VIDEO PLACEHOLDER', { exact: true })).toBeVisible()

  await page.goto('/experiment/00/part-03/observations')
  await expect(page.getByRole('heading', { name: 'OBSERVATIONS' })).toBeVisible()
  await expect(page.getByLabel('1 / 2')).toBeVisible()

  await page.goto('/experiment/00/part-03/observations/2')
  await expect(page.getByLabel('2 / 2')).toBeVisible()
  await expect(page.locator('.observations-word-question')).toHaveCount(2)
  await expect(page.locator('.observations-word-input')).toHaveCount(6)

  await page.goto('/experiment/00/part-03/reveal')
  await expect(page.getByRole('heading', { name: 'PART 03 : REVEAL' })).toBeVisible()
  await expect(page.locator('.reveal-media .video-placeholder')).toHaveCount(2)
  const continueLink = page.getByRole('link', { name: /CONTINUE/ })
  await expect(continueLink).toHaveAttribute('href', '/experiment/00/part-03/end')
  await continueLink.click()

  await expect(page.getByRole('heading', { name: 'END OF PART 03' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'YES', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /CONTINUE/ }))
    .toHaveAttribute('href', '/experiment/00/part-04')
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).currentStep, storageKey))
    .toBe('end-part-03')
  await page.getByRole('link', { name: /CONTINUE/ }).click()
  await expect(page).toHaveURL(/\/experiment\/00\/part-04$/)
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).currentStep, storageKey))
    .toBe('part-04')
})

test('all Reveal pages share geometry, localization, and the raised Continue position', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1080 })
  const geometries = []

  for (const part of ['01', '02', '03']) {
    await page.goto(`/experiment/00/part-${part}/reveal`)
    const videos = page.locator('.reveal-media .video-placeholder')
    geometries.push({
      left: await videos.first().boundingBox(),
      right: await videos.last().boundingBox(),
    })
  }

  for (const geometry of geometries.slice(1)) {
    expect(geometry.left).toEqual(geometries[0].left)
    expect(geometry.right).toEqual(geometries[0].right)
  }

  await page.getByRole('button', { name: 'FR', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'PARTIE 03 : RÉSULTATS' })).toBeVisible()
  await expect(page.locator('.reveal-subject-label')).toHaveText(['SUJET 1', 'SUJET 2'])
  await page.getByRole('button', { name: 'BLACK', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'black')

  const revealPage = page.locator('.experiment-reveal-page')
  const continueLink = page.getByRole('link', { name: /CONTINUER/ })
  const spacing = await Promise.all([
    revealPage.evaluate(element => element.getBoundingClientRect().bottom),
    continueLink.evaluate(element => element.getBoundingClientRect().bottom),
  ])
  expect(spacing[0] - spacing[1]).toBeGreaterThan(80)
})

test('Part 02 End NO preserves its checkpoint and returns home', async ({ page }) => {
  await page.goto('/experiment/00/part-02/end')
  await page.getByRole('link', { name: 'NO', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).currentStep, storageKey))
    .toBe('end-part-02')

  await page.getByRole('link', { name: 'EXPERIMENT 00', exact: true }).click()
  await expect(page).toHaveURL(/\/experiment\/00\/part-02\/end$/)
})
