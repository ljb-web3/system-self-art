import type {
  Experiment00Step,
  Experiment00StudyState,
  PartFourState,
  PartObservations,
  PartRatings,
} from './experiment00Study'
import { supabase } from './lib/supabase'

export const experiment00StudyStorageKey = 'system-self-experiment-00-study'

const validStudySteps: Experiment00Step[] = [
  'explanations',
  'welcome',
  'part-01',
  'observations-01-1',
  'observations-01-2',
  'reveal-part-01',
  'end-part-01',
  'part-02',
  'observations-02-1',
  'observations-02-2',
  'reveal-part-02',
  'end-part-02',
  'part-03',
  'observations-03-1',
  'observations-03-2',
  'reveal-part-03',
  'end-part-03',
  'part-04',
  'observations-04',
  'reveal-part-04',
  'comparison-part-04',
  'end-part-04',
  'part-05',
  'end-experiment-00',
]

type StudyStateRecord = {
  participant_id: string
  current_step: unknown
  welcome_age: unknown
  welcome_country: unknown
  welcome_gender: unknown
  welcome_ethnicity: unknown
  part_01_data: unknown
  part_02_data: unknown
  part_03_data: unknown
  part_04_data: unknown
  part_05_data: unknown
  updated_at: unknown
}

export type Experiment00StudyPayload = {
  current_step: Experiment00Step | null
  welcome_age: number | null
  welcome_country: string
  welcome_gender: string
  welcome_ethnicity: string
  part_01_data: Record<string, unknown>
  part_02_data: Record<string, unknown>
  part_03_data: Record<string, unknown>
  part_04_data: Record<string, unknown>
  part_05_data: Record<string, unknown>
}

function emptyWords() {
  return ['', '', '', '', '']
}

function emptyRatings(): PartRatings {
  return {
    subject1ConnectionRating: null,
    subject2ConnectionRating: null,
  }
}

function emptyObservations(): PartObservations {
  return {
    selectedSubject: '',
    reason: '',
    chosenSubjectWords: emptyWords(),
    otherSubjectWords: emptyWords(),
    selfWords: emptyWords(),
  }
}

function emptyPartFour(): PartFourState {
  return {
    watchedVideo: null,
    observations: {
      observerConnection: null,
      observerAccuracy: null,
      selfAccuracy: null,
    },
    comparison: null,
  }
}

function isStudyStep(value: unknown): value is Experiment00Step {
  return validStudySteps.includes(value as Experiment00Step)
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function readTimestamp(value: unknown) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : new Date(0).toISOString()
}

function readRating(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10
    ? value
    : null
}

function readRatings(value: unknown): PartRatings {
  const ratings = (value ?? {}) as Record<string, unknown>
  return {
    subject1ConnectionRating: readRating(ratings.subject1ConnectionRating),
    subject2ConnectionRating: readRating(ratings.subject2ConnectionRating),
  }
}

function readWords(value: unknown, persistedLength = 5) {
  const source = Array.isArray(value) ? value : []
  return emptyWords().map((_, index) => (
    index < persistedLength && typeof source[index] === 'string' ? source[index] : ''
  ))
}

function readSelectedSubject(value: unknown) {
  return value === 'subject-1' || value === 'subject-2' ? value : ''
}

function readCachedObservations(value: unknown): PartObservations {
  const observations = (value ?? {}) as Record<string, unknown>
  return {
    selectedSubject: readSelectedSubject(observations.selectedSubject),
    reason: readString(observations.reason),
    chosenSubjectWords: readWords(observations.chosenSubjectWords),
    otherSubjectWords: readWords(observations.otherSubjectWords),
    selfWords: readWords(observations.selfWords),
  }
}

function readRemoteObservations(
  value: Record<string, unknown>,
  wordCount: 3 | 5,
  includesOtherSubject: boolean,
): PartObservations {
  return {
    selectedSubject: readSelectedSubject(value.observationSelectedSubject),
    reason: readString(value.observationReason),
    chosenSubjectWords: readWords(value.chosenSubjectWords, wordCount),
    otherSubjectWords: includesOtherSubject
      ? readWords(value.otherSubjectWords, wordCount)
      : emptyWords(),
    selfWords: readWords(value.selfWords, wordCount),
  }
}

