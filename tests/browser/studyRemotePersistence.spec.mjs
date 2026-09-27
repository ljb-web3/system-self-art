import { expect, test } from '@playwright/test'
import { mockParticipantIdentity } from './participantIdentityMock.mjs'

const participantIdKey = 'systemself_experiment_00_participant_id'
const studyKey = 'system-self-experiment-00-study'
const participantId = '12345678-1234-4123-8123-123456789abc'

function emptyStudy(updatedAt = new Date().toISOString()) {
  const emptyObservations = () => ({
    selectedSubject: '',
    reason: '',
    chosenSubjectWords: ['', '', '', '', ''],
    otherSubjectWords: ['', '', '', '', ''],
    selfWords: ['', '', '', '', ''],
  })

  return {
    version: 2,
    participantId,
    updatedAt,
    currentStep: 'welcome',
    welcome: { age: '', country: '', gender: '', ethnicity: '' },
    part01: { subject1ConnectionRating: null, subject2ConnectionRating: null },
    part02: { subject1ConnectionRating: null, subject2ConnectionRating: null },
    part03: { subject1ConnectionRating: null, subject2ConnectionRating: null },
    part04: {
      watchedVideo: null,
      observations: { observerConnection: null, observerAccuracy: null, selfAccuracy: null },
      comparison: null,
    },
    part05: { connectionRating: null },
    observationsPart01: emptyObservations(),
    observationsPart02: emptyObservations(),
    observationsPart03: emptyObservations(),
  }
}

function remoteRecord(overrides = {}) {
  return {
    participant_id: participantId,
    current_step: 'welcome',
    welcome_age: null,
    welcome_country: null,
    welcome_gender: null,
    welcome_ethnicity: null,
    part_01_data: {},
    part_02_data: {},
    part_03_data: {},
    part_04_data: {},
    part_05_data: {},
    created_at: '2026-09-26T00:00:00.000Z',
    updated_at: '2026-09-26T00:00:00.000Z',
    ...overrides,
  }
}

async function seedStorage(page, state = null) {
  await page.addInitScript(({ participantIdKey, studyKey, participantId, state }) => {
    if (!localStorage.getItem(participantIdKey)) localStorage.setItem(participantIdKey, participantId)
    if (state && !localStorage.getItem(studyKey)) {
      localStorage.setItem(studyKey, JSON.stringify(state))
    }
  }, { participantIdKey, studyKey, participantId, state })
}

test('first save upserts one row, updates it, restores answers, and resumes from remote', async ({ page }) => {
  const api = await mockParticipantIdentity(page)
  await seedStorage(page)
  await page.goto('/experiment/00/welcome')

  await page.getByLabel('WHAT IS YOUR AGE?').click()
  await page.getByRole('option', { name: '28', exact: true }).click()
  await page.getByLabel('WHAT IS YOUR COUNTRY?').click()
  await page.getByRole('option', { name: 'France', exact: true }).click()

  await expect.poll(() => api.study.saveCalls.length).toBeGreaterThan(0)
  await expect.poll(() => api.study.records.get(participantId)?.welcome_age).toBe(28)
  expect(api.study.records.size).toBe(1)

  await page.getByLabel('WHAT IS YOUR GENDER?').click()
  await page.getByRole('option', { name: 'WOMAN', exact: true }).click()
  await expect.poll(() => api.study.records.get(participantId)?.welcome_gender).toBe('woman')
  expect(api.study.records.size).toBe(1)

  await page.getByRole('link', { name: /CONTINUE/ }).click()
  await expect.poll(() => api.study.records.get(participantId)?.current_step).toBe('part-01')

  await page.goto('/experiment/00/welcome')
  await expect(page.getByLabel('WHAT IS YOUR AGE?')).toHaveText('28')
  await page.reload()
  await expect(page.getByLabel('WHAT IS YOUR AGE?')).toHaveText('28')
  await expect(page.getByLabel('WHAT IS YOUR GENDER?')).toHaveText('WOMAN')

  await page.evaluate(key => localStorage.removeItem(key), studyKey)
  await page.goto('/')
  await expect.poll(async () => page.evaluate(key => {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value).currentStep : null
  }, studyKey)).toBe('part-01')
  await page.getByRole('link', { name: 'EXPERIMENT 00', exact: true }).click()
  await expect(page).toHaveURL(/\/experiment\/00\/part-01$/)
})

