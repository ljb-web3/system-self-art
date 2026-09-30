import { expect, test } from '@playwright/test'
import { mockParticipantIdentity } from './participantIdentityMock.mjs'

test.beforeEach(async ({ page }) => {
  await mockParticipantIdentity(page)
  await page.route('**/youtube-nocookie.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '',
  }))
  await page.setViewportSize({ width: 1440, height: 900 })
})

async function measurePart(page) {
  return page.evaluate(() => {
    const main = document.querySelector('.experiment-main-part-page')
    const content = main.querySelector('.part-main-content')
    const continueLink = main.querySelector('.part-continue-link')
    const position = element => element.getBoundingClientRect()
    const contentBounds = position(content)
    const mainBounds = position(main)
    const continueBounds = continueLink && position(continueLink)

    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      mainBottom: mainBounds.bottom + window.scrollY,
      contentBottom: contentBounds.bottom + window.scrollY,
      continueTop: continueBounds && continueBounds.top + window.scrollY,
      continueBottom: continueBounds && continueBounds.bottom + window.scrollY,
      continueRightInset: continueBounds && window.innerWidth - continueBounds.right,
    }
  })
}

async function expectPageEnd(page, horizontalInset) {
  const metrics = await measurePart(page)
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1)
  expect(metrics.continueTop).toBeGreaterThan(metrics.contentBottom)
  expect(metrics.mainBottom - metrics.continueBottom).toBeGreaterThanOrEqual(37)
  expect(metrics.mainBottom - metrics.continueBottom).toBeLessThanOrEqual(39)
  expect(metrics.continueRightInset).toBeCloseTo(horizontalInset, 0)
}

for (const part of ['01', '02', '03']) {
  test(`Part ${part} keeps all copy and interaction states in flow`, async ({ page }) => {
    await page.goto(`/experiment/00/part-${part}`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.part-observation-copy p')).not.toHaveCount(0)
    await expect(page.getByRole('button', { name: 'WATCHED THE VIDEO?' })).toBeVisible()
    let metrics = await measurePart(page)
    expect(metrics.mainBottom).toBeGreaterThan(metrics.contentBottom)

    await page.getByRole('button', { name: 'FR', exact: true }).click()
    metrics = await measurePart(page)
    expect(metrics.mainBottom).toBeGreaterThan(metrics.contentBottom)
    await page.setViewportSize({ width: 375, height: 667 })
    metrics = await measurePart(page)
    expect(metrics.mainBottom).toBeGreaterThan(metrics.contentBottom)
    expect(metrics.documentWidth).toBeLessThanOrEqual(375)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: 'EN', exact: true }).click()

    await page.getByRole('button', { name: 'WATCHED THE VIDEO?' }).click()
    await expect(page.getByRole('button', { name: 'YES', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'NO', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'YES', exact: true }).click()
    await expect(page.locator('.part-continue-link')).toHaveCount(0)
    await page.getByRole('button', { name: 'SUBJECT 1', exact: true }).click()
    await page.locator('#subject-1-rating .rating-option').nth(4).click()
    await page.getByRole('button', { name: 'SUBJECT 2', exact: true }).click()
    await page.locator('#subject-2-rating .rating-option').nth(5).click()

    await expectPageEnd(page, 1440 * 0.032)
    await page.setViewportSize({ width: 375, height: 667 })
    await expectPageEnd(page, 375 * 0.06)
  })
}

test('Part 04 ends shortly after Continue', async ({ page }) => {
  await page.goto('/experiment/00/part-04', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'WATCHED THE VIDEO?' }).click()
  await page.getByRole('button', { name: 'YES', exact: true }).click()
  await expectPageEnd(page, 1440 * 0.032)
  let metrics = await measurePart(page)
  expect(metrics.continueTop - metrics.contentBottom).toBeGreaterThanOrEqual(37)
  expect(metrics.continueTop - metrics.contentBottom).toBeLessThanOrEqual(39)
  await page.getByRole('button', { name: 'FR', exact: true }).click()
  await expectPageEnd(page, 1440 * 0.032)
  metrics = await measurePart(page)
  expect(metrics.continueTop - metrics.contentBottom).toBeGreaterThanOrEqual(37)
  expect(metrics.continueTop - metrics.contentBottom).toBeLessThanOrEqual(39)
  await page.setViewportSize({ width: 375, height: 667 })
  await expectPageEnd(page, 375 * 0.06)
  metrics = await measurePart(page)
  expect(metrics.continueTop - metrics.contentBottom).toBeGreaterThanOrEqual(37)
  expect(metrics.continueTop - metrics.contentBottom).toBeLessThanOrEqual(39)
})

test('Part 05 ends shortly after Continue', async ({ page }) => {
  await page.goto('/experiment/00/part-05', { waitUntil: 'domcontentloaded' })
  await page.locator('.part-five-rating .rating-option').nth(4).click()
  await expectPageEnd(page, 1440 * 0.032)
  await page.getByRole('button', { name: 'FR', exact: true }).click()
  await expectPageEnd(page, 1440 * 0.032)
  await page.setViewportSize({ width: 375, height: 667 })
  await expectPageEnd(page, 375 * 0.06)
})
