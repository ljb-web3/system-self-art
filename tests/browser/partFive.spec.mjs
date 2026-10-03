import { expect, test } from '@playwright/test'
import { mockParticipantIdentity } from './participantIdentityMock.mjs'

const storageKey = 'system-self-experiment-00-study'

test.beforeEach(async ({ page }) => {
  await mockParticipantIdentity(page)
})

test('Part 04 End flows into the persistent Part 05 answer and final subject acknowledgment', async ({ page }) => {
  await page.goto('/experiment/00/part-04/end')
  await page.getByRole('button', { name: 'YES', exact: true }).click()
  const partFourContinue = page.getByRole('link', { name: /CONTINUE/ })
  await expect(partFourContinue).toHaveAttribute('href', '/experiment/00/part-05')
  await partFourContinue.click()

  await expect(page).toHaveURL(/\/experiment\/00\/part-05$/)
  await expect(page.getByRole('heading', { name: 'PART 05' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'OBSERVE THE OBSERVER' })).toBeVisible()
  await expect(page.getByText('I have been behind the camera.', { exact: false })).toBeVisible()
  await expect(page.locator('.part-five-composition .video-placeholder')).toHaveCount(1)

  const question = 'Based only on the information available to you, would you want to connect further with me?'
  const answers = page.locator('.part-five-rating .observations-subject-option')
  await expect(page.getByText(question, { exact: true })).toBeVisible()
  await expect(answers).toHaveCount(2)
  await expect(answers).toHaveText(['YES', 'NO'])
  await expect(page.getByRole('link', { name: /CONTINUE/ })).toHaveCount(0)

  await answers.filter({ hasText: /^YES$/ }).click()
  await expect(answers.filter({ hasText: /^YES$/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('link', { name: /CONTINUE/ })).toBeVisible()
  await answers.filter({ hasText: /^NO$/ }).click()
  await expect(answers.filter({ hasText: /^NO$/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(answers.filter({ hasText: /^YES$/ })).toHaveAttribute('aria-pressed', 'false')

  let saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)
  expect(saved.part05.wantsFurtherConnection).toBe('no')
  expect(saved.currentStep).toBe('part-05')

  await page.reload()
  await expect(answers.filter({ hasText: /^NO$/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'FR', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'PARTIE 05' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'OBSERVE THE OBSERVER' })).toBeVisible()
  await expect(page.getByText(/avez-vous envie de “connecter” davantager avec moi/)).toBeVisible()
  await expect(answers).toHaveText(['OUI', 'NON'])
  await expect(answers.filter({ hasText: /^NON$/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'BLACK', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'black')

  const continueLink = page.getByRole('link', { name: /CONTINUER/ })
  await expect(continueLink).toHaveAttribute('href', '/experiment/00/end')
  const subjectNumber = 1024
  await continueLink.click()

  await expect(page).toHaveURL(/\/experiment\/00\/end$/)
  await expect(page.getByRole('heading', { name: 'FIN' })).toBeVisible()
  await expect(page.getByText(`MERCI, SUJET ${subjectNumber}`, { exact: true })).toBeVisible()
  await expect(page.locator('.study-back-link')).toHaveAttribute('href', '/experiment/00/part-05')
  saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)
  expect(saved.currentStep).toBe('end-experiment-00')

  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'END' })).toBeVisible()
  await expect(page.getByText(`THANK YOU, SUBJECT ${subjectNumber}`, { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'System Self' }).click()
  await page.getByRole('link', { name: 'EXPERIMENT 00', exact: true }).click()
  await expect(page).toHaveURL(/\/experiment\/00\/end$/)
})

test('Part 05 preserves main-page video geometry and the enlarged arrow stays fixed below SYSTEM SELF', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1080 })
  await page.goto('/experiment/00/part-01')
  const referenceVideo = await page.locator('.part-media .video-placeholder').boundingBox()

  await page.goto('/experiment/00/part-05')
  const partFiveVideo = await page.locator('.part-media .video-placeholder').boundingBox()
  expect(partFiveVideo).toEqual(referenceVideo)

  const arrow = page.locator('.study-back-link')
  const identity = page.locator('.identity')
  const arrowStyle = await arrow.evaluate(element => {
    const style = getComputedStyle(element)
    return { position: style.position, fontSize: Number.parseFloat(style.fontSize) }
  })
  expect(arrowStyle.position).toBe('fixed')
  expect(arrowStyle.fontSize).toBeGreaterThanOrEqual(54)

  const identityBounds = await identity.boundingBox()
  const arrowBounds = await arrow.boundingBox()
  expect(arrowBounds.x).toBeLessThan(100)
  expect(arrowBounds.y - (identityBounds.y + identityBounds.height)).toBeGreaterThan(15)
  expect(arrowBounds.y - (identityBounds.y + identityBounds.height)).toBeLessThan(55)

  await page.setViewportSize({ width: 1440, height: 600 })
  await page.goto('/experiment/00/part-04')
  const initialArrowY = (await arrow.boundingBox()).y
  await page.evaluate(() => window.scrollTo(0, 300))
  expect((await arrow.boundingBox()).y).toBeCloseTo(initialArrowY, 0)

  await page.goto('/experiment/00/part-05')
  await page.locator('.part-five-rating .observations-subject-option').filter({ hasText: /^YES$/ }).click()
  const contentMetrics = await page.evaluate(() => {
    const rating = document.querySelector('.part-five-rating')
    const continueElement = document.querySelector('.part-continue-link')
    return {
      ratingBottom: rating.getBoundingClientRect().bottom + window.scrollY,
      continueTop: continueElement.getBoundingClientRect().top + window.scrollY,
    }
  })
  expect(contentMetrics.continueTop - contentMetrics.ratingBottom).toBeGreaterThanOrEqual(110)
  expect(contentMetrics.continueTop - contentMetrics.ratingBottom).toBeLessThanOrEqual(114)
})

test('Part 04 and Part 05 Continue controls follow their completed interactions on the right', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/experiment/00/part-04')
  await page.getByRole('button', { name: 'WATCHED THE VIDEO?' }).click()
  await page.getByRole('button', { name: 'YES', exact: true }).click()
  let placement = await page.evaluate(() => {
    const interaction = document.querySelector('#part-four-watched-confirmation').getBoundingClientRect()
    const continueElement = document.querySelector('.part-continue-link')
    const bounds = continueElement.getBoundingClientRect()
    return {
      gap: bounds.top - interaction.bottom,
      right: window.innerWidth - bounds.right,
      position: getComputedStyle(continueElement).position,
    }
  })
  expect(placement.gap).toBeGreaterThanOrEqual(110)
  expect(placement.gap).toBeLessThanOrEqual(114)
  expect(placement.right).toBeCloseTo(46.08, 0)
  expect(placement.position).toBe('relative')

  await page.goto('/experiment/00/part-05')
  await page.locator('.part-five-rating .observations-subject-option').filter({ hasText: /^YES$/ }).click()
  placement = await page.evaluate(() => {
    const interaction = document.querySelector('.part-five-rating').getBoundingClientRect()
    const continueElement = document.querySelector('.part-continue-link')
    const bounds = continueElement.getBoundingClientRect()
    return {
      gap: bounds.top - interaction.bottom,
      right: window.innerWidth - bounds.right,
      position: getComputedStyle(continueElement).position,
    }
  })
  expect(placement.gap).toBeGreaterThanOrEqual(110)
  expect(placement.gap).toBeLessThanOrEqual(114)
  expect(placement.right).toBeCloseTo(46.08, 0)
  expect(placement.position).toBe('relative')
})
