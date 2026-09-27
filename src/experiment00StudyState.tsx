import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Experiment00StudyContext } from './experiment00Study'
import type { Experiment00Step, Experiment00StudyState } from './experiment00Study'
import {
  getOrCreateExperiment00Participant,
  getOrCreateExperiment00ParticipantId,
  getStoredExperiment00ParticipantId,
} from './experiment00ParticipantIdentityService'
import {
  createInitialExperiment00StudyState,
  experiment00StudyStorageKey,
  loadExperiment00StudyState,
  parseCachedExperiment00StudyState,
  reconcileExperiment00StudyState,
  saveExperiment00StudyState,
} from './experiment00StudyPersistence'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const remoteSaveDebounceMs = 600
const remoteRetryMs = 3000

function readExperiment00StudyState(): Experiment00StudyState | null {
  try {
    const participantId = getStoredExperiment00ParticipantId()
    const saved = window.localStorage.getItem(experiment00StudyStorageKey)
    if (!participantId || !saved) return null
    return parseCachedExperiment00StudyState(JSON.parse(saved), participantId)
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

function nextUpdatedAt(previousUpdatedAt: string) {
  const now = Date.now()
  const previous = Date.parse(previousUpdatedAt)
  return new Date(Number.isFinite(previous) && previous >= now ? previous + 1 : now).toISOString()
}

export function Experiment00StudyProvider({ children }: { children: ReactNode }) {
  const [studyState, setStudyState] = useState(readExperiment00StudyState)
  const saveStatusRef = useRef<SaveStatus>('idle')
  const studyStateRef = useRef(studyState)
  const remoteParticipantRef = useRef<string | null>(null)
  const initializingParticipantRef = useRef<string | null>(null)
  const remoteReadyRef = useRef(false)
  const saveInFlightRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushRemoteSaveRef = useRef<(delay?: number) => void>(() => undefined)
  const initializeRemoteRef = useRef<(participantId: string) => void>(() => undefined)

  const commitLocal = useCallback((next: Experiment00StudyState) => {
    studyStateRef.current = next
    persistStudyState(next)
    setStudyState(next)
    return next
  }, [])

  const scheduleRemoteSave = useCallback((delay = remoteSaveDebounceMs) => {
    pendingSaveRef.current = true
    if (!remoteReadyRef.current) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      flushRemoteSaveRef.current()
    }, delay)
  }, [])

  const flushRemoteSave = useCallback(async () => {
    if (!remoteReadyRef.current || !pendingSaveRef.current || saveInFlightRef.current) return

    const snapshot = studyStateRef.current
    if (!snapshot || snapshot.participantId !== remoteParticipantRef.current) return

    pendingSaveRef.current = false
    saveInFlightRef.current = true
    saveStatusRef.current = 'saving'

    try {
      const savedState = await saveExperiment00StudyState(snapshot)
      const current = studyStateRef.current
      if (current?.updatedAt === snapshot.updatedAt) {
        const acknowledged = { ...current, updatedAt: savedState.updatedAt }
        studyStateRef.current = acknowledged
        persistStudyState(acknowledged)
      } else {
        scheduleRemoteSave(0)
      }
      saveStatusRef.current = 'saved'
    } catch (error) {
      pendingSaveRef.current = true
      saveStatusRef.current = 'error'
      const message = error instanceof Error ? error.message : 'Unknown save error'
      if (import.meta.env.DEV) console.error(`[Experiment 00 study] Remote save failed: ${message}`)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null
        scheduleRemoteSave(0)
      }, remoteRetryMs)
    } finally {
      saveInFlightRef.current = false
      if (pendingSaveRef.current && !retryTimerRef.current) scheduleRemoteSave(0)
    }
  }, [scheduleRemoteSave])

  useEffect(() => {
    flushRemoteSaveRef.current = () => {
      void flushRemoteSave()
    }
  }, [flushRemoteSave])

  const initializeRemote = useCallback((participantId: string) => {
    if (remoteParticipantRef.current === participantId && remoteReadyRef.current) return
    if (initializingParticipantRef.current === participantId) return

    initializingParticipantRef.current = participantId
    remoteParticipantRef.current = participantId

    void (async () => {
      try {
        // The existing identity RPC must succeed first so the foreign key owner exists.
        await getOrCreateExperiment00Participant(participantId)
        const remoteState = await loadExperiment00StudyState(participantId)
        if (remoteParticipantRef.current !== participantId) return

        const localState = studyStateRef.current?.participantId === participantId
          ? studyStateRef.current
          : null
        const reconciled = reconcileExperiment00StudyState(localState, remoteState)

        remoteReadyRef.current = true
        initializingParticipantRef.current = null

        if (reconciled && reconciled !== localState) commitLocal(reconciled)

        if (reconciled && (!remoteState || reconciled === localState)) {
          scheduleRemoteSave(0)
        } else if (remoteState) {
          saveStatusRef.current = 'saved'
        }
      } catch (error) {
        if (remoteParticipantRef.current !== participantId) return
        initializingParticipantRef.current = null
        remoteReadyRef.current = false
        saveStatusRef.current = 'error'
        const message = error instanceof Error ? error.message : 'Unknown load error'
        if (import.meta.env.DEV) console.error(`[Experiment 00 study] Remote load failed: ${message}`)
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null
          initializeRemoteRef.current(participantId)
        }, remoteRetryMs)
      }
    })()
  }, [commitLocal, scheduleRemoteSave])

  useEffect(() => {
    initializeRemoteRef.current = initializeRemote
  }, [initializeRemote])

  const ensureStudyState = useCallback(() => {
    const participantId = getOrCreateExperiment00ParticipantId()
    const current = studyStateRef.current
    const next = current?.participantId === participantId
      ? current
      : commitLocal(createInitialExperiment00StudyState(participantId))
    initializeRemote(participantId)
    return next
  }, [commitLocal, initializeRemote])

  const updateStudyState = useCallback((
    update: (current: Experiment00StudyState) => Experiment00StudyState,
  ) => {
    const current = ensureStudyState()
    const updated = update(current)
    const next = commitLocal({
      ...updated,
      participantId: current.participantId,
      updatedAt: nextUpdatedAt(current.updatedAt),
    })
    scheduleRemoteSave()
    return next
  }, [commitLocal, ensureStudyState, scheduleRemoteSave])

  const setCurrentStep = useCallback((step: Experiment00Step) => (
    updateStudyState(current => ({ ...current, currentStep: step }))
  ), [updateStudyState])

  useEffect(() => {
    const participantId = getStoredExperiment00ParticipantId()
    if (participantId) initializeRemote(participantId)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [initializeRemote])

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== experiment00StudyStorageKey) return
      const next = readExperiment00StudyState()
      const current = studyStateRef.current
      if (next && (!current || Date.parse(next.updatedAt) > Date.parse(current.updatedAt))) {
        studyStateRef.current = next
        setStudyState(next)
      }
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
