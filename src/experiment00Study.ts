import { createContext, useContext } from 'react'

export type Experiment00Step =
  | 'explanations'
  | 'welcome'
  | 'part-01'
  | 'observations-01-1'
  | 'observations-01-2'
  | 'reveal-part-01'
  | 'end-part-01'
  | 'part-02'
  | 'observations-02-1'
  | 'observations-02-2'
  | 'reveal-part-02'
  | 'end-part-02'
  | 'part-03'
  | 'observations-03-1'
  | 'observations-03-2'
  | 'reveal-part-03'
  | 'end-part-03'
  | 'part-04'
  | 'observations-04'
  | 'reveal-part-04'
  | 'comparison-part-04'
  | 'end-part-04'
  | 'part-05'
  | 'end-experiment-00'

export type ObservationSubject = 'subject-1' | 'subject-2' | ''

export type PartRatings = {
  subject1ConnectionRating: number | null
  subject2ConnectionRating: number | null
}

export type PartObservations = {
  selectedSubject: ObservationSubject
  reason: string
  chosenSubjectWords: string[]
  otherSubjectWords: string[]
  selfWords: string[]
}

export type BinaryAnswer = 'yes' | 'no' | null

export type PartFourState = {
  watchedVideo: BinaryAnswer
  observations: {
    observerConnection: 'subject-1' | 'subject-2' | null
    observerAccuracy: BinaryAnswer
    selfAccuracy: BinaryAnswer
  }
  comparison: BinaryAnswer
}

export type PartFiveState = {
  connectionRating: number | null
}

export type Experiment00StudyState = {
  version: 2
  participantId: string
  updatedAt: string
  currentStep: Experiment00Step | null
  welcome: {
    age: string
    country: string
    gender: string
    ethnicity: string
  }
  part01: PartRatings
  part02: PartRatings
  part03: PartRatings
  part04: PartFourState
  part05: PartFiveState
  observationsPart01: PartObservations
  observationsPart02: PartObservations
  observationsPart03: PartObservations
}

export type Experiment00StudyContextValue = {
  studyState: Experiment00StudyState | null
  ensureStudyState: () => Experiment00StudyState
  updateStudyState: (
    update: (current: Experiment00StudyState) => Experiment00StudyState,
  ) => Experiment00StudyState
  setCurrentStep: (step: Experiment00Step) => Experiment00StudyState
}

export const Experiment00StudyContext = createContext<Experiment00StudyContextValue | null>(null)

export function routeForExperiment00Step(step: Experiment00Step | null | undefined) {
  switch (step) {
    case 'explanations':
      return '/experiment/00/explanations'
    case 'welcome':
      return '/experiment/00/welcome'
    case 'part-01':
      return '/experiment/00/part-01'
    case 'observations-01-1':
      return '/experiment/00/part-01/observations'
    case 'observations-01-2':
      return '/experiment/00/part-01/observations/2'
    case 'reveal-part-01':
      return '/experiment/00/part-01/reveal'
    case 'end-part-01':
      return '/experiment/00/part-01/end'
    case 'part-02':
      return '/experiment/00/part-02'
    case 'observations-02-1':
      return '/experiment/00/part-02/observations'
    case 'observations-02-2':
      return '/experiment/00/part-02/observations/2'
    case 'reveal-part-02':
      return '/experiment/00/part-02/reveal'
    case 'end-part-02':
      return '/experiment/00/part-02/end'
    case 'part-03':
      return '/experiment/00/part-03'
    case 'observations-03-1':
      return '/experiment/00/part-03/observations'
    case 'observations-03-2':
      return '/experiment/00/part-03/observations/2'
    case 'reveal-part-03':
      return '/experiment/00/part-03/reveal'
    case 'end-part-03':
      return '/experiment/00/part-03/end'
    case 'part-04':
      return '/experiment/00/part-04'
    case 'observations-04':
      return '/experiment/00/part-04/observations'
    case 'reveal-part-04':
      return '/experiment/00/part-04/reveal'
    case 'comparison-part-04':
      return '/experiment/00/part-04/comparison'
    case 'end-part-04':
      return '/experiment/00/part-04/end'
    case 'part-05':
      return '/experiment/00/part-05'
    case 'end-experiment-00':
      return '/experiment/00/end'
    default:
      return '/experiment/00'
  }
}

export function useExperiment00Study() {
  const context = useContext(Experiment00StudyContext)
  if (!context) throw new Error('useExperiment00Study must be used inside Experiment00StudyProvider')
  return context
}
