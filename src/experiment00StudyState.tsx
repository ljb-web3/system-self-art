import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Experiment00StudyContext } from './experiment00Study'
import type {
  Experiment00Step,
  Experiment00StudyState,
  PartFiveState,
  PartFourState,
  PartObservations,
  PartRatings,
} from './experiment00Study'
import { getOrCreateExperiment00ParticipantId } from './experiment00ParticipantIdentityService'

const experiment00StudyStorageKey = 'system-self-experiment-00-study'

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

function emptyPartFive(): PartFiveState {
  return {
    connectionRating: null,
  }
}

function createInitialStudyState(): Experiment00StudyState {
  return {
    version: 1,
    participantId: getOrCreateExperiment00ParticipantId(),
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
    part05: emptyPartFive(),
    observationsPart01: emptyObservations(),
    observationsPart02: emptyObservations(),
    observationsPart03: emptyObservations(),
  }
}

function isStudyStep(value: unknown): value is Experiment00Step {
  return [
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
  ].includes(value as Experiment00Step)
}

function readWords(value: unknown) {
  if (!Array.isArray(value)) return emptyWords()
  return emptyWords().map((_, index) => typeof value[index] === 'string' ? value[index] : '')
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
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

function readObservations(value: unknown): PartObservations {
  const observations = (value ?? {}) as Record<string, unknown>
  const selectedSubject = observations.selectedSubject
  return {
    selectedSubject: selectedSubject === 'subject-1' || selectedSubject === 'subject-2'
      ? selectedSubject
      : '',
    reason: readString(observations.reason),
    chosenSubjectWords: readWords(observations.chosenSubjectWords),
    otherSubjectWords: readWords(observations.otherSubjectWords),
    selfWords: readWords(observations.selfWords),
  }
}

function readBinaryAnswer(value: unknown) {
  return value === 'yes' || value === 'no' ? value : null
}

function readPartFour(value: unknown): PartFourState {
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

function readPartFive(value: unknown): PartFiveState {
  const partFive = (value ?? {}) as Record<string, unknown>
  return {
    connectionRating: readRating(partFive.connectionRating),
  }
}

function readExperiment00StudyState(): Experiment00StudyState | null {
  try {
    const saved = window.localStorage.getItem(experiment00StudyStorageKey)
    if (!saved) return null

    const value = JSON.parse(saved) as Record<string, unknown>

    const welcome = (value.welcome ?? {}) as Record<string, unknown>
    return {
      version: 1,
      participantId: getOrCreateExperiment00ParticipantId(),
      currentStep: isStudyStep(value.currentStep) ? value.currentStep : null,
      welcome: {
        age: readString(welcome.age),
        country: readString(welcome.country),
        gender: readString(welcome.gender),
        ethnicity: readString(welcome.ethnicity),
      },
      part01: readRatings(value.part01),
      part02: readRatings(value.part02),
      part03: readRatings(value.part03),
      part04: readPartFour(value.part04),
      part05: readPartFive(value.part05),
      observationsPart01: readObservations(value.observationsPart01),
      observationsPart02: readObservations(value.observationsPart02),
      observationsPart03: readObservations(value.observationsPart03),
    }
  } catch {
    return null
  }
}

function persistStudyState(state: Experiment00StudyState) {
  try {
    window.localStorage.setItem(experiment00StudyStorageKey, JSON.stringify(state))
  } catch {
    // The study remains usable in-memory when storage is unavailable.
  }
}

export function Experiment00StudyProvider({ children }: { children: ReactNode }) {
  const [studyState, setStudyState] = useState(readExperiment00StudyState)
  const studyStateRef = useRef(studyState)

  const commit = useCallback((next: Experiment00StudyState) => {
    studyStateRef.current = next
    persistStudyState(next)
    setStudyState(next)
    return next
  }, [])

  const ensureStudyState = useCallback(() => {
    if (studyStateRef.current) return studyStateRef.current
    return commit(createInitialStudyState())
  }, [commit])

  const updateStudyState = useCallback((
    update: (current: Experiment00StudyState) => Experiment00StudyState,
  ) => commit(update(studyStateRef.current ?? createInitialStudyState())), [commit])

  const setCurrentStep = useCallback((step: Experiment00Step) => (
    updateStudyState(current => ({ ...current, currentStep: step }))
  ), [updateStudyState])

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== experiment00StudyStorageKey) return
      const next = readExperiment00StudyState()
      studyStateRef.current = next
      setStudyState(next)
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const value = useMemo(() => ({
    studyState,
    ensureStudyState,
    updateStudyState,
    setCurrentStep,
  }), [ensureStudyState, setCurrentStep, studyState, updateStudyState])

  return (
    <Experiment00StudyContext.Provider value={value}>
      {children}
    </Experiment00StudyContext.Provider>
  )
}
