import { expect, test } from '@playwright/test'
import { mockParticipantIdentity } from './participantIdentityMock.mjs'

test.beforeEach(async ({ page }) => {
  await mockParticipantIdentity(page)
})

test('Explanations types while Continue is immediately available and theme changes preserve progress', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/experiment/00/explanations')

  const visibleCopy = page.locator('.explanations-copy p').first().locator('[aria-hidden="true"]')
  const typedLength = () => visibleCopy.evaluate(element =>
    element.firstChild?.nodeType === Node.TEXT_NODE ? element.firstChild.textContent.length : 0,
  )
  const continueLink = page.getByRole('link', { name: /CONTINUE/ })
  await expect(continueLink).toBeVisible()
  await expect.poll(typedLength).toBeGreaterThan(0)
  const beforeThemeChange = await typedLength()
  await page.getByRole('button', { name: 'BLACK', exact: true }).click()
  expect(await typedLength()).toBeGreaterThanOrEqual(beforeThemeChange)
  await expect.poll(typedLength).toBeGreaterThan(beforeThemeChange)
  await continueLink.click()
  await expect(page).toHaveURL(/\/experiment\/00\/welcome$/)
})

test('Explanations uses the PDF copy, language controls, and explicit adjacent routes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/experiment/00')
  await page.getByRole('button', { name: 'EXPERIMENT 00' }).click()
  await expect(page.locator('.introduction-copy')).toContainText('In this filmed experiment, eight people were paired')
  await page.getByRole('link', { name: /CONTINUE/ }).click()

  await expect(page.getByRole('heading', { name: 'EXPLANATIONS' })).toBeVisible()
  await expect(page.locator('.explanations-copy')).toContainText('We connect through increasingly limited interfaces.')
  await expect(page.locator('.study-back-link')).toHaveAttribute('href', '/experiment/00')
  await page.getByRole('button', { name: 'FR', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'EXPLICATIONS' })).toBeVisible()
  await expect(page.locator('.explanations-copy')).toContainText('Nous nous connectons à travers des interfaces de plus en plus limitées.')
  await page.setViewportSize({ width: 375, height: 667 })
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(667)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await page.getByRole('button', { name: 'BLACK', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'black')
  await page.locator('.study-back-link').click()
  await expect(page).toHaveURL(/\/experiment\/00$/)
  await expect(page.locator('.study-back-link')).toHaveAttribute('href', '/')
  await page.getByRole('button', { name: 'EXPÉRIMENTATION 00' }).click()
  await expect(page.locator('.introduction-copy')).toContainText('Dans cette expérience filmée, huit personnes ont été mises en binôme')
  await expect(page.locator('.introduction-copy')).toContainText('(* OBSERVER : observateur.ice)')
  await page.getByRole('link', { name: /CONTINUER/ }).click()
  await page.getByRole('link', { name: /CONTINUER/ }).click()
  await expect(page).toHaveURL(/\/experiment\/00\/welcome$/)
  await expect(page.locator('.study-back-link')).toHaveAttribute('href', '/experiment/00/explanations')
})

