import { createContext, useContext } from 'react'

export type Experiment00ParticipantIdentityContextValue = {
  participantId: string | null
  subjectNumber: number | null
  isLoading: boolean
  error: string | null
  retry: () => void
}

export const Experiment00ParticipantIdentityContext = (
  createContext<Experiment00ParticipantIdentityContextValue | null>(null)
)

export function useExperiment00ParticipantIdentity() {
  const context = useContext(Experiment00ParticipantIdentityContext)
  if (!context) {
    throw new Error('useExperiment00ParticipantIdentity must be used inside Experiment00ParticipantIdentityProvider')
  }
  return context
}

