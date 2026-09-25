import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Experiment00ParticipantIdentityContext } from './experiment00ParticipantIdentity'
import {
  getOrCreateExperiment00Participant,
  getOrCreateExperiment00ParticipantId,
} from './experiment00ParticipantIdentityService'

export function Experiment00ParticipantIdentityProvider({ children }: { children: ReactNode }) {
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [subjectNumber, setSubjectNumber] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const activeAttempt = useRef(0)

  const retry = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setAttempt(current => current + 1)
  }, [])

  useEffect(() => {
    const requestAttempt = activeAttempt.current + 1
    activeAttempt.current = requestAttempt

    void Promise.resolve().then(async () => {
      try {
        const localParticipantId = getOrCreateExperiment00ParticipantId()
        if (activeAttempt.current !== requestAttempt) return
        setParticipantId(localParticipantId)

        const participant = await getOrCreateExperiment00Participant(localParticipantId)
        if (activeAttempt.current !== requestAttempt) return
        setSubjectNumber(participant.subject_number)
        setIsLoading(false)
      } catch (caughtError) {
        if (activeAttempt.current !== requestAttempt) return
        const message = caughtError instanceof Error
          ? caughtError.message
          : 'Unable to initialize participant identity'
        console.error(`[Experiment 00 identity] ${message}`)
        setSubjectNumber(null)
        setIsLoading(false)
        setError(message)
      }
    })

    return () => {
      if (activeAttempt.current === requestAttempt) activeAttempt.current += 1
    }
  }, [attempt])

  const value = useMemo(() => ({
    participantId,
    subjectNumber,
    isLoading,
    error,
    retry,
  }), [error, isLoading, participantId, retry, subjectNumber])

  return (
    <Experiment00ParticipantIdentityContext.Provider value={value}>
      {children}
    </Experiment00ParticipantIdentityContext.Provider>
  )
}
