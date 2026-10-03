import { expect, test } from '@playwright/test'

const storageKey = 'system-self-experiment-00-study'

test('Welcome Continue stays conditional and appears in the bottom-right', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/experiment/00/welcome')

  const continueLink = page.locator('.welcome-continue-link')
  await expect(continueLink).toHaveCount(0)

  await page.getByLabel('WHAT IS YOUR AGE?').click()
  await page.getByRole('option', { name: '28', exact: true }).click()
  await page.getByLabel('WHAT IS YOUR COUNTRY?').click()
  await page.getByRole('option', { name: 'France', exact: true }).click()
  await expect(continueLink).toBeVisible()

  const bounds = await continueLink.boundingBox()
  expect(bounds.x + bounds.width).toBeGreaterThan(1100)
  expect(bounds.y + bounds.height).toBeGreaterThan(780)
})

for (const part of ['02', '03']) {
  test(`Part ${part} observations show two optional groups of three words`, async ({ page }) => {
    await page.goto(`/experiment/00/part-${part}/observations/2`)

    const questions = page.locator('.observations-word-question')
    const inputs = page.locator('.observations-word-input')
    const continueLink = page.locator('.observations-continue-link')

    await expect(questions).toHaveCount(2)
    await expect(inputs).toHaveCount(6)
    await expect(questions.nth(0).getByRole('heading')).toContainText(
      part === '02' ? 'DESCRIBE THE SUBJECT YOU CHOSE IN THREE WORDS.' : 'DESCRIBE SUBJECT 1 IN THREE WORDS.',
    )
    await expect(questions.nth(1).getByRole('heading')).toContainText(
      part === '02' ? 'DESCRIBE YOURSELF IN THREE WORDS.' : 'DESCRIBE SUBJECT 2 IN THREE WORDS.',
    )
    await expect(questions.locator('.observations-optional')).toHaveText(['OPTIONAL', 'OPTIONAL'])
    expect(await inputs.evaluateAll(elements => elements.map(element => element.placeholder))).toEqual([
      'WORD 1', 'WORD 2', 'WORD 3', 'WORD 1', 'WORD 2', 'WORD 3',
    ])
    await expect(continueLink).toBeVisible()

    await inputs.nth(0).fill(`part-${part}-first`)
    await inputs.nth(4).fill(`part-${part}-second`)
    await expect(continueLink).toBeVisible()

    await page.getByRole('button', { name: 'FR', exact: true }).click()
    await expect(questions).toHaveCount(2)
    await expect(questions.locator('.observations-optional')).toHaveText(['FACULTATIF', 'FACULTATIF'])
    expect(await inputs.evaluateAll(elements => elements.map(element => element.placeholder))).toEqual([
      'MOT 1', 'MOT 2', 'MOT 3', 'MOT 1', 'MOT 2', 'MOT 3',
    ])
    await expect(inputs.nth(0)).toHaveValue(`part-${part}-first`)
    await expect(inputs.nth(4)).toHaveValue(`part-${part}-second`)
    await expect(continueLink).toBeVisible()

    await page.getByRole('button', { name: 'BLACK', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'black')
    await expect(inputs.nth(0)).toHaveValue(`part-${part}-first`)
    await expect(continueLink).toBeVisible()

    await page.reload()
    await expect(inputs.nth(0)).toHaveValue(`part-${part}-first`)
    await expect(inputs.nth(4)).toHaveValue(`part-${part}-second`)
    await expect(continueLink).toBeVisible()
  })
}

test('experiment pages expose explicit previous-study routes without changing saved state', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.study-back-link')).toHaveCount(0)

  const routes = [
    ['/experiment/00', '/'],
    ['/experiment/00/explanations', '/experiment/00'],
    ['/experiment/00/welcome', '/experiment/00/explanations'],
    ['/experiment/00/part-01', '/experiment/00/welcome'],
    ['/experiment/00/part-01/observations', '/experiment/00/part-01'],
    ['/experiment/00/part-01/observations/2', '/experiment/00/part-01/observations'],
    ['/experiment/00/part-01/reveal', '/experiment/00/part-01/observations/2'],
    ['/experiment/00/part-01/end', '/experiment/00/part-01/reveal'],
    ['/experiment/00/part-02', '/experiment/00/part-01/end'],
    ['/experiment/00/part-02/observations', '/experiment/00/part-02'],
    ['/experiment/00/part-02/observations/2', '/experiment/00/part-02/observations'],
    ['/experiment/00/part-02/reveal', '/experiment/00/part-02/observations/2'],
    ['/experiment/00/part-02/end', '/experiment/00/part-02/reveal'],
    ['/experiment/00/part-03', '/experiment/00/part-02/end'],
    ['/experiment/00/part-03/observations', '/experiment/00/part-03'],
    ['/experiment/00/part-03/observations/2', '/experiment/00/part-03/observations'],
    ['/experiment/00/part-03/reveal', '/experiment/00/part-03/observations/2'],
    ['/experiment/00/part-03/end', '/experiment/00/part-03/reveal'],
    ['/experiment/00/part-04', '/experiment/00/part-03/end'],
    ['/experiment/00/part-04/observations', '/experiment/00/part-04'],
    ['/experiment/00/part-04/reveal', '/experiment/00/part-04/observations'],
    ['/experiment/00/part-04/comparison', '/experiment/00/part-04/reveal'],
    ['/experiment/00/part-04/end', '/experiment/00/part-04/comparison'],
    ['/experiment/00/part-05', '/experiment/00/part-04/end'],
    ['/experiment/00/end', '/experiment/00/part-05'],
  ]

  for (const [route, previousRoute] of routes) {
    await page.goto(route)
    const backLink = page.locator('.study-back-link')
    await expect(backLink).toHaveAccessibleName('Previous study page')
    await expect(backLink.locator('span').first()).toHaveText('←')
    await expect(backLink).toHaveAttribute('href', previousRoute)
  }

  await page.goto('/experiment/00/welcome')
  await page.getByLabel('WHAT IS YOUR AGE?').click()
  await page.getByRole('option', { name: '28', exact: true }).click()
  await page.getByLabel('WHAT IS YOUR COUNTRY?').click()
  await page.getByRole('option', { name: 'France', exact: true }).click()
  await page.locator('.welcome-continue-link').click()

  const beforeBack = await page.evaluate(key => localStorage.getItem(key), storageKey)
  await page.locator('.study-back-link').click()
  await expect(page).toHaveURL(/\/experiment\/00\/welcome$/)
  await expect(page.getByLabel('WHAT IS YOUR AGE?')).toHaveText('28')
  await expect(page.getByLabel('WHAT IS YOUR COUNTRY?')).toHaveText('France')
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(beforeBack)
})