test('newer timestamp wins during local and remote reconciliation', async ({ page }) => {
  const local = emptyStudy('2026-09-26T01:00:00.000Z')
  local.welcome.age = '24'
  local.welcome.country = 'GB'

  const api = await mockParticipantIdentity(page, {
    study: {
      initialRecords: {
        [participantId]: remoteRecord({
          welcome_age: 36,
          welcome_country: 'FR',
          updated_at: '2026-09-26T02:00:00.000Z',
        }),
      },
    },
  })
  await seedStorage(page, local)
  await page.goto('/experiment/00/welcome')

  await expect(page.getByLabel('WHAT IS YOUR AGE?')).toHaveText('36')
  await expect.poll(async () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).welcome.country, studyKey))
    .toBe('FR')

  const newerLocal = emptyStudy('2036-09-26T01:00:00.000Z')
  newerLocal.welcome.age = '42'
  newerLocal.welcome.country = 'DE'
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: studyKey,
    value: newerLocal,
  })
  await page.reload()

  await expect(page.getByLabel('WHAT IS YOUR AGE?')).toHaveText('42')
  await expect.poll(() => api.study.saveCalls.at(-1)?.p_payload.welcome_country).toBe('DE')
})

test('a Supabase save failure leaves the local cache intact', async ({ page }) => {
  const api = await mockParticipantIdentity(page, { study: { failFirstSave: true } })
  await seedStorage(page)
  await page.goto('/experiment/00/welcome')

  await page.getByLabel('WHAT IS YOUR AGE?').click()
  await page.getByRole('option', { name: '31', exact: true }).click()
  await expect.poll(() => api.study.saveCalls.length).toBeGreaterThan(0)

  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).welcome.age, studyKey)).toBe('31')
  await page.reload()
  await expect(page.getByLabel('WHAT IS YOUR AGE?')).toHaveText('31')
})

test('Parts 02/03 use two three-word groups and Parts 04/05 persist their current answers', async ({ page }) => {
  const state = emptyStudy('2036-09-26T01:00:00.000Z')
  state.currentStep = 'part-05'
  state.part02 = { subject1ConnectionRating: 4, subject2ConnectionRating: 8 }
  state.observationsPart02 = {
    selectedSubject: 'subject-1',
    reason: 'calm',
    chosenSubjectWords: ['one', 'two', 'three', 'obsolete-four', 'obsolete-five'],
    otherSubjectWords: ['obsolete', 'obsolete', 'obsolete', '', ''],
    selfWords: ['four', 'five', 'six', 'obsolete-seven', 'obsolete-eight'],
  }
  state.part03 = { subject1ConnectionRating: 6, subject2ConnectionRating: 7 }
  state.observationsPart03 = {
    selectedSubject: 'subject-2',
    reason: 'familiar',
    chosenSubjectWords: ['red', 'green', 'blue', 'obsolete-four', 'obsolete-five'],
    otherSubjectWords: ['obsolete', 'obsolete', 'obsolete', '', ''],
    selfWords: ['soft', 'clear', 'warm', 'obsolete-four', 'obsolete-five'],
  }
  state.part04 = {
    watchedVideo: 'yes',
    observations: {
      observerConnection: 'subject-2',
      observerAccuracy: 'yes',
      selfAccuracy: 'no',
    },
    comparison: 'yes',
  }
  state.part05 = { connectionRating: 9 }

  const api = await mockParticipantIdentity(page)
  await seedStorage(page, state)
  await page.goto('/experiment/00/part-05')
  await expect.poll(() => api.study.saveCalls.length).toBeGreaterThan(0)

  const payload = api.study.saveCalls.at(-1).p_payload
  expect(payload.part_02_data.chosenSubjectWords).toEqual(['one', 'two', 'three'])
  expect(payload.part_02_data.selfWords).toEqual(['four', 'five', 'six'])
  expect(payload.part_02_data).not.toHaveProperty('otherSubjectWords')
  expect(payload.part_03_data.chosenSubjectWords).toEqual(['red', 'green', 'blue'])
  expect(payload.part_03_data.selfWords).toEqual(['soft', 'clear', 'warm'])
  expect(payload.part_03_data).not.toHaveProperty('otherSubjectWords')
  expect(payload.part_04_data).toEqual({
    watchedVideo: 'yes',
    observerZeroConnection: 'subject-2',
    observerZeroMoreAccurateThanInaccurate: 'yes',
    participantMoreAccurateThanObserverZero: 'no',
    postRevealComparison: 'yes',
  })
  expect(payload.part_05_data).toEqual({ connectionRatingToCreator: 9 })
})