test('Experiment 00 welcome flow persists one anonymous study record', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.goto('/experiment/00')
  await page.getByRole('button', { name: 'EXPERIMENT 00' }).click()
  await page.getByRole('link', { name: /CONTINUE/ }).click()
  await expect(page).toHaveURL(/\/experiment\/00\/explanations$/)
  await expect(page.getByRole('heading', { name: 'EXPLANATIONS' })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('system-self-experiment-00-study')).currentStep))
    .toBe('explanations')
  await page.getByRole('link', { name: /CONTINUE/ }).click()
  await expect(page).toHaveURL(/\/experiment\/00\/welcome$/)

  const subjectIdentity = page.getByText(/YOU ARE SUBJECT \d+/)
  await expect(subjectIdentity).toBeVisible()
  const firstSubjectId = (await subjectIdentity.textContent()).match(/\d+/)?.[0]
  expect(firstSubjectId).toBeTruthy()
  await expect(page.locator('.welcome-continue-link')).toHaveCount(0)

  await page.getByLabel('WHAT IS YOUR AGE?').click()
  await page.getByRole('option', { name: '28', exact: true }).click()
  await expect(page.locator('.welcome-continue-link')).toHaveCount(0)

  await page.getByLabel('WHAT IS YOUR COUNTRY?').click()
  await page.getByRole('option', { name: 'France', exact: true }).click()
  await expect(page.locator('.welcome-continue-link')).toBeVisible()
  await page.getByLabel('WHAT IS YOUR GENDER?').click()
  await page.getByRole('option', { name: 'WOMAN', exact: true }).click()
  await page.getByLabel('WHAT IS YOUR ETHNICITY?').click()
  await page.getByRole('option', { name: 'WHITE', exact: true }).click()

  await page.getByLabel('WHAT IS YOUR GENDER?').click()
  await page.getByRole('button', { name: 'FR', exact: true }).click()
  await expect(page.locator('.experiment-welcome-page')).not.toHaveClass(/has-dropdown-open/)
  await expect(page.getByRole('heading', { name: 'BIENVENUE' })).toBeVisible()
  await expect(page.getByLabel('QUEL ÂGE AVEZ-VOUS ?')).toHaveText('28')
  await expect(page.getByLabel('QUEL EST VOTRE PAYS ?')).toHaveText('France')
  await expect(page.getByLabel('QUEL EST VOTRE GENRE ?')).toHaveText('FEMME')
  await expect(page.getByLabel('QUELLE EST VOTRE ORIGINE ETHNIQUE ?')).toHaveText('BLANC·HE')
  expect((await page.evaluate(() => Object.keys(window.localStorage))).sort()).toEqual([
    'system-self-experiment-00-study',
    'systemself_experiment_00_participant_id',
  ].sort())

  await page.getByLabel('QUELLE EST VOTRE ORIGINE ETHNIQUE ?').click()
  await page.getByRole('button', { name: 'BLACK', exact: true }).click()
  await expect(page.locator('.experiment-welcome-page')).not.toHaveClass(/has-dropdown-open/)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'black')
  await expect(page.getByLabel('QUEL ÂGE AVEZ-VOUS ?')).toHaveText('28')
  await expect(page.getByLabel('QUEL EST VOTRE PAYS ?')).toHaveText('France')

  await page.reload()
  await expect(page.getByText(new RegExp(`YOU ARE SUBJECT ${firstSubjectId}`))).toBeVisible()
  await expect(page.getByLabel('WHAT IS YOUR AGE?')).toHaveText('28')
  await expect(page.getByLabel('WHAT IS YOUR COUNTRY?')).toHaveText('France')
  await expect(page.getByLabel('WHAT IS YOUR GENDER?')).toHaveText('WOMAN')
  await expect(page.getByLabel('WHAT IS YOUR ETHNICITY?')).toHaveText('WHITE')
  await expect(page.locator('.welcome-continue-link')).toBeVisible()
  await page.locator('.welcome-continue-link').click()
  await expect(page).toHaveURL(/\/experiment\/00\/part-01$/)
  await expect(page.getByRole('heading', { name: 'PART 01' })).toBeVisible()
})

test('Welcome questionnaire remains readable without horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/experiment/00/welcome')

  await expect(page.getByRole('heading', { name: 'WELCOME' })).toBeVisible()

  for (const label of [
    'WHAT IS YOUR AGE?',
    'WHAT IS YOUR COUNTRY?',
    'WHAT IS YOUR GENDER?',
    'WHAT IS YOUR ETHNICITY?',
  ]) {
    const trigger = page.getByRole('button', { name: label })
    await trigger.scrollIntoViewIfNeeded()
    await trigger.click()
    const listbox = page.getByRole('listbox', { name: label })
    await expect(listbox).toBeVisible()
    await expect.poll(async () => {
      const bounds = await listbox.boundingBox()
      return Math.round(bounds.y + bounds.height)
    }).toBeLessThanOrEqual(643)
    const triggerBounds = await trigger.boundingBox()
    const listboxBounds = await listbox.boundingBox()
    expect(listboxBounds.y).toBeGreaterThanOrEqual(triggerBounds.y + triggerBounds.height - 1)
    await expect(page.locator('.welcome-introduction')).toHaveCSS('filter', /blur/)
    await page.keyboard.press('Escape')
  }

  await page.getByRole('button', { name: 'WHAT IS YOUR ETHNICITY?' }).click()
  await expect(page.getByText('MIDDLE EASTERN / NORTH AFRICAN')).toBeVisible()
  const finalEthnicityOption = page.getByRole('option', { name: 'OTHER', exact: true })
  const finalOptionBounds = await finalEthnicityOption.boundingBox()
  expect(finalOptionBounds.y + finalOptionBounds.height).toBeLessThanOrEqual(643)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await page.keyboard.press('Escape')

  await page.getByLabel('WHAT IS YOUR AGE?').click()
  await page.getByRole('option', { name: '28', exact: true }).click()
  await page.getByLabel('WHAT IS YOUR COUNTRY?').click()
  await page.getByRole('option', { name: 'France', exact: true }).click()
  await expect(page.locator('.welcome-continue-link')).toBeVisible()
})

