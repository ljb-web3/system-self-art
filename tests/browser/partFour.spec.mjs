import { expect, test } from '@playwright/test'

const storageKey = 'system-self-experiment-00-study'

test('Part 04 follows its Observer Zero flow and persists every answer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/experiment/00/part-04')

  await expect(page.getByRole('heading', { name: 'PART 04' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'OBSERVE... THE OBSERVER??' })).toBeVisible()
  await expect(page.getByText('The conditions have changed this time.', { exact: false })).toBeVisible()
  await expect(page.locator('.video-placeholder')).toHaveCount(1)
  await expect(page.locator('.rating-options')).toHaveCount(0)
  await expect(page.locator('.timestamps')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /CONTINUE/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'WATCHED THE VIDEO?' }).click()
  await page.getByRole('button', { name: 'NO', exact: true }).click()
  await expect(page.getByRole('link', { name: /CONTINUE/ })).toHaveCount(0)
  let saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)
  expect(saved.part04.watchedVideo).toBe('no')
  expect(saved.currentStep).toBe('part-04')

  await page.getByRole('button', { name: 'YES', exact: true }).click()
  const mainContinue = page.getByRole('link', { name: /CONTINUE/ })
  await expect(mainContinue).toHaveAttribute('href', '/experiment/00/part-04/observations')
  await page.reload()
  await expect(page.getByRole('link', { name: /CONTINUE/ })).toBeVisible()
  await page.getByRole('button', { name: 'FR', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'PARTIE 04' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'OBSERVEZ... L’OBSERVATRICE ??' })).toBeVisible()
  await page.getByRole('button', { name: 'BLACK', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'black')
  await page.getByRole('link', { name: /CONTINUER/ }).click()

  await expect(page).toHaveURL(/\/part-04\/observations$/)
  await expect(page.locator('.observations-question')).toHaveCount(3)
  await expect(page.locator('.observations-step')).toHaveCount(0)
  await expect(page.locator('.observations-word-input')).toHaveCount(0)
  await expect(page.locator('#observations-reason')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /CONTINUER/ })).toHaveCount(0)

  const questions = page.locator('.observations-question')
  await questions.nth(0).getByRole('button', { name: 'SUJET 1', exact: true }).click()
  await questions.nth(1).getByRole('button', { name: 'OUI', exact: true }).click()
  await expect(page.getByRole('link', { name: /CONTINUER/ })).toHaveCount(0)
  await questions.nth(2).getByRole('button', { name: 'NON', exact: true }).click()
  await expect(page.getByRole('link', { name: /CONTINUER/ })).toBeVisible()

  await page.reload()
  await expect(questions.nth(0).getByRole('button', { name: 'SUBJECT 1', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(questions.nth(1).getByRole('button', { name: 'YES', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(questions.nth(2).getByRole('button', { name: 'NO', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('link', { name: /CONTINUE/ }).click()

  await expect(page).toHaveURL(/\/part-04\/reveal$/)
  await expect(page.getByRole('heading', { name: 'PART 04 : REVEAL' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'OBSERVER ZERO: ANSWERS' })).toBeVisible()
  await expect(page.locator('.part-four-reveal-media .video-placeholder')).toHaveCount(1)
  await expect(page.locator('.reveal-media')).toHaveCount(0)
  const revealContinue = page.getByRole('link', { name: /CONTINUE/ })
  await expect(revealContinue).toHaveAttribute('href', '/experiment/00/part-04/comparison')
  await revealContinue.click()

  await expect(page).toHaveURL(/\/part-04\/comparison$/)
  await expect(page.getByRole('heading', { name: "WERE YOUR ANSWERS CLOSER THAN OBSERVER ZERO'S?" })).toBeVisible()
  await expect(page.locator('.part-four-comparison-content .part-end-option')).toHaveCount(2)
  await expect(page.getByRole('link', { name: /CONTINUE/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'YES', exact: true }).click()
  await expect(page.getByRole('link', { name: /CONTINUE/ })).toHaveAttribute('href', '/experiment/00/part-04/end')
  await page.reload()
  await expect(page.getByRole('button', { name: 'YES', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('link', { name: /CONTINUE/ }).click()

  await expect(page.getByRole('heading', { name: 'END OF PART 04' })).toBeVisible()
  await expect(page.getByText('ARE YOU READY FOR PART 05?', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'YES', exact: true }).click()
  await expect(page.getByRole('link', { name: /CONTINUE/ })).toHaveAttribute('href', '/experiment/00/part-05')

  saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)
  expect(saved.part04).toEqual({
    watchedVideo: 'yes',
    observations: {
      observerConnection: 'subject-1',
      observerAccuracy: 'yes',
      selfAccuracy: 'no',
    },
    comparison: 'yes',
  })
  expect(saved.currentStep).toBe('end-part-04')
})

test('Part 04 uses normal video geometry, centers its Reveal video, and supports End NO resume', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1080 })
  await page.goto('/experiment/00/part-01')
  const normalVideo = await page.locator('.video-placeholder').boundingBox()

  await page.goto('/experiment/00/part-04')
  const partFourVideo = await page.locator('.video-placeholder').boundingBox()
  expect(partFourVideo).toEqual(normalVideo)

  await page.goto('/experiment/00/part-04/reveal')
  const revealVideo = await page.locator('.part-four-reveal-media .video-placeholder').boundingBox()
  expect(revealVideo.width).toBeCloseTo(normalVideo.width, 0)
  expect(revealVideo.height).toBeCloseTo(normalVideo.height, 0)
  expect(revealVideo.x + revealVideo.width / 2).toBeCloseTo(1280, 0)
  expect(revealVideo.width / revealVideo.height).toBeCloseTo(16 / 9, 2)

  await page.goto('/experiment/00/part-04/end')
  await page.getByRole('link', { name: 'NO', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).currentStep, storageKey))
    .toBe('end-part-04')
  await page.getByRole('link', { name: 'EXPERIMENT 00', exact: true }).click()
  await expect(page).toHaveURL(/\/experiment\/00\/part-04\/end$/)
})
