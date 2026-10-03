import { expect, test } from '@playwright/test'

for (const part of ['02', '03']) {
  test(`Part ${part} asks which subject rating feels more certain`, async ({ page }) => {
    await page.goto(`/experiment/00/part-${part}/observations`)
    await expect(page.locator('#observations-subject-label')).toHaveText("WHICH SUBJECT'S RATING ARE YOU MORE CONFIDENT ABOUT?")
    await expect(page.locator('label[for="observations-reason"]')).toContainText('WHY DO YOU THINK THAT?')
    await expect(page.locator('.observations-continue-link')).toHaveCount(0)
    await page.getByRole('button', { name: 'FR', exact: true }).click()
    await expect(page.locator('#observations-subject-label')).toHaveText('DU RÉSULTAT DE QUEL SUJET ÊTES-VOUS LE PLUS SÛR·E ?')
    if (part === '03') {
      await expect(page.locator('label[for="observations-reason"]')).toContainText('POURQUOI PENSEZ-VOUS CELA ?')
    }
    await expect(page.locator('.observations-subject-option')).toHaveText(['SUJET 1', 'SUJET 2'])
    await page.getByRole('button', { name: 'SUJET 2', exact: true }).click()
    await expect(page.locator('.observations-continue-link')).toBeVisible()
  })
}

test('Part 01 continues to Observations 1/2 after both ratings', async ({ page }) => {
  await page.goto('/experiment/00/part-01')

  await page.getByRole('button', { name: 'WATCHED THE VIDEO?' }).click()
  await page.getByRole('button', { name: 'YES', exact: true }).click()
  await page.getByRole('button', { name: 'SUBJECT 1', exact: true }).click()
  await page.getByRole('button', { name: '5', exact: true }).click()
  await page.getByRole('button', { name: 'SUBJECT 2', exact: true }).click()
  await page.getByRole('button', { name: '6', exact: true }).last().click()

  const continueLink = page.getByRole('link', { name: /CONTINUE/ })
  await expect(continueLink).toHaveAttribute('href', '/experiment/00/part-01/observations')
  await continueLink.click()
  await expect(page).toHaveURL(/\/experiment\/00\/part-01\/observations$/)
  await expect(page.getByRole('heading', { name: 'OBSERVATIONS' })).toBeVisible()
  await expect(page.getByLabel('1 / 2')).toHaveText('1/2')
})