test('All Welcome selects use the Gender visual system and preserve optional defaults', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto('/experiment/00/welcome')

  const triggers = page.locator('.welcome-select-trigger')
  await expect(triggers).toHaveCount(4)
  const triggerStyles = await triggers.evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element)
    return {
      width: style.width,
      minHeight: style.minHeight,
      padding: style.padding,
      margin: style.margin,
      color: style.color,
      borderTop: style.borderTop,
      borderBottom: style.borderBottom,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
      textAlign: style.textAlign,
    }
  }))
  expect(new Set(triggerStyles.map(style => JSON.stringify(style))).size).toBe(1)

  await expect(page.getByRole('button', { name: 'WHAT IS YOUR GENDER?' })).toHaveText('SELECT GENDER')
  await expect(page.getByRole('button', { name: 'WHAT IS YOUR ETHNICITY?' })).toHaveText('SELECT ETHNICITY')
  await expect(page.getByRole('button', { name: 'WHAT IS YOUR GENDER?' })).not.toHaveClass(/has-value/)
  await expect(page.getByRole('button', { name: 'WHAT IS YOUR ETHNICITY?' })).not.toHaveClass(/has-value/)

  await page.getByRole('button', { name: 'WHAT IS YOUR AGE?' }).click()
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.keyboard.press('Escape')

  const dropdownStyles = []
  for (const label of [
    'WHAT IS YOUR AGE?',
    'WHAT IS YOUR COUNTRY?',
    'WHAT IS YOUR GENDER?',
    'WHAT IS YOUR ETHNICITY?',
  ]) {
    await page.getByRole('button', { name: label }).click()
    const listbox = page.getByRole('listbox', { name: label })
    dropdownStyles.push(await listbox.evaluate(element => {
      const listStyle = getComputedStyle(element)
      const optionStyle = getComputedStyle(element.querySelectorAll('[role="option"]')[1])
      return {
        width: listStyle.width,
        background: listStyle.backgroundColor,
        borderBottom: listStyle.borderBottom,
        optionPadding: optionStyle.padding,
        optionColor: optionStyle.color,
        optionFontFamily: optionStyle.fontFamily,
        optionFontSize: optionStyle.fontSize,
        optionFontWeight: optionStyle.fontWeight,
        optionLetterSpacing: optionStyle.letterSpacing,
        optionLineHeight: optionStyle.lineHeight,
        optionTextAlign: optionStyle.textAlign,
      }
    }))
    await page.keyboard.press('Escape')
  }
  expect(new Set(dropdownStyles.map(style => JSON.stringify(style))).size).toBe(1)

  await page.getByRole('button', { name: 'WHAT IS YOUR GENDER?' }).click()
  expect(await page.getByRole('option').allTextContents()).toEqual([
    'PREFER NOT TO SAY',
    'WOMAN',
    'MAN',
    'NON-BINARY',
    'OTHER',
  ])
  await page.getByRole('option', { name: 'PREFER NOT TO SAY', exact: true }).click()

  await page.getByRole('button', { name: 'WHAT IS YOUR ETHNICITY?' }).click()
  expect(await page.getByRole('option').allTextContents()).toEqual([
    'PREFER NOT TO SAY',
    'BLACK',
    'WHITE',
    'ASIAN',
    'MIDDLE EASTERN / NORTH AFRICAN',
    'INDIGENOUS',
    'MULTIRACIAL',
    'OTHER',
  ])
  await page.getByRole('option', { name: 'PREFER NOT TO SAY', exact: true }).click()
  await expect(page.locator('.welcome-continue-link')).toHaveCount(0)

  await page.getByRole('button', { name: 'FR', exact: true }).click()
  await page.getByRole('button', { name: 'QUEL EST VOTRE GENRE ?' }).click()
  expect(await page.getByRole('option').allTextContents()).toEqual([
    'PRÉFÈRE NE PAS RÉPONDRE',
    'FEMME',
    'HOMME',
    'NON-BINAIRE',
    'AUTRE',
  ])
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'QUELLE EST VOTRE ORIGINE ETHNIQUE ?' }).click()
  expect(await page.getByRole('option').allTextContents()).toEqual([
    'PRÉFÈRE NE PAS RÉPONDRE',
    'NOIR·E',
    'BLANC·HE',
    'ASIATIQUE',
    'MOYEN-ORIENT / AFRIQUE DU NORD',
    'AUTOCHTONE',
    'MULTIRACIAL·E',
    'AUTRE',
  ])
})

test('Welcome selects open downward, blur surrounding content, and stay mutually exclusive', async ({ page }) => {
  await page.goto('/experiment/00/welcome')

  const ageTrigger = page.getByRole('button', { name: 'WHAT IS YOUR AGE?' })
  await ageTrigger.click()
  const ageList = page.getByRole('listbox', { name: 'WHAT IS YOUR AGE?' })
  await expect(ageList).toBeVisible()
  const ageBox = await ageTrigger.boundingBox()
  const ageListBox = await ageList.boundingBox()
  expect(ageListBox.y).toBeGreaterThanOrEqual(ageBox.y + ageBox.height - 1)
  await expect(page.locator('.welcome-introduction')).toHaveCSS('filter', /blur/)
  await expect(page.locator('.welcome-question.is-active')).toHaveCSS('filter', 'none')

  await page.getByLabel('WHAT IS YOUR COUNTRY?').click()
  await expect(ageList).toHaveCount(0)
  await expect(page.getByRole('listbox', { name: 'WHAT IS YOUR COUNTRY?' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.experiment-welcome-page')).not.toHaveClass(/has-dropdown-open/)
  await expect(page.locator('.welcome-introduction')).toHaveCSS('filter', 'none')

  await page.getByRole('link', { name: 'System Self' }).click()
  await expect(page).toHaveURL(/\/$/)
})
