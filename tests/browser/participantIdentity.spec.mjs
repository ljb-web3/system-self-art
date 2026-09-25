import { expect, test } from '@playwright/test'
import { mockParticipantIdentity } from './participantIdentityMock.mjs'

const participantIdKey = 'systemself_experiment_00_participant_id'
const studyKey = 'system-self-experiment-00-study'

test('Supabase identity stays stable across duplicate initialization, refresh, language, theme, and final page', async ({ page }) => {
  const identityApi = await mockParticipantIdentity(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.goto('/experiment/00/welcome')
  const number = page.locator('.welcome-subject .subject-number')
  await expect(number).toHaveText('1024')
  await expect(number).toHaveCSS('color', 'rgb(116, 116, 116)')
  await expect(page.getByText('YOU ARE SUBJECT 1024', { exact: true })).toBeVisible()

  const firstIdentity = await page.evaluate(({ participantIdKey, studyKey }) => ({
    participantId: localStorage.getItem(participantIdKey),
    study: JSON.parse(localStorage.getItem(studyKey)),
  }), { participantIdKey, studyKey })
  expect(firstIdentity.participantId).toMatch(/^[0-9a-f-]{36}$/)
  expect(firstIdentity.study.participantId).toBe(firstIdentity.participantId)
  expect(firstIdentity.study).not.toHaveProperty('subjectNumber')
  expect(identityApi.calls).toEqual([firstIdentity.participantId])

  await page.reload()
  await expect(page.getByText('YOU ARE SUBJECT 1024', { exact: true })).toBeVisible()
  expect(await page.evaluate(key => localStorage.getItem(key), participantIdKey)).toBe(firstIdentity.participantId)
  expect(identityApi.calls).toEqual([firstIdentity.participantId, firstIdentity.participantId])
  expect(identityApi.participants.size).toBe(1)

  await page.getByRole('button', { name: 'FR', exact: true }).click()
  await expect(page.getByText('VOUS ÊTES LE SUJET 1024', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'BLACK', exact: true }).click()
  await expect(number).toHaveCSS('color', 'rgb(184, 184, 184)')
  expect(identityApi.calls).toHaveLength(2)

  await page.goto('/experiment/00/end')
  await expect(page.getByText('THANK YOU, SUBJECT 1024', { exact: true })).toBeVisible()
  await expect(page.locator('.final-subject .subject-number')).toHaveText('1024')
  expect(await page.evaluate(key => localStorage.getItem(key), participantIdKey)).toBe(firstIdentity.participantId)
  expect(identityApi.participants.size).toBe(1)
})

test('identity failure is recoverable without inventing a local subject number', async ({ page }) => {
  await mockParticipantIdentity(page, { failFirst: true })
  await page.goto('/experiment/00/welcome')

  await expect(page.getByText('YOU ARE SUBJECT ...', { exact: true })).toBeVisible()
  await expect(page.getByText('IDENTITY UNAVAILABLE', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'RETRY', exact: true }).click()
  await expect(page.getByText('YOU ARE SUBJECT 1024', { exact: true })).toBeVisible()
})