test('Observations 1/2 contains only its two questions and continues after either answer', async ({ page }) => {
  await page.goto('/experiment/00/part-01/observations')

  const title = page.getByRole('heading', { name: 'OBSERVATIONS' })
  const step = page.getByLabel('1 / 2')
  const questionOne = page.locator('#observations-subject-label')
  const reason = page.locator('#observations-reason')
  await expect(title).toBeVisible()
  await expect(step).toBeVisible()
  await expect(questionOne).toHaveText("WHICH SUBJECT'S RATING ARE YOU MORE CONFIDENT ABOUT?")
  await expect(page.locator('label[for="observations-reason"]')).toContainText('WHY DO YOU THINK THAT?')
  await expect(page.getByText('OPTIONAL', { exact: true })).toBeVisible()
  await expect(page.locator('.observations-word-question')).toHaveCount(0)
  await expect(page.locator('.observations-word-input')).toHaveCount(0)
  await expect(page.locator('.observations-continue-link')).toHaveCount(0)

  const titleSize = Number.parseFloat(await title.evaluate(element => getComputedStyle(element).fontSize))
  const stepSize = Number.parseFloat(await step.evaluate(element => getComputedStyle(element).fontSize))
  expect(Math.abs(titleSize - stepSize)).toBeLessThanOrEqual(1)

  const questionBounds = await questionOne.boundingBox()
  const reasonBounds = await reason.boundingBox()
  expect(Math.abs(questionBounds.width - reasonBounds.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(questionBounds.x - reasonBounds.x)).toBeLessThanOrEqual(1)
  expect(reasonBounds.height).toBeLessThanOrEqual(80)
  await expect(reason).toHaveCSS('border-top-style', 'solid')
  await expect(reason).toHaveCSS('border-right-style', 'solid')
  await expect(reason).toHaveCSS('border-bottom-style', 'solid')
  await expect(reason).toHaveCSS('border-left-style', 'solid')

  await reason.fill('A quiet sense of recognition.')
  let continueLink = page.getByRole('link', { name: /CONTINUE/ })
  await expect(continueLink).toHaveCount(0)
  await reason.fill('')
  await expect(page.locator('.observations-continue-link')).toHaveCount(0)

  const subjectOne = page.getByRole('button', { name: 'SUBJECT 1', exact: true })
  const subjectTwo = page.getByRole('button', { name: 'SUBJECT 2', exact: true })
  await subjectOne.click()
  await expect(continueLink).toBeVisible()
  await expect(continueLink).toHaveAttribute('href', '/experiment/00/part-01/observations/2')
  const continueBounds = await continueLink.boundingBox()
  const viewport = page.viewportSize()
  expect(continueBounds.x + continueBounds.width).toBeGreaterThan(viewport.width * 0.8)
  expect(continueBounds.y + continueBounds.height).toBeGreaterThan(viewport.height * 0.8)
  await subjectTwo.click()
  await expect(subjectOne).toHaveAttribute('aria-pressed', 'false')
  await expect(subjectTwo).toHaveAttribute('aria-pressed', 'true')
})

test('Observations preserves local answers and keeps five-word exercises optional', async ({ page }) => {
  await page.goto('/experiment/00/part-01/observations')

  await page.getByRole('button', { name: 'SUBJECT 2', exact: true }).click()
  await page.locator('#observations-reason').fill('A quiet sense of recognition.')
  await page.getByRole('button', { name: 'FR', exact: true }).click()
  await page.getByRole('button', { name: 'BLACK', exact: true }).click()
  await page.getByRole('link', { name: /CONTINUER/ }).click()

  await expect(page).toHaveURL(/\/experiment\/00\/part-01\/observations\/2$/)
  await expect(page.getByLabel('2 / 2')).toHaveText('2/2')
  await expect(page.locator('.observations-subject-options')).toHaveCount(0)
  await expect(page.locator('#observations-reason')).toHaveCount(0)
  await expect(page.locator('.observations-word-question')).toHaveCount(2)
  await expect(page.locator('.observations-word-input')).toHaveCount(10)
  await expect(page.locator('.observations-word-question .observations-question-label')).toContainText(['DÉCRIVEZ LE SUJET 1 EN CINQ MOTS.', 'DÉCRIVEZ LE SUJET 2 EN CINQ MOTS.'])
  await expect(page.locator('.observations-optional')).toHaveText(['FACULTATIF', 'FACULTATIF'])
  await expect(page.locator('.observations-continue-link')).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/\/experiment\/00\/part-01\/observations$/)
  await expect(page.getByRole('button', { name: 'SUJET 2', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#observations-reason')).toHaveValue('A quiet sense of recognition.')
  await page.getByRole('link', { name: /CONTINUER/ }).click()

  const wordInputs = page.locator('.observations-word-input')
  await wordInputs.nth(0).fill('attentive')
  await wordInputs.nth(1).fill('patient')
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await page.getByRole('button', { name: 'WHITE', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'white')
  await expect(wordInputs.nth(0)).toHaveValue('attentive')
  await expect(wordInputs.nth(1)).toHaveValue('patient')
  await expect(page.locator('.observations-optional')).toHaveText(['OPTIONAL', 'OPTIONAL'])

  const optionalStyle = await page.locator('.observations-word-question').first().evaluate(element => {
    const question = element.querySelector('.observations-question-label')
    const optional = element.querySelector('.observations-optional')
    return {
      questionSize: parseFloat(getComputedStyle(question).fontSize),
      optionalSize: parseFloat(getComputedStyle(optional).fontSize),
      optionalBackground: getComputedStyle(optional).backgroundColor,
    }
  })
  expect(optionalStyle.optionalSize).toBeLessThan(optionalStyle.questionSize)
  expect(optionalStyle.optionalBackground).toBe('rgba(0, 0, 0, 0)')

  const continueLink = page.getByRole('link', { name: /CONTINUE/ })
  await expect(continueLink).toBeVisible()
  await expect(continueLink).toHaveAttribute('href', '/experiment/00/part-01/reveal')
  await continueLink.click()
  await expect(page).toHaveURL(/\/experiment\/00\/part-01\/reveal$/)
  await expect(page.getByRole('heading', { name: 'PART 01 : REVEAL' })).toBeVisible()
})

test('Observations 2/2 remains centered and wraps five-word inputs on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/experiment/00/part-01/observations/2')

  await expect(page.getByRole('heading', { name: 'OBSERVATIONS' })).toBeVisible()
  await expect(page.getByLabel('2 / 2')).toBeVisible()
  await expect(page.locator('.observations-question').first()).toHaveCSS('text-align', 'center')
  await expect(page.locator('.observations-word-input')).toHaveCount(10)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)

  const firstWordGroupInputs = page.locator('.observations-word-question').first().locator('input')
  const verticalPositions = await firstWordGroupInputs.evaluateAll(inputs =>
    inputs.map(input => Math.round(input.getBoundingClientRect().top)),
  )
  expect(new Set(verticalPositions).size).toBeGreaterThan(1)
})