test('Part 03 End continues to Part 04 and Part 04 can scroll to unobstructed controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 })
  await page.goto('/experiment/00/part-03/end')

  const partThreeContinue = page.locator('.part-end-continue-link')
  await expect(partThreeContinue).toHaveCount(0)
  await page.getByRole('button', { name: 'YES', exact: true }).click()
  await expect(partThreeContinue).toHaveAttribute('href', '/experiment/00/part-04')
  await partThreeContinue.click()
  await expect(page).toHaveURL(/\/experiment\/00\/part-04$/)

  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(600)
  await expect(page.getByText('The conditions have changed this time.', { exact: false }))
    .toBeVisible()
  await page.getByRole('button', { name: 'WATCHED THE VIDEO?' }).click()
  await page.getByRole('button', { name: 'YES', exact: true }).click()

  const continueLink = page.locator('.part-continue-link')
  await expect(continueLink).toBeVisible()
  await continueLink.scrollIntoViewIfNeeded()
  const continueBounds = await continueLink.boundingBox()
  expect(continueBounds.y).toBeGreaterThanOrEqual(0)
  expect(continueBounds.y + continueBounds.height).toBeLessThanOrEqual(601)

  const contentMetrics = await page.evaluate(() => {
    const main = document.querySelector('.experiment-part-four-page')
    const interaction = document.querySelector('#part-four-watched-confirmation')
    const continueElement = document.querySelector('.part-continue-link')
    return {
      mainBottom: main.getBoundingClientRect().bottom + window.scrollY,
      interactionBottom: interaction.getBoundingClientRect().bottom + window.scrollY,
      continueTop: continueElement.getBoundingClientRect().top + window.scrollY,
    }
  })
  expect(contentMetrics.mainBottom).toBeGreaterThan(contentMetrics.continueTop)
  expect(contentMetrics.continueTop - contentMetrics.interactionBottom).toBeGreaterThanOrEqual(110)
  expect(contentMetrics.continueTop - contentMetrics.interactionBottom).toBeLessThanOrEqual(114)
})
