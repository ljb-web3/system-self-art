import { expect, test } from '@playwright/test'
import { mockParticipantIdentity } from './participantIdentityMock.mjs'

const ratingRows = [
  { subject: 1, rating: 8, observation_count: 42 },
  { subject: 1, rating: 7, observation_count: 31 },
  { subject: 1, rating: 6, observation_count: 19 },
  { subject: 2, rating: 5, observation_count: 38 },
  { subject: 2, rating: 6, observation_count: 27 },
  { subject: 2, rating: 4, observation_count: 22 },
]

test.beforeEach(async ({ page }) => {
  await mockParticipantIdentity(page)
})

for (const part of ['01', '02', '03']) {
  test(`Part ${part} hides mobile video and loads only aggregate top-three ratings`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const requests = []
    await page.route('**/rest/v1/rpc/get_experiment_00_top_ratings', async route => {
      requests.push(route.request().postDataJSON())
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ratingRows) })
    })
    await page.goto(`/experiment/00/part-${part}`)

    const watch = page.getByRole('button', { name: 'CLICK HERE TO WATCH THE VIDEO' })
    const results = page.getByRole('button', { name: 'CLICK HERE TO SEE WHAT OTHER PEOPLE ANSWERED' })
    await expect(watch).toBeVisible()
    await expect(results).toBeVisible()
    await expect(page.locator('.part-media .video-placeholder')).toHaveCount(0)
    await expect(page.locator('.mobile-aggregate-results')).toHaveCount(0)
    expect(requests).toHaveLength(0)

    await watch.click()
    await expect(watch).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('.part-media .video-placeholder')).toBeVisible()
    if (part === '01') {
      await expect(page.locator('.part-media .video-embed')).toHaveCount(1)
    }
    await expect(page.locator('.part-media .timestamps')).toBeVisible()

    await results.click()
    await expect(results).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('.mobile-aggregate-group')).toHaveCount(2)
    await expect(page.locator('.mobile-aggregate-group').nth(0).getByRole('heading')).toHaveText('SUBJECT 1')
    await expect(page.locator('.mobile-aggregate-group').nth(1).getByRole('heading')).toHaveText('SUBJECT 2')
    await expect(page.locator('.mobile-aggregate-group').nth(0).locator('.mobile-aggregate-row'))
      .toHaveText(['842', '731', '619'])
    await expect(page.locator('.mobile-aggregate-group').nth(1).locator('.mobile-aggregate-row'))
      .toHaveText(['538', '627', '422'])
    expect(requests).toEqual([{ p_part: Number(part) }])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  })
}

test('mobile controls preserve Part 01 ratings and participant identity', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.route('**/rest/v1/rpc/get_experiment_00_top_ratings', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.goto('/experiment/00/part-01')
  const participantId = await page.evaluate(() => localStorage.getItem('systemself_experiment_00_participant_id'))
  const watch = page.getByRole('button', { name: 'CLICK HERE TO WATCH THE VIDEO' })
  const results = page.getByRole('button', { name: 'CLICK HERE TO SEE WHAT OTHER PEOPLE ANSWERED' })

  await page.getByRole('button', { name: 'WATCHED THE VIDEO?' }).click()
  await page.getByRole('button', { name: 'YES', exact: true }).click()
  await page.getByRole('button', { name: 'SUBJECT 1', exact: true }).click()
  await page.getByRole('button', { name: '8', exact: true }).click()
  await watch.click()
  await results.click()
  await expect(page.getByText('NO OBSERVATIONS YET.')).toBeVisible()
  await watch.click()
  await results.click()
  await expect(page.getByRole('button', { name: '8', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => localStorage.getItem('systemself_experiment_00_participant_id')))
    .toBe(participantId)
})

test('Part 01 results show loading, then French aggregate labels', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  let release
  await page.route('**/rest/v1/rpc/get_experiment_00_top_ratings', async route => {
    await new Promise(resolve => { release = resolve })
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ratingRows) })
  })
  await page.goto('/experiment/00/part-01')
  await page.getByRole('button', { name: 'FR', exact: true }).click()
  await page.getByRole('button', { name: 'CLIQUER ICI POUR VOIR CE QUE LES AUTRES ONT RÉPONDU' }).click()
  await expect(page.getByText('CHARGEMENT...')).toBeVisible()
  await expect.poll(() => Boolean(release)).toBe(true)
  release()
  await expect(page.getByRole('heading', { name: 'SUJET 1' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'SUJET 2' })).toBeVisible()
})