function readBinaryAnswer(value: unknown) {
  return value === 'yes' || value === 'no' ? value : null
}

function readCachedPartFour(value: unknown): PartFourState {
  const partFour = (value ?? {}) as Record<string, unknown>
  const observations = (partFour.observations ?? {}) as Record<string, unknown>
  const observerConnection = observations.observerConnection
  return {
    watchedVideo: readBinaryAnswer(partFour.watchedVideo),
    observations: {
      observerConnection: observerConnection === 'subject-1' || observerConnection === 'subject-2'
        ? observerConnection
        : null,
      observerAccuracy: readBinaryAnswer(observations.observerAccuracy),
      selfAccuracy: readBinaryAnswer(observations.selfAccuracy),
    },
    comparison: readBinaryAnswer(partFour.comparison),
  }
}

function readRemotePartFour(value: unknown): PartFourState {
  const partFour = (value ?? {}) as Record<string, unknown>
  const observerConnection = partFour.observerZeroConnection
  return {
    watchedVideo: readBinaryAnswer(partFour.watchedVideo),
    observations: {
      observerConnection: observerConnection === 'subject-1' || observerConnection === 'subject-2'
        ? observerConnection
        : null,
      observerAccuracy: readBinaryAnswer(partFour.observerZeroMoreAccurateThanInaccurate),
      selfAccuracy: readBinaryAnswer(partFour.participantMoreAccurateThanObserverZero),
    },
    comparison: readBinaryAnswer(partFour.postRevealComparison),
  }
}

export function createInitialExperiment00StudyState(participantId: string): Experiment00StudyState {
  return {
    version: 2,
    participantId,
    updatedAt: new Date().toISOString(),
    currentStep: null,
    welcome: {
      age: '',
      country: '',
      gender: '',
      ethnicity: '',
    },
    part01: emptyRatings(),
    part02: emptyRatings(),
    part03: emptyRatings(),
    part04: emptyPartFour(),
    part05: { connectionRating: null },
    observationsPart01: emptyObservations(),
    observationsPart02: emptyObservations(),
    observationsPart03: emptyObservations(),
  }
}

export function parseCachedExperiment00StudyState(
  value: unknown,
  participantId: string,
): Experiment00StudyState | null {
  if (!value || typeof value !== 'object') return null

  const cached = value as Record<string, unknown>
  const welcome = (cached.welcome ?? {}) as Record<string, unknown>
  return {
    version: 2,
    participantId,
    updatedAt: readTimestamp(cached.updatedAt),
    currentStep: isStudyStep(cached.currentStep) ? cached.currentStep : null,
    welcome: {
      age: readString(welcome.age),
      country: readString(welcome.country),
      gender: readString(welcome.gender),
      ethnicity: readString(welcome.ethnicity),
    },
    part01: readRatings(cached.part01),
    part02: readRatings(cached.part02),
    part03: readRatings(cached.part03),
    part04: readCachedPartFour(cached.part04),
    part05: {
      connectionRating: readRating(
        (cached.part05 as Record<string, unknown> | undefined)?.connectionRating,
      ),
    },
    observationsPart01: readCachedObservations(cached.observationsPart01),
    observationsPart02: readCachedObservations(cached.observationsPart02),
    observationsPart03: readCachedObservations(cached.observationsPart03),
  }
}

