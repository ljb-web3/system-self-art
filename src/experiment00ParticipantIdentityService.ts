import { supabase } from './lib/supabase'

export const experiment00ParticipantIdStorageKey = 'systemself_experiment_00_participant_id'

export type Experiment00ParticipantRecord = {
  participant_id: string
  subject_number: number
}

const participantRequestCache = new Map<string, Promise<Experiment00ParticipantRecord>>()

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function getOrCreateExperiment00ParticipantId() {
  const storedParticipantId = window.localStorage.getItem(experiment00ParticipantIdStorageKey)
  if (storedParticipantId && isUuid(storedParticipantId)) return storedParticipantId

  const participantId = window.crypto.randomUUID()
  window.localStorage.setItem(experiment00ParticipantIdStorageKey, participantId)
  return participantId
}

function readParticipantRecord(value: unknown, expectedParticipantId: string): Experiment00ParticipantRecord {
  const rawRecord = Array.isArray(value) ? value[0] : value
  if (!rawRecord || typeof rawRecord !== 'object') {
    throw new Error('Participant RPC returned no record')
  }

  const record = rawRecord as Record<string, unknown>
  const subjectNumber = typeof record.subject_number === 'string'
    ? Number(record.subject_number)
    : record.subject_number

  if (record.participant_id !== expectedParticipantId) {
    throw new Error('Participant RPC returned an unexpected participant')
  }

  if (typeof subjectNumber !== 'number' || !Number.isSafeInteger(subjectNumber)) {
    throw new Error('Participant RPC returned an invalid subject number')
  }

  return { participant_id: expectedParticipantId, subject_number: subjectNumber }
}

export function getOrCreateExperiment00Participant(participantId: string) {
  const cachedRequest = participantRequestCache.get(participantId)
  if (cachedRequest) return cachedRequest

  const request = (async () => {
    const { data, error } = await supabase.rpc(
      'get_or_create_experiment_00_participant',
      { p_participant_id: participantId },
    )
    if (error) throw new Error(error.message)
    return readParticipantRecord(data, participantId)
  })().catch((error: unknown) => {
    participantRequestCache.delete(participantId)
    throw error
  })

  participantRequestCache.set(participantId, request)
  return request
}