test('Part 03 aggregate failure stays subtle and does not block the experiment', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.route('**/rest/v1/rpc/get_experiment_00_top_ratings', route =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Unavailable"}' }),
  )
  await page.goto('/experiment/00/part-03')
  await page.getByRole('button', { name: 'CLICK HERE TO SEE WHAT OTHER PEOPLE ANSWERED' }).click()
  await expect(page.getByText('RESULTS UNAVAILABLE.')).toBeVisible()
  await page.getByRole('button', { name: 'WATCHED THE VIDEO?' }).click()
  await page.getByRole('button', { name: 'YES', exact: true }).click()
  await expect(page.getByRole('button', { name: 'SUBJECT 1', exact: true })).toBeVisible()
})

test('Part 04 has only the mobile video control and preserves watched answer', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/experiment/00/part-04')
  const watch = page.getByRole('button', { name: 'CLICK HERE TO WATCH THE VIDEO' })
  await expect(watch).toBeVisible()
  await expect(page.locator('.part-media .video-placeholder')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'CLICK HERE TO SEE WHAT OTHER PEOPLE ANSWERED' }))
    .toHaveCount(0)
  await page.getByRole('button', { name: 'WATCHED THE VIDEO?' }).click()
  await page.getByRole('button', { name: 'YES', exact: true }).click()
  await watch.click()
  await expect(page.locator('.part-media .video-placeholder')).toBeVisible()
  await watch.click()
  await expect(page.locator('.part-media .video-placeholder')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'YES', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('link', { name: /CONTINUE/ })).toBeVisible()
})

test('Part 05 shows aggregate YES/NO counts without changing the selected answer', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  let calls = 0
  await page.route('**/rest/v1/rpc/get_experiment_00_part_05_counts', async route => {
    calls += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ yes_count: 84, no_count: 27 }]),
    })
  })
  await page.goto('/experiment/00/part-05')
  const watch = page.getByRole('button', { name: 'CLICK HERE TO WATCH THE VIDEO' })
  const results = page.getByRole('button', { name: 'CLICK HERE TO SEE WHAT OTHER PEOPLE ANSWERED' })
  await expect(watch).toBeVisible()
  await expect(results).toBeVisible()
  await expect(page.locator('.part-media .video-placeholder')).toHaveCount(0)
  await expect(page.locator('.mobile-aggregate-results')).toHaveCount(0)
  expect(calls).toBe(0)
  await watch.click()
  await expect(page.locator('.part-media .video-placeholder')).toBeVisible()
  await page.getByRole('button', { name: 'YES', exact: true }).click()
  await results.click()
  await expect(page.locator('.mobile-aggregate-binary .mobile-aggregate-group')).toHaveCount(2)
  await expect(page.locator('.mobile-aggregate-binary .mobile-aggregate-group').nth(0)).toHaveText('YES84')
  await expect(page.locator('.mobile-aggregate-binary .mobile-aggregate-group').nth(1)).toHaveText('NO27')
  await watch.click()
  await expect(page.getByRole('button', { name: 'YES', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('link', { name: /CONTINUE/ })).toBeVisible()
  expect(calls).toBe(1)
})

test('Part 05 shows empty and error results without blocking YES/NO', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  let fail = false
  await page.route('**/rest/v1/rpc/get_experiment_00_part_05_counts', route =>
    route.fulfill(fail
      ? { status: 503, contentType: 'application/json', body: '{"message":"Unavailable"}' }
      : { status: 200, contentType: 'application/json', body: '[{"yes_count":0,"no_count":0}]' }),
  )
  await page.goto('/experiment/00/part-05')
  const results = page.getByRole('button', { name: 'CLICK HERE TO SEE WHAT OTHER PEOPLE ANSWERED' })
  await results.click()
  await expect(page.getByText('NO OBSERVATIONS YET.')).toBeVisible()
  await results.click()
  fail = true
  await results.click()
  await expect(page.getByText('RESULTS UNAVAILABLE.')).toBeVisible()
  await page.getByRole('button', { name: 'NO', exact: true }).click()
  await expect(page.getByRole('link', { name: /CONTINUE/ })).toBeVisible()
})

test('desktop Parts 01–05 keep visible video and have no mobile controls or aggregate requests', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  let aggregateRequests = 0
  const interceptAggregate = async route => {
    aggregateRequests += 1
    await route.abort()
  }
  await page.route('**/rest/v1/rpc/get_experiment_00_top_ratings', interceptAggregate)
  await page.route('**/rest/v1/rpc/get_experiment_00_part_05_counts', interceptAggregate)
  for (const part of ['01', '02', '03', '04', '05']) {
    await page.goto(`/experiment/00/part-${part}`)
    await expect(page.locator('.part-media .video-placeholder')).toBeVisible()
    await expect(page.getByRole('button', { name: 'CLICK HERE TO WATCH THE VIDEO' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'CLICK HERE TO SEE WHAT OTHER PEOPLE ANSWERED' }))
      .toHaveCount(0)
    const video = await page.locator('.part-media .video-placeholder').boundingBox()
    expect(video.width / video.height).toBeCloseTo(16 / 9, 1)
  }
  expect(aggregateRequests).toBe(0)
})