export function serializeExperiment00StudyState(
  state: Experiment00StudyState,
): Experiment00StudyPayload {
  const serializePart = (
    ratings: PartRatings,
    observations: PartObservations,
    wordCount: 3 | 5,
    includesOtherSubject: boolean,
  ) => ({
    ...ratings,
    observationSelectedSubject: observations.selectedSubject,
    observationReason: observations.reason,
    chosenSubjectWords: observations.chosenSubjectWords.slice(0, wordCount),
    ...(includesOtherSubject
      ? { otherSubjectWords: observations.otherSubjectWords.slice(0, wordCount) }
      : {}),
    selfWords: observations.selfWords.slice(0, wordCount),
  })

  return {
    current_step: state.currentStep,
    welcome_age: state.welcome.age === '' ? null : Number(state.welcome.age),
    welcome_country: state.welcome.country,
    welcome_gender: state.welcome.gender,
    welcome_ethnicity: state.welcome.ethnicity,
    part_01_data: serializePart(state.part01, state.observationsPart01, 5, true),
    part_02_data: serializePart(state.part02, state.observationsPart02, 3, false),
    part_03_data: serializePart(state.part03, state.observationsPart03, 3, false),
    part_04_data: {
      watchedVideo: state.part04.watchedVideo,
      observerZeroConnection: state.part04.observations.observerConnection,
      observerZeroMoreAccurateThanInaccurate: state.part04.observations.observerAccuracy,
      participantMoreAccurateThanObserverZero: state.part04.observations.selfAccuracy,
      postRevealComparison: state.part04.comparison,
    },
    part_05_data: {
      connectionRatingToCreator: state.part05.connectionRating,
    },
  }
}

function parseStudyStateRecord(value: unknown, expectedParticipantId: string) {
  const rawRecord = Array.isArray(value) ? value[0] : value
  if (!rawRecord) return null
  if (typeof rawRecord !== 'object') throw new Error('Study-state RPC returned an invalid record')

  const record = rawRecord as StudyStateRecord
  if (record.participant_id !== expectedParticipantId) {
    throw new Error('Study-state RPC returned an unexpected participant')
  }
  return record
}

function deserializeStudyStateRecord(
  record: StudyStateRecord,
  participantId: string,
): Experiment00StudyState {
  const part01 = (record.part_01_data ?? {}) as Record<string, unknown>
  const part02 = (record.part_02_data ?? {}) as Record<string, unknown>
  const part03 = (record.part_03_data ?? {}) as Record<string, unknown>
  const part05 = (record.part_05_data ?? {}) as Record<string, unknown>

  return {
    version: 2,
    participantId,
    updatedAt: readTimestamp(record.updated_at),
    currentStep: isStudyStep(record.current_step) ? record.current_step : null,
    welcome: {
      age: record.welcome_age === null || record.welcome_age === undefined
        ? ''
        : String(record.welcome_age),
      country: readString(record.welcome_country),
      gender: readString(record.welcome_gender),
      ethnicity: readString(record.welcome_ethnicity),
    },
    part01: readRatings(part01),
    part02: readRatings(part02),
    part03: readRatings(part03),
    part04: readRemotePartFour(record.part_04_data),
    part05: { connectionRating: readRating(part05.connectionRatingToCreator) },
    observationsPart01: readRemoteObservations(part01, 5, true),
    observationsPart02: readRemoteObservations(part02, 3, false),
    observationsPart03: readRemoteObservations(part03, 3, false),
  }
}

export function reconcileExperiment00StudyState(
  localState: Experiment00StudyState | null,
  remoteState: Experiment00StudyState | null,
) {
  if (!localState) return remoteState
  if (!remoteState) return localState

  return Date.parse(remoteState.updatedAt) >= Date.parse(localState.updatedAt)
    ? remoteState
    : localState
}

export async function loadExperiment00StudyState(participantId: string) {
  const { data, error } = await supabase.rpc(
    'get_experiment_00_study_state',
    { p_participant_id: participantId },
  )
  if (error) throw new Error(error.message)

  const record = parseStudyStateRecord(data, participantId)
  return record ? deserializeStudyStateRecord(record, participantId) : null
}

export async function saveExperiment00StudyState(state: Experiment00StudyState) {
  const { data, error } = await supabase.rpc(
    'save_experiment_00_study_state',
    {
      p_participant_id: state.participantId,
      p_payload: serializeExperiment00StudyState(state),
    },
  )
  if (error) throw new Error(error.message)

  const record = parseStudyStateRecord(data, state.participantId)
  if (!record) throw new Error('Study-state save RPC returned no record')
  return deserializeStudyStateRecord(record, state.participantId)
}
