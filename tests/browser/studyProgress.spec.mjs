import { expect, test } from '@playwright/test'
import { mockParticipantIdentity } from './participantIdentityMock.mjs'

const storageKey = 'system-self-experiment-00-study'

test.beforeEach(async ({ page }) => {
  await mockParticipantIdentity(page)
})

test('Experiment 00 persists identity, answers, checkpoints, and resumes after Part 01', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('link', { name: 'EXPERIMENT 00', exact: true }).click()
  await page.getByRole('button', { name: 'EXPERIMENT 00', exact: true }).click()
  await page.getByRole('link', { name: /CONTINUE/ }).click()
  await expect(page).toHaveURL(/\/experiment\/00\/explanations$/)
  await page.getByRole('link', { name: /CONTINUE/ }).click()

  const subjectIdentity = page.getByText(/YOU ARE SUBJECT \d+/)
  await expect(subjectIdentity).toBeVisible()
  const subjectNumber = (await subjectIdentity.textContent()).match(/\d+/)[0]

  await page.getByLabel('WHAT IS YOUR AGE?').click()
  await page.getByRole('option', { name: '28', exact: true }).click()
  await page.getByLabel('WHAT IS YOUR COUNTRY?').click()
  await page.getByRole('option', { name: 'France', exact: true }).click()
  await page.getByLabel('WHAT IS YOUR GENDER?').click()
  await page.getByRole('option', { name: 'WOMAN', exact: true }).click()
  await page.getByLabel('WHAT IS YOUR ETHNICITY?').click()
  await page.getByRole('option', { name: 'WHITE', exact: true }).click()

  await page.reload()
  await expect(page.getByText(`YOU ARE SUBJECT ${subjectNumber}`)).toBeVisible()
  await expect(page.getByLabel('WHAT IS YOUR AGE?')).toHaveText('28')
  await page.getByRole('link', { name: /CONTINUE/ }).click()

  await page.getByRole('button', { name: 'WATCHED THE VIDEO?' }).click()
  await page.getByRole('button', { name: 'YES', exact: true }).click()
  await page.getByRole('button', { name: 'SUBJECT 1', exact: true }).click()
  await page.getByRole('button', { name: '5', exact: true }).click()
  await page.getByRole('button', { name: 'SUBJECT 2', exact: true }).click()
  await page.getByRole('button', { name: '6', exact: true }).last().click()
  await page.getByRole('link', { name: /CONTINUE/ }).click()

  await page.getByRole('button', { name: 'SUBJECT 2', exact: true }).click()
  await page.locator('#observations-reason').fill('A quiet sense of recognition.')
  await page.getByRole('link', { name: /CONTINUE/ }).click()

  const words = [
    'attentive', 'patient', 'curious', 'gentle', 'reserved',
    'direct', 'restless', 'careful', 'distant', 'watchful',
    'open', 'reflective', 'uncertain', 'warm', 'present',
  ]
  const wordInputs = page.locator('.observations-word-input')
  for (let index = 0; index < words.length; index += 1) {
    await wordInputs.nth(index).fill(words[index])
  }

  await page.reload()
  await expect(wordInputs.first()).toHaveValue('attentive')
  await expect(wordInputs.last()).toHaveValue('present')
  await page.getByRole('link', { name: /CONTINUE/ }).click()

  await expect(page).toHaveURL(/\/experiment\/00\/part-01\/reveal$/)
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).currentStep, storageKey))
    .toBe('reveal-part-01')
  await page.getByRole('link', { name: /CONTINUE/ }).click()

  await expect(page).toHaveURL(/\/experiment\/00\/part-01\/end$/)
  await page.getByRole('link', { name: 'NO', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  const savedAtEnd = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)
  expect(savedAtEnd.currentStep).toBe('end-part-01')
  expect(savedAtEnd).not.toHaveProperty('subjectNumber')
  expect(savedAtEnd.part01).toEqual({
    subject1ConnectionRating: 5,
    subject2ConnectionRating: 6,
  })
  expect(savedAtEnd.observationsPart01.selectedSubject).toBe('subject-2')
  expect(savedAtEnd.observationsPart01.selfWords).toEqual(words.slice(10))

  await page.getByRole('link', { name: 'EXPERIMENT 00', exact: true }).click()
  await expect(page).toHaveURL(/\/experiment\/00\/part-01\/end$/)
  await expect(page.getByRole('heading', { name: 'END OF PART 01' })).toBeVisible()

  const continueLink = page.getByRole('link', { name: /CONTINUE/ })
  await expect(continueLink).toHaveCount(0)
  await page.getByRole('button', { name: 'YES', exact: true }).click()
  await expect(page.getByRole('button', { name: 'YES', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(continueLink).toBeVisible()

  const continueBounds = await continueLink.boundingBox()
  const viewport = page.viewportSize()
  expect(continueBounds.x + continueBounds.width).toBeGreaterThan(viewport.width * 0.8)
  expect(continueBounds.y + continueBounds.height).toBeGreaterThan(viewport.height * 0.8)

  await continueLink.click()
  await expect(page).toHaveURL(/\/experiment\/00\/part-02$/)
  const savedAtPartTwo = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)
  expect(savedAtPartTwo.currentStep).toBe('part-02')
  expect(savedAtPartTwo.participantId).toBe(savedAtEnd.participantId)
})
