import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { copy } from './copy'
import type { ConnectionCopy, Copy, Language, Subject } from './copy'
import ExplanatoryLayer from './ExplanatoryLayer'
import EntranceWarning from './EntranceWarning'
import LanguageSelection from './LanguageSelection'
import BreathingExercise from './BreathingExercise'
import DeepBreathingExercise from './DeepBreathingExercise'
import AlternatingBreathingExercise from './AlternatingBreathingExercise'
import NumberExercise from './NumberExercise'
import ColorChoiceExercise from './ColorChoiceExercise'
import FinalPresenceExercise from './FinalPresenceExercise'
import GuidedBreathingExercise from './GuidedBreathingExercise'
import ConnectionSessionIntroduction from './ConnectionSessionIntroduction'
import ConnectionRating from './ConnectionRating'
import HandleReveal from './HandleReveal'
import ThankYou from './ThankYou'
import SystemLog from './SystemLog'
import ComputerRequired from './ComputerRequired'
import { connectionRatingReducer, initialConnectionRatingState } from './ratingState'
import type { ConnectionRatingAction } from './ratingState'
import { initialPostSessionState, normalizeXHandle, postSessionReducer } from './postSession'
import type { PostSessionAction } from './postSession'
import { guidedReducer, initialGuidedState, isLocalGuide, nextGuidedCommand } from './guidedBreathing'
import type { GuidedAction, GuidedCommand } from './guidedBreathing'
import { numberReducer, initialNumberState, currentNumberAttempt } from './number'
import { colorChoiceReducer, initialColorChoiceState } from './colorChoice'
import type { ColorChoice, ColorChoiceAction } from './colorChoice'
import { finalPresenceReducer, initialFinalPresenceState } from './finalPresence'
import { alternatingReducer, alternatingIsComplete, initialAlternatingState, isLocalBreathingTurn } from './breathingAlternating'
import { breathingReducer, initialBreathingState } from './breathing478'
import { deepBreathingReducer, deepBreathingIsComplete, initialDeepBreathingState, peerFeedbackBreathCount } from './deepBreathing10'
import type { PeerBreathingPhase } from './deepBreathing10'
import { usePresence } from './hooks/usePresence'
import { useRequiredActionTimeout } from './hooks/useRequiredActionTimeout'
import type { RequiredAction } from './hooks/useRequiredActionTimeout'
import { supabase } from './lib/supabase'
import { fetchCompletedConnectionsCount, formatCompletedConnectionsCount } from './lib/completedConnections'
import {
  createPublicConnectionRequest,
  enterPublicSystem,
  establishPublicConnection,
  getOrCreatePublicCredential,
  parsePublicSelfId,
  respondToPublicConnectionRequest,
} from './lib/publicSystemLog'
import { experimentalData } from './experimentalPersistence'
import { formatSessionTime, millisecondsUntilNextHour, nextHourlySlot } from './session'
import {
  copyInvitationLink,
  enterScheduledConnection,
  invitationUrl,
  registerForScheduledConnection,
  tokenFromPath,
} from './scheduledConnection'
import type { Registration, ScheduledEntry, ScheduledGender } from './scheduledConnection'
import { scheduledGenders } from './scheduledConnection'
import { countryOptions } from './countries'
import { playPeerFeedbackSound } from './peerFeedbackAudio'
import { ReliableSession } from './reliableSession'
import { criticalEventTypes, factKey } from './protocolFacts'
import { reconcileProtocol } from './reconcileProtocol'
import { resilientLocalStorage } from './localStorage'
import { hasAcceptedWarning, rememberWarningAcceptance } from './warningAcceptance'
import { currentDeviceRequiresComputer } from './deviceParticipation'

type Page = '/' | '/about' | '/privacy' | '/participate' | '/session' | '/system-log'
type BilingualConnectionMessage = Exclude<keyof ConnectionCopy, 'begin' | 'return' | 'accept' | 'decline'>
type Connection = { connected: true; otherSelfId: string; requestId: string }
type InterruptionSource = 'local-inactivity-timeout' | 'local-presence-grace' | 'peer-critical-event'
type InterruptionCategory = 'verified-peer-absence' | 'local-required-action-inactivity' | 'received-peer-interruption'
type ParticipationBlockReason = 'spontaneous' | 'scheduled'
type PendingRequest = {
  requestId: string
  peerId: string
  direction: 'outgoing' | 'incoming'
  timer?: ReturnType<typeof setTimeout>
  expiresAt?: number
}

const requestTimeoutMs = 15_000
const peerDisconnectionGraceMs = 10_000
const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const bilingualLanguages = ['en', 'fr'] as const satisfies readonly Language[]
const languageStorageKey = 'system-self-language'
const readSavedLanguage = (): Language | null => {
  const saved = resilientLocalStorage.getItem(languageStorageKey)
  return saved === 'en' || saved === 'fr' ? saved : null
}
const shortSessionId = (value: string | null | undefined) => value?.slice(0, 8) ?? null
function sessionLog(event: string, details: Record<string, unknown> = {}) {
  console.info('[SYSTEM-SELF SESSION]', event, details)
}

function renderLineBreaks(text: string) {
  return <>{text.split('\n').map((line, index) => <span key={index}>{index > 0 && <br />}{line}</span>)}</>
}

function BilingualConnectionHeading({ message, id }: { message: BilingualConnectionMessage; id?: string }) {
  return <h2 id={id} className="bilingual-connection-heading" aria-live="polite">
    {bilingualLanguages.map(language =>
      <span key={language} lang={language}>{renderLineBreaks(copy[language].connectionState[message])}</span>,
    )}
  </h2>
}

function clearRequestTimer(request: PendingRequest | null) {
  if (request?.timer !== undefined) clearTimeout(request.timer)
}

async function sendConnectionResponse(
  channel: ReturnType<typeof supabase.channel>,
  selfId: string,
  request: PendingRequest,
  accepted: boolean,
) {
  try {
    const status = await channel.send({
      type: 'broadcast',
      event: 'connection_response',
      payload: {
        type: 'connection_response',
        from: selfId,
        to: request.peerId,
        accepted,
        requestId: request.requestId,
      },
    })
    if (status !== 'ok') console.error('Connection response could not be sent:', status)
  } catch (error) {
    console.error('Connection response could not be sent:', error)
  }
}

const readPage = (): Page => {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  if (tokenFromPath(window.location.pathname)) return '/session'
  if (path === '/reserve' || path === '/participate') return '/'
  return path === '/about' || path === '/privacy' || path === '/participate' || path === '/system-log' ? path : '/'
}

const readSystemLogPublicId = () => parsePublicSelfId(new URLSearchParams(window.location.search).get('self') ?? '')

function App() {
  const { presenceCount, selfId, otherSelfIds, presentSelfIds, presenceHealthy, isPresenceHealthy, isSelfPresent, getPresenceEvidence } = usePresence()
  const [page, setPage] = useState<Page>(readPage)
  const [publicCredential] = useState(() => getOrCreatePublicCredential(resilientLocalStorage, selfId))
  const [currentPublicId, setCurrentPublicId] = useState<number | null>(null)
  const [nextConnectionSlot, setNextConnectionSlot] = useState(() => nextHourlySlot())
  const [scheduledRegistrationSlot, setScheduledRegistrationSlot] = useState<string | null>(null)
  const [scheduledGender, setScheduledGender] = useState<ScheduledGender | ''>('')
  const [scheduledCountry, setScheduledCountry] = useState('')
  const [scheduledRegistration, setScheduledRegistration] = useState<Registration | null>(null)
  const [scheduledConfirmationOpen, setScheduledConfirmationOpen] = useState(false)
  const [scheduledRegistrationPending, setScheduledRegistrationPending] = useState(false)
  const [scheduledRegistrationError, setScheduledRegistrationError] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const initialInvitationToken = tokenFromPath(window.location.pathname)
  const invitationToken = useRef(initialInvitationToken)
  const scheduledMode = useRef(initialInvitationToken !== null)
  const [scheduledEntry, setScheduledEntry] = useState<ScheduledEntry | null>(null)
  const [completedConnectionsCount, setCompletedConnectionsCount] = useState<bigint | null>(null)
  const [completedConnectionsStatus, setCompletedConnectionsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const completedConnectionsRequest = useRef(0)
  const [entranceWarningOpen, setEntranceWarningOpen] = useState(() => !hasAcceptedWarning())
  const [participationRequiresComputer] = useState(currentDeviceRequiresComputer)
  const [participationBlockReason, setParticipationBlockReason] = useState<ParticipationBlockReason | null>(null)
  const entranceAcceptedThisMount = useRef(false)
  const [savedLanguage, setSavedLanguage] = useState<Language | null>(readSavedLanguage)
  const language = savedLanguage ?? 'en'
  const [languageOpen, setLanguageOpen] = useState(false)
  const [, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [connectionEstablished, setConnectionEstablished] = useState<boolean | null>(null)
  const [connection, setConnection] = useState<Connection | null>(null)
  const [connectionExperience, setConnectionExperience] = useState(false)
  const [interruptedRequestId, setInterruptedRequestId] = useState<string | null>(null)
  const interruptedSession = useRef<string | null>(null)
  const cancelledRequestIds = useRef(new Set<string>())

  const [breathing, dispatchBreathing] = useReducer(breathingReducer, initialBreathingState)
  const [deepBreathing, dispatchDeepBreathing] = useReducer(deepBreathingReducer, initialDeepBreathingState)
  const deepBreathingLive = useRef(deepBreathing)
  useLayoutEffect(() => { deepBreathingLive.current = deepBreathing }, [deepBreathing])
  const [alternating, dispatchAlternating] = useReducer(alternatingReducer, initialAlternatingState)
  const [alternatingSpaceHeld, setAlternatingSpaceHeld] = useState<{ requestId: string; turn: number } | null>(null)
  const [number, dispatchNumber] = useReducer(numberReducer, initialNumberState)
  const [colorChoice, dispatchColorChoice] = useReducer(colorChoiceReducer, initialColorChoiceState)
  const colorChoiceLive = useRef(colorChoice)
  useLayoutEffect(() => { colorChoiceLive.current = colorChoice }, [colorChoice])
  const applyColorChoice = useCallback((action: ColorChoiceAction) => {
    const next = colorChoiceReducer(colorChoiceLive.current, action)
    if (next === colorChoiceLive.current) return false
    colorChoiceLive.current = next
    dispatchColorChoice(action)
    return true
  }, [])
  const [finalPresence, dispatchFinalPresence] = useReducer(finalPresenceReducer, initialFinalPresenceState)
  const [guided, dispatchGuided] = useReducer(guidedReducer, initialGuidedState)
  const [sessionIntroduction, setSessionIntroduction] = useState<{ requestId: string; dismissed: boolean } | null>(null)
  const [rating, dispatchRating] = useReducer(connectionRatingReducer, initialConnectionRatingState)
  const ratingLive = useRef(rating)
  useLayoutEffect(() => { ratingLive.current = rating }, [rating])
  const applyRating = useCallback((action: ConnectionRatingAction) => {
    const next = connectionRatingReducer(ratingLive.current, action)
    if (next === ratingLive.current) return false
    ratingLive.current = next
    dispatchRating(action)
    return true
  }, [])
  const [postSession, dispatchPostSession] = useReducer(postSessionReducer, initialPostSessionState)
  const postSessionLive = useRef(postSession)
  useLayoutEffect(() => { postSessionLive.current = postSession }, [postSession])
  const applyPostSession = useCallback((action: PostSessionAction) => {
    const next = postSessionReducer(postSessionLive.current, action)
    if (next === postSessionLive.current) return false
    postSessionLive.current = next
    dispatchPostSession(action)
    return true
  }, [])
  const guidedLive = useRef(guided)
  useLayoutEffect(() => { guidedLive.current = guided }, [guided])
  const guidedPresenceSent = useRef<string | null>(null)
  const guidedReadySent = useRef<string | null>(null)
  const guidedFinalSent = useRef<string | null>(null)
  const applyGuided = useCallback((action: GuidedAction) => {
    const next = guidedReducer(guidedLive.current, action)
    if (next === guidedLive.current) return false
    guidedLive.current = next
    dispatchGuided(action)
    return true
  }, [])

  const numberSent = useRef<{ requestId: string; ready: boolean; choices: Set<string>; pairReady: Set<string> } | null>(null)
  const finalPresenceSent = useRef<{ requestId: string; ready: boolean } | null>(null)
  const alternatingSent = useRef<{ requestId: string; turns: Set<number>; complete: boolean; ready: boolean } | null>(null)
  const deepBreathingSent = useRef<{ requestId: string; ready: boolean; complete: boolean } | null>(null)
  const deepBreathingReceived = useRef<{ requestId: string; order: number; ended: boolean } | null>(null)
  const deepBreathingScreenActive = useRef(false)
  const [breathingCompletionShownFor, setBreathingCompletionShownFor] = useState<string | null>(null)
  const [exerciseRequestId, setExerciseRequestId] = useState<string | null>(null)
  const [exerciseCompletion, setExerciseCompletion] = useState<{ requestId: string; otherExerciseComplete: boolean } | null>(null)
  const completionSentFor = useRef<string | null>(null)
  const [readiness, setReadiness] = useState<{ requestId: string; localReady: boolean; otherReady: boolean } | null>(null)
  const readySentFor = useRef<string | null>(null)

  const activeConnection = useRef<Connection | null>(null)
  const connectionTransition = useRef<ReturnType<typeof setTimeout> | null>(null)
  const disconnectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const temporaryResultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [noOtherSelf, setNoOtherSelf] = useState(false)
  const [, setSelectedSelfId] = useState<string | null>(null)
  const [incomingRequest, setIncomingRequest] = useState<{ from: string; requestId: string } | null>(null)
  const pendingRequest = useRef<PendingRequest | null>(null)
  const matchingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const reliableSession = useRef<ReliableSession | null>(null)
  const consumedProtocolTransitions = useRef(new Set<string>())
  const [protocolRevision, setProtocolRevision] = useState(0)
  const [peerProtocolActivity, setPeerProtocolActivity] = useState(0)
  const sendSessionMessage = useCallback((message: { type: 'broadcast'; event: string; payload: Record<string, unknown> }): Promise<string> => {
    const current = activeConnection.current
    if (criticalEventTypes.has(message.event)) {
      if (!current || message.payload.requestId !== current.requestId || message.payload.to !== current.otherSelfId || message.payload.from !== selfId) return Promise.resolve('error')
      return Promise.resolve(reliableSession.current?.commit({ eventType: message.event, payload: message.payload }) ? 'ok' : 'error')
    }
    return matchingChannel.current?.send(message) ?? Promise.resolve('error')
  }, [selfId])
  const sessionInterruptEligible = useRef(false)
  const sessionDiagnostic = useRef<{ exercise: string; requestId: string | null; selfId: string }>({ exercise: 'idle', requestId: null, selfId })
  const wasSessionActive = useRef(false)

  const sendHandleIfMutual = useCallback((current: Connection) => {
    const state = postSessionLive.current
    const channel = matchingChannel.current
    if (!channel || activeConnection.current !== current || !sessionInterruptEligible.current ||
      ratingLive.current.requestId !== current.requestId || ratingLive.current.selection === null ||
      !ratingLive.current.otherComplete || state.requestId !== current.requestId || !state.entered ||
      !state.localDecision || !state.otherDecision || !state.localHandle || state.handleSent ||
      !reliableSession.current?.hasAcknowledged('post_session_decision')) return
    if (!applyPostSession({ type: 'handle-sent', requestId: current.requestId })) return
    sessionLog('post-session handle SEND after mutual consent', sessionDiagnostic.current)
    void sendSessionMessage({ type: 'broadcast', event: 'post_session_handle', payload: {
      type: 'post_session_handle', from: selfId, to: current.otherSelfId,
      requestId: current.requestId, handle: state.localHandle,
    } }).then(status => { if (status !== 'ok') console.error('Post-session handle could not be sent:', status) })
      .catch(error => console.error('Post-session handle could not be sent:', error))
  }, [applyPostSession, selfId, sendSessionMessage])

  const [subject, setSubject] = useState<Subject | null>(null)
  const languageControl = useRef<HTMLDivElement>(null)
  const languageButton = useRef<HTMLButtonElement>(null)
  const layerTrigger = useRef<HTMLButtonElement | null>(null)
  const main = useRef<HTMLElement>(null)
  const routeChanged = useRef(false)
  const t = copy[language]
  const scheduledCountries = countryOptions(language)

  const ensurePublicIdentity = useCallback(async () => {
    const publicId = await enterPublicSystem(supabase, selfId, publicCredential)
    setCurrentPublicId(publicId)
    return publicId
  }, [selfId, publicCredential])

  useEffect(() => {
    let cancelled = false
    void enterPublicSystem(supabase, selfId, publicCredential)
      .then(publicId => { if (!cancelled) setCurrentPublicId(publicId) })
      .catch(error => console.error('Public SELF identity could not be established:', error))
    return () => { cancelled = true }
  }, [selfId, publicCredential])

  const refreshCompletedConnectionsCount = useCallback(async () => {
    const request = ++completedConnectionsRequest.current
    try {
      const count = await fetchCompletedConnectionsCount(supabase)
      if (request === completedConnectionsRequest.current) {
        setCompletedConnectionsCount(count)
        setCompletedConnectionsStatus('ready')
      }
    } catch (error) {
      if (request === completedConnectionsRequest.current) {
        setCompletedConnectionsCount(null)
        setCompletedConnectionsStatus('error')
        const diagnostic = error instanceof Error ? error.message : 'Unknown completed-connections error.'
        console.error(`Completed connections count could not be loaded: ${diagnostic}`)
      }
    }
  }, [])

  useEffect(() => {
    if (page !== '/') return
    const timer = setTimeout(() => { void refreshCompletedConnectionsCount() }, 0)
    return () => clearTimeout(timer)
  }, [page, refreshCompletedConnectionsCount])

  useEffect(() => {
    if (page !== '/' || connection !== null || interruptedRequestId !== null) return
    let timer: ReturnType<typeof setTimeout>
    const scheduleRollover = () => {
      setNextConnectionSlot(nextHourlySlot())
      timer = setTimeout(scheduleRollover, millisecondsUntilNextHour() + 25)
    }
    timer = setTimeout(scheduleRollover, millisecondsUntilNextHour() + 25)
    return () => clearTimeout(timer)
  }, [page, connection, interruptedRequestId])

  const acceptEntranceWarning = useCallback(() => {
    rememberWarningAcceptance()
    entranceAcceptedThisMount.current = true
    setEntranceWarningOpen(false)
  }, [])

  const chooseLanguage = useCallback((selectedLanguage: Language) => {
    resilientLocalStorage.setItem(languageStorageKey, selectedLanguage)
    setSavedLanguage(selectedLanguage)
  }, [])

  useEffect(() => {
    if (!entranceWarningOpen && savedLanguage !== null && entranceAcceptedThisMount.current) {
      main.current?.focus({ preventScroll: true })
      entranceAcceptedThisMount.current = false
    }
  }, [entranceWarningOpen, savedLanguage])

  const localReady = connection !== null && readiness?.requestId === connection.requestId && readiness.localReady
  const otherReady = connection !== null && readiness?.requestId === connection.requestId && readiness.otherReady
  const experienceStarted = localReady && otherReady
  const localExerciseComplete =
    connection !== null && breathing.requestId === connection.requestId && breathing.phase === 'complete'
  const alternatingComplete =
    connection !== null &&
    alternating.requestId === connection.requestId &&
    alternatingIsComplete(alternating)
  const deepBreathingComplete = connection !== null && deepBreathing.requestId === connection.requestId && deepBreathingIsComplete(deepBreathing)

  useEffect(() => {
    experimentalData.ensureSelf(selfId)
  }, [selfId])

  useEffect(() => {
    if (!connection || breathing.requestId !== connection.requestId || breathing.phase !== 'complete') return
    experimentalData.recordExerciseCompletion(connection.requestId, selfId, 'breathing_478')
  }, [connection, selfId, breathing.requestId, breathing.phase])

  useEffect(() => {
    if (!connection || deepBreathing.requestId !== connection.requestId || deepBreathing.breaths.length === 0) return
    const origin = deepBreathing.breaths[0].inhaleStartedAt
    deepBreathing.breaths.forEach(item => experimentalData.recordBreath({
      sessionId: connection.requestId,
      selfId,
      exercise: 'deep_breathing_10',
      round: 1,
      breathNumber: item.breath,
      role: 'participant',
      spaceOffsetMs: item.inhaleStartedAt - origin,
      ctrlOffsetMs: null,
      enterOffsetMs: item.exhaleStartedAt - origin,
      spaceReleaseOffsetMs: item.inhaleCompletedAt - origin,
      ctrlReleaseOffsetMs: null,
      enterReleaseOffsetMs: item.completedAt - origin,
    }))
  }, [connection, selfId, deepBreathing.requestId, deepBreathing.breaths])

  useEffect(() => {
    if (!connection || alternating.requestId !== connection.requestId || alternating.breaths.length === 0) return
    const origin = alternating.breaths[0].inhaleStartedAt
    alternating.breaths.forEach(item => experimentalData.recordBreath({
      sessionId: connection.requestId,
      selfId,
      exercise: 'breathing_alternating',
      round: 1,
      breathNumber: item.breath,
      role: 'participant',
      spaceOffsetMs: item.inhaleStartedAt - origin,
      ctrlOffsetMs: null,
      enterOffsetMs: item.exhaleStartedAt - origin,
      spaceReleaseOffsetMs: item.inhaleCompletedAt - origin,
      ctrlReleaseOffsetMs: null,
      enterReleaseOffsetMs: item.completedAt - origin,
    }))
  }, [connection, selfId, alternating.requestId, alternating.breaths])

  useEffect(() => {
    if (!connection || guided.requestId !== connection.requestId) return
    const localRound = guided.localGuidesFirst ? 1 : 2
    const completed = guided.completedRounds.find(item => item.round === localRound)
    if (!completed || completed.breaths.length === 0) return
    const origin = completed.breaths[0].inhaleAt
    completed.breaths.forEach((item, index) => {
      if (item.exhaleAt === undefined || item.inhaleReleaseAt === undefined || item.exhaleReleaseAt === undefined) return
      experimentalData.recordBreath({
        sessionId: connection.requestId,
        selfId,
        exercise: 'guided_breathing',
        round: localRound,
        breathNumber: index + 1,
        role: 'guide',
        spaceOffsetMs: item.inhaleAt - origin,
        ctrlOffsetMs: item.holdAt === undefined ? null : item.holdAt - origin,
        enterOffsetMs: item.exhaleAt - origin,
        spaceReleaseOffsetMs: item.inhaleReleaseAt - origin,
        ctrlReleaseOffsetMs: item.holdReleaseAt === undefined ? null : item.holdReleaseAt - origin,
        enterReleaseOffsetMs: item.exhaleReleaseAt - origin,
      })
    })
  }, [connection, selfId, guided.requestId, guided.localGuidesFirst, guided.completedRounds])

  useEffect(() => {
    if (!connection || number.requestId !== connection.requestId) return
    number.rounds.forEach(item => {
      if (item.firstAttempt.localChoice !== null)
        experimentalData.recordNumberChoice(connection.requestId, selfId, item.round, 1, item.firstAttempt.localChoice)
      if (item.secondAttempt.occurred && item.secondAttempt.localChoice !== null)
        experimentalData.recordNumberChoice(connection.requestId, selfId, item.round, 2, item.secondAttempt.localChoice)
    })
  }, [connection, selfId, number.requestId, number.rounds])

  useEffect(() => {
    if (!connection || colorChoice.requestId !== connection.requestId || colorChoice.localOwn === null || colorChoice.localGuess === null) return
    experimentalData.recordColorResult(connection.requestId, selfId, colorChoice.localOwn, colorChoice.localGuess)
  }, [connection, selfId, colorChoice.requestId, colorChoice.localOwn, colorChoice.localGuess])

  useEffect(() => {
    if (!connection || rating.requestId !== connection.requestId || rating.selection === null) return
    experimentalData.recordRating(connection.requestId, selfId, rating.selection.value)
  }, [connection, selfId, rating.requestId, rating.selection])

  useEffect(() => {
    if (!connection || postSession.requestId !== connection.requestId || postSession.localDecision === null) return
    experimentalData.recordXConsent(connection.requestId, selfId, postSession.localDecision)
  }, [connection, selfId, postSession.requestId, postSession.localDecision])

  useEffect(() => {
    if (!connection || postSession.requestId !== connection.requestId || !postSession.final) return
    experimentalData.markSessionComplete(connection.requestId, selfId)
    void experimentalData.flush().then(refreshCompletedConnectionsCount)
  }, [connection, selfId, postSession.requestId, postSession.final, refreshCompletedConnectionsCount])
  useLayoutEffect(() => {
    deepBreathingScreenActive.current = page === '/' && connectionExperience && connection !== null &&
      exerciseRequestId === connection.requestId && breathingCompletionShownFor === connection.requestId &&
      deepBreathing.requestId === connection.requestId && deepBreathing.enabled && !deepBreathingComplete
  }, [page, connectionExperience, connection, exerciseRequestId, breathingCompletionShownFor, deepBreathing, deepBreathingComplete])

  const clearDisconnectionTimer = useCallback((reason = 'session_changed') => {
    if (disconnectionTimer.current !== null) {
      sessionLog('PRESENCE GRACE CANCEL', { ...sessionDiagnostic.current, reason })
      clearTimeout(disconnectionTimer.current)
    }
    disconnectionTimer.current = null
  }, [])

  const clearTemporaryResultTimer = useCallback(() => {
    if (temporaryResultTimer.current !== null) clearTimeout(temporaryResultTimer.current)
    temporaryResultTimer.current = null
  }, [])

  const showTemporaryResult = useCallback((kind: 'no-other' | 'failed') => {
    clearTemporaryResultTimer()
    setNoOtherSelf(kind === 'no-other')
    setConnectionEstablished(kind === 'failed' ? false : null)
    const timer = setTimeout(() => {
      if (temporaryResultTimer.current !== timer || activeConnection.current) return
      temporaryResultTimer.current = null
      setNoOtherSelf(false)
      setConnectionEstablished(null)
    }, 5_000)
    temporaryResultTimer.current = timer
  }, [clearTemporaryResultTimer])

  const interruptConnection = useCallback((current: Connection, reason: 'presence' | 'inactivity', source: InterruptionSource, createCriticalEvent: boolean) => {
    // Invalidate the session before updating React state so queued events cannot revive it.
    if (activeConnection.current !== current) {
      sessionLog('INTERRUPTION DECISION REJECTED stale connection', { ...sessionDiagnostic.current, reason, source })
      return
    }
    const presenceEvidence = getPresenceEvidence(current.otherSelfId)
    const category: InterruptionCategory = source === 'local-presence-grace' ? 'verified-peer-absence' :
      source === 'local-inactivity-timeout' ? 'local-required-action-inactivity' : 'received-peer-interruption'
    sessionLog('INTERRUPTION DECISION', {
      ...sessionDiagnostic.current,
      reason,
      source,
      category,
      createCriticalEvent,
      requestId: shortSessionId(current.requestId),
      peerId: shortSessionId(current.otherSelfId),
      matchingHealthy: reliableSession.current?.healthy ?? false,
      presenceEvidence,
    })
    if (createCriticalEvent) reliableSession.current?.interrupt(reason)
    else reliableSession.current?.acceptPeerInterruption()
    consumedProtocolTransitions.current.clear()
    activeConnection.current = null
    cancelledRequestIds.current.add(current.requestId)
    sessionLog('requestId cancelled', { ...sessionDiagnostic.current, requestId: shortSessionId(current.requestId) })
    interruptedSession.current = current.requestId
    clearDisconnectionTimer()
    clearTemporaryResultTimer()
    clearRequestTimer(pendingRequest.current)
    pendingRequest.current = null
    if (connectionTransition.current !== null) clearTimeout(connectionTransition.current)
    connectionTransition.current = null

    readySentFor.current = null
    completionSentFor.current = null
    alternatingSent.current = null
    deepBreathingSent.current = null
    deepBreathingReceived.current = null
    numberSent.current = null
    finalPresenceSent.current = null
    guidedPresenceSent.current = null
    guidedReadySent.current = null
    guidedFinalSent.current = null
    guidedLive.current = initialGuidedState
    ratingLive.current = initialConnectionRatingState
    postSessionLive.current = initialPostSessionState
    dispatchRating({ type: 'cancel', requestId: current.requestId })
    dispatchPostSession({ type: 'cancel', requestId: current.requestId })
    setSessionIntroduction(null)
    setReadiness(null)
    setExerciseRequestId(null)
    setExerciseCompletion(null)
    setBreathingCompletionShownFor(null)
    dispatchBreathing({ type: 'cancel', requestId: current.requestId })
    dispatchDeepBreathing({ type: 'cancel', requestId: current.requestId })
    dispatchAlternating({ type: 'cancel', requestId: current.requestId })
    dispatchNumber({ type: 'cancel', requestId: current.requestId })
    applyColorChoice({ type: 'cancel', requestId: current.requestId })
    dispatchFinalPresence({ type: 'cancel', requestId: current.requestId })
    dispatchGuided({ type: 'cancel', requestId: current.requestId })
    setConnection(null)
    sessionLog('connection cleared; interruption screen requested', sessionDiagnostic.current)
    setConnectionExperience(false)
    setConnectionEstablished(null)
    setIncomingRequest(null)
    setSelectedSelfId(null)
    setSearching(false)
    setSearchOpen(false)
    setNoOtherSelf(false)
    setSubject(null)
    setLanguageOpen(false)
    setInterruptedRequestId(current.requestId)
    sessionLog('CONNECTION INTERRUPTED', { ...sessionDiagnostic.current, reason, source, category })
    main.current?.focus({ preventScroll: true })
  }, [clearDisconnectionTimer, clearTemporaryResultTimer, applyColorChoice, getPresenceEvidence])

  const connectedPeerPresent = connection !== null && presentSelfIds.includes(connection.otherSelfId)

  const onAlternatingSpaceHoldChange = useCallback((held: boolean, requestId: string, turn: number) => {
    if (held) setAlternatingSpaceHeld({ requestId, turn })
    else setAlternatingSpaceHeld(previous => previous?.requestId === requestId && previous.turn === turn ? null : previous)
  }, [])

  const spaceHeldForCurrentTurn = alternatingSpaceHeld?.requestId === connection?.requestId &&
    alternatingSpaceHeld?.turn === alternating.turnNumber

  useLayoutEffect(() => {
    sessionInterruptEligible.current = !!connection && connectionExperience
  }, [connection, connectionExperience])

  // Mirror the rendered session branch. Passive peer waits and every automatic
  // PRESENCE phase deliberately produce no participant-inactivity deadline.
  let requiredAction: RequiredAction | null = null
  if (page === '/' && interruptedRequestId === null && connection && connectionExperience) {
    const requestId = connection.requestId
    if (!experienceStarted) {
      if (!localReady) requiredAction = { requestId, exercise: 'connection', action: 'begin' }
    } else if (exerciseRequestId === requestId && exerciseCompletion?.requestId === requestId) {
      if (sessionIntroduction?.requestId === requestId && !sessionIntroduction.dismissed) {
        requiredAction = { requestId, exercise: 'connection_session', action: 'continue' }
      } else if (colorChoice.requestId === requestId && colorChoice.phase === 'complete' && rating.requestId === requestId && rating.stage === 'rating') {
        if (rating.selection === null) requiredAction = { requestId, exercise: 'connection_rating', action: 'select' }
      } else if (!guided.localPresenceComplete || !guided.otherPresenceComplete) {
        if (finalPresence.phase === 'intro') requiredAction = { requestId, exercise: 'final_presence', action: 'begin' }
        else if (finalPresence.phase === 'ready' && !finalPresence.localReady)
          requiredAction = { requestId, exercise: 'final_presence', action: 'enter' }
      } else if (breathingCompletionShownFor !== requestId || deepBreathing.requestId !== requestId || !deepBreathing.enabled) {
        if (breathing.requestId === requestId) {
          if (breathing.phase === 'intro') requiredAction = { requestId, exercise: 'breathing_478', action: 'begin' }
          else if (breathing.phase === 'ready') requiredAction = { requestId, exercise: 'breathing_478', action: 'start-s' }
          else if (breathing.phase === 'inhale' && breathing.current === null) requiredAction = { requestId, exercise: 'breathing_478', action: `round${breathing.rounds.length + 1}-space` }
          else if (breathing.phase === 'hold' && breathing.current?.holdStartedAt === undefined) requiredAction = { requestId, exercise: 'breathing_478', action: `round${breathing.rounds.length + 1}-control` }
          else if (breathing.phase === 'exhale' && breathing.current?.exhaleStartedAt === undefined) requiredAction = { requestId, exercise: 'breathing_478', action: `round${breathing.rounds.length + 1}-enter` }
        }
      } else if (!(deepBreathingComplete && alternating.requestId === requestId && alternating.local1AComplete && alternating.other1AComplete)) {
        if (!deepBreathing.localReady) requiredAction = { requestId, exercise: 'deep_breathing_10', action: 'begin' }
        else if (deepBreathing.otherReady && deepBreathing.phase === 'inhale' && deepBreathing.current === null) requiredAction = { requestId, exercise: 'deep_breathing_10', action: `breath${deepBreathing.breaths.length + 1}-space` }
        else if (deepBreathing.otherReady && deepBreathing.phase === 'exhale' && deepBreathing.current?.exhaleStartedAt === undefined) requiredAction = { requestId, exercise: 'deep_breathing_10', action: `breath${deepBreathing.breaths.length + 1}-enter` }
      } else if (!alternatingComplete) {
        if (!alternating.localReady) requiredAction = { requestId, exercise: 'breathing_alternating', action: 'begin' }
        else if (isLocalBreathingTurn(alternating) && (alternating.inhaleStartedAt === null ||
          alternating.inhaleCompletedAt !== null && alternating.exhaleStartedAt === null && !spaceHeldForCurrentTurn)) requiredAction = {
          requestId, exercise: 'breathing_alternating',
          action: `turn${alternating.turnNumber}-${alternating.inhaleStartedAt === null ? 'space' : 'enter'}`,
        }
      } else if (guided.phase !== 'complete') {
        if (guided.phase === 'intro') requiredAction = { requestId, exercise: 'guided_breathing', action: 'begin' }
        else if (guided.phase === 'ready') requiredAction = { requestId, exercise: 'guided_breathing', action: `round${guided.round}-s` }
        else if (guided.phase === 'active' && isLocalGuide(guided) && nextGuidedCommand(guided) !== null) requiredAction = {
          requestId, exercise: 'guided_breathing', action: `round${guided.round}-breath${guided.breaths.filter(b => b.exhaleReleaseAt !== undefined).length + 1}-${nextGuidedCommand(guided)}`,
        }
        else if (guided.phase === 'final') requiredAction = { requestId, exercise: 'guided_breathing', action: 'final-enter' }
      } else if (number.enabled && number.requestId === requestId && number.phase !== 'complete') {
        if (number.phase === 'intro' && !number.localReady) requiredAction = { requestId, exercise: 'number', action: 'begin' }
        else if (number.phase === 'choose' && currentNumberAttempt(number).localChoice === null) requiredAction = {
          requestId, exercise: 'number', action: `round${number.round}-attempt${number.attempt}-choose`,
        }
      } else if (colorChoice.enabled && colorChoice.requestId === requestId) {
        if (colorChoice.phase === 'own' && colorChoice.localOwn === null)
          requiredAction = { requestId, exercise: 'color_choice', action: 'choose-own' }
        else if (colorChoice.phase === 'guess' && colorChoice.localGuess === null)
          requiredAction = { requestId, exercise: 'color_choice', action: 'guess-peer' }
      }
    }
  }

  useRequiredActionTimeout(
    requiredAction,
    action => {
      const current = activeConnection.current
      return !!current && current === connection && current.requestId === action.requestId &&
        sessionInterruptEligible.current && requiredAction !== null &&
        requiredAction.requestId === action.requestId && requiredAction.exercise === action.exercise &&
        requiredAction.action === action.action &&
        (requiredAction.startedAt === undefined || requiredAction.startedAt === action.startedAt)
    },
    action => {
      const current = activeConnection.current
      if (!current || current.requestId !== action.requestId) return
      sessionLog('INACTIVITY DEADLINE EXPIRED', { ...sessionDiagnostic.current, action: action.action })
      interruptConnection(current, 'inactivity', 'local-inactivity-timeout', true)
    },
  )

  useEffect(() => {
    const exercise = connectionExperience && connection ?
      rating.requestId === connection.requestId && rating.stage === 'rating' ? 'connection_rating' :
      sessionIntroduction?.requestId === connection.requestId && !sessionIntroduction.dismissed && experienceStarted ? 'connection_session' :
      colorChoice.requestId === connection.requestId && colorChoice.enabled ? 'color_choice' :
      number.requestId === connection.requestId && number.enabled ? 'number' :
      guided.requestId === connection.requestId && guided.phase !== 'intro' ? 'guided_breathing' :
      alternating.requestId === connection.requestId && alternating.localReady ? 'breathing_alternating' :
      deepBreathing.requestId === connection.requestId && deepBreathing.enabled ? 'deep_breathing_10' :
      guided.localPresenceComplete && guided.otherPresenceComplete ? 'breathing_478' : 'final_presence'
      : 'idle'
    sessionDiagnostic.current = { exercise, requestId: shortSessionId(connection?.requestId), selfId: shortSessionId(selfId) ?? '' }
    if (exercise === 'deep_breathing_10') sessionLog('STATE', {
      ...sessionDiagnostic.current, localReady: deepBreathing.localReady, remoteReady: deepBreathing.otherReady,
      localComplete: deepBreathing.phase === 'complete', remoteComplete: deepBreathing.otherExerciseComplete,
      breath: deepBreathing.breaths.length, phase: deepBreathing.phase, peerPresent: connectedPeerPresent,
    })
    if (exercise === 'breathing_alternating') sessionLog('STATE', {
      ...sessionDiagnostic.current, localReady: alternating.localReady, remoteReady: alternating.otherReady,
      localComplete: alternating.localExerciseComplete, remoteComplete: alternating.otherExerciseComplete,
      turn: alternating.turnNumber, peerPresent: connectedPeerPresent,
    })
    if (connection && connectionExperience) wasSessionActive.current = true
    else if (wasSessionActive.current && page === '/' && interruptedRequestId === null) {
      sessionLog('HOME RESET reason=inactive-session-render', { ...sessionDiagnostic.current, hasConnection: !!connection, connectionExperience, exerciseRequestId: shortSessionId(exerciseRequestId) })
      wasSessionActive.current = false
    }
  }, [connection, connectionExperience, selfId, deepBreathing, alternating, number, colorChoice, finalPresence, guided, rating, sessionIntroduction, experienceStarted, connectedPeerPresent, page, interruptedRequestId, exerciseRequestId])

  useEffect(() => {
    if (!connection || guided.requestId !== connection.requestId || !guided.localPresenceComplete || !guided.otherPresenceComplete) return
    if (guided.phase === 'intro') sessionLog('guided breathing Round 1 roles', {
      guide: shortSessionId(guided.localGuidesFirst ? selfId : connection.otherSelfId),
      breather: shortSessionId(guided.localGuidesFirst ? connection.otherSelfId : selfId),
    })
    if (guided.round === 2 && guided.phase === 'ready') sessionLog('guided breathing Round 2 roles', {
      guide: shortSessionId(guided.localGuidesFirst ? connection.otherSelfId : selfId),
      breather: shortSessionId(guided.localGuidesFirst ? selfId : connection.otherSelfId),
    })
  }, [connection, guided.requestId, guided.localPresenceComplete, guided.otherPresenceComplete, guided.phase, guided.round, guided.localGuidesFirst, selfId])

  useEffect(() => {
    const onPageHide = () => {
      if (wasSessionActive.current) sessionLog('HOME RESET reason=pagehide', sessionDiagnostic.current)
    }
    window.addEventListener('pagehide', onPageHide)
    sessionLog('App mounted', { selfId: shortSessionId(selfId), path: window.location.pathname })
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      if (wasSessionActive.current) sessionLog('HOME RESET reason=app-unmount', sessionDiagnostic.current)
    }
  }, [selfId])

  useEffect(() => {
    if (!connection || connectedPeerPresent || !presenceHealthy || !isPresenceHealthy() || !reliableSession.current?.healthy) return

    const current = connection
    const startEvidence = getPresenceEvidence(current.otherSelfId)
    const startPeerActivity = reliableSession.current?.peerActivity ?? 0
    if (!startEvidence.healthy || startEvidence.peerPresent || startEvidence.snapshotReceivedAt === null) return
    sessionLog('PEER ABSENCE EVIDENCE', { ...sessionDiagnostic.current, peerId: shortSessionId(current.otherSelfId), startEvidence, peerProtocolActivity: startPeerActivity })
    sessionLog('PRESENCE GRACE START', { ...sessionDiagnostic.current, peerId: shortSessionId(current.otherSelfId), duration: peerDisconnectionGraceMs, generation: startEvidence.generation, snapshotRevision: startEvidence.snapshotRevision, peerProtocolActivity: startPeerActivity })
    const timer = setTimeout(() => {
      // Recheck live refs: React may not have run effect cleanup after a channel
      // status or Presence callback changes immediately before this callback.
      if (disconnectionTimer.current !== timer || activeConnection.current !== current ||
          activeConnection.current.requestId !== current.requestId ||
          activeConnection.current.otherSelfId !== current.otherSelfId ||
          interruptedSession.current !== null || cancelledRequestIds.current.has(current.requestId) ||
          !isPresenceHealthy() || isSelfPresent(current.otherSelfId) || !reliableSession.current?.healthy ||
          reliableSession.current.peerActivity !== startPeerActivity) return
      const endEvidence = getPresenceEvidence(current.otherSelfId)
      const continuousFreshAbsence = endEvidence.healthy && !endEvidence.peerPresent &&
        endEvidence.generation === startEvidence.generation &&
        endEvidence.snapshotRevision >= startEvidence.snapshotRevision &&
        endEvidence.peerLastSeenRevision === startEvidence.peerLastSeenRevision
      if (!continuousFreshAbsence) {
        sessionLog('PRESENCE GRACE REJECTED insufficient evidence', { ...sessionDiagnostic.current, startEvidence, endEvidence })
        return
      }
      disconnectionTimer.current = null
      sessionLog('PRESENCE GRACE VERIFIED', { ...sessionDiagnostic.current, requestId: shortSessionId(current.requestId), startEvidence, endEvidence })
      interruptConnection(current, 'presence', 'local-presence-grace', true)
    }, peerDisconnectionGraceMs)
    disconnectionTimer.current = timer

    // A fresh healthy sync is required after any outage. Unrelated syncs while
    // this peer remains absent do not restart the grace period.
    return () => clearDisconnectionTimer(!isPresenceHealthy() ? 'realtime_unhealthy' :
      isSelfPresent(current.otherSelfId) ? 'peer_returned' :
        (reliableSession.current?.peerActivity ?? 0) !== startPeerActivity ? 'peer_protocol_activity' : 'session_changed')
  }, [connection, connectedPeerPresent, presenceHealthy, peerProtocolActivity, isPresenceHealthy, isSelfPresent, getPresenceEvidence, clearDisconnectionTimer, interruptConnection])

  const beginConnection = useCallback((otherSelfId: string, requestId: string) => {
    if (activeConnection.current || interruptedSession.current || cancelledRequestIds.current.has(requestId)) return

    sessionLog('session reset for new connection', { selfId: shortSessionId(selfId), peerId: shortSessionId(otherSelfId), requestId: shortSessionId(requestId) })

    clearDisconnectionTimer()
    clearTemporaryResultTimer()
    if (connectionTransition.current !== null) clearTimeout(connectionTransition.current)
    connectionTransition.current = null
    setInterruptedRequestId(null)

    clearRequestTimer(pendingRequest.current)
    pendingRequest.current = null

    const nextConnection: Connection = { connected: true, otherSelfId, requestId }
    consumedProtocolTransitions.current.clear()
    dispatchBreathing({ type: 'reset', requestId })
    dispatchDeepBreathing({ type: 'reset', requestId })
    dispatchAlternating({ type: 'reset', requestId, selfId, otherSelfId })
    dispatchNumber({ type: 'reset', requestId })
    applyColorChoice({ type: 'reset', requestId })
    dispatchFinalPresence({ type: 'reset', requestId })
    dispatchGuided({ type: 'reset', requestId, selfId, otherSelfId })
    guidedLive.current = guidedReducer(initialGuidedState, { type: 'reset', requestId, selfId, otherSelfId })
    applyRating({ type: 'reset', requestId })
    applyPostSession({ type: 'reset', requestId })
    setSessionIntroduction({ requestId, dismissed: false })

    numberSent.current = { requestId, ready: false, choices: new Set(), pairReady: new Set() }
    finalPresenceSent.current = { requestId, ready: false }
    guidedPresenceSent.current = null
    guidedReadySent.current = null
    guidedFinalSent.current = null
    alternatingSent.current = { requestId, turns: new Set(), complete: false, ready: false }
    deepBreathingSent.current = { requestId, ready: false, complete: false }
    deepBreathingReceived.current = { requestId, order: 0, ended: false }

    setBreathingCompletionShownFor(null)
    setExerciseRequestId(null)
    setExerciseCompletion({ requestId, otherExerciseComplete: false })
    completionSentFor.current = null
    readySentFor.current = null
    setReadiness({ requestId, localReady: false, otherReady: false })

    activeConnection.current = nextConnection
    setPeerProtocolActivity(0)
    reliableSession.current?.start({ requestId, selfId, otherSelfId })
    setConnection(nextConnection)
    setSearching(false)
    setSearchOpen(false)
    setIncomingRequest(null)
    setSelectedSelfId(null)
    setNoOtherSelf(false)
    setConnectionEstablished(true)

    connectionTransition.current = setTimeout(() => {
      if (activeConnection.current !== nextConnection) return
      connectionTransition.current = null
      setConnectionEstablished(null)
      setSubject(null)
      setLanguageOpen(false)
      setConnectionExperience(true)
      main.current?.focus({ preventScroll: true })
    }, 1_200)
  }, [selfId, clearDisconnectionTimer, clearTemporaryResultTimer, applyRating, applyPostSession, applyColorChoice])

  useEffect(() => {
    const protocol = new ReliableSession({
      send: payload => channel.send({ type: 'broadcast', event: 'session_protocol', payload }),
      connected: () => channel.socket.isConnected(),
      changed: () => setProtocolRevision(revision => revision + 1),
      peerActivity: revision => setPeerProtocolActivity(revision),
      log: sessionLog,
    })
    reliableSession.current = protocol
    const channel = supabase
      .channel('system-self-matching')
      .on('broadcast', { event: 'session_protocol' }, ({ payload }) => protocol.receive(payload))
      .on('broadcast', { event: 'connection_request' }, ({ payload }) => {
        if (participationRequiresComputer) return
        if (scheduledMode.current || activeConnection.current || interruptedSession.current || cancelledRequestIds.current.has(payload?.requestId)) return
        if (
          payload?.type === 'connection_request' &&
          payload.to === selfId &&
          typeof payload.from === 'string' &&
          typeof payload.requestId === 'string'
        ) {
          if (pendingRequest.current?.requestId === payload.requestId) return
          clearRequestTimer(pendingRequest.current)

          const request: PendingRequest = {
            requestId: payload.requestId,
            peerId: payload.from,
            direction: 'incoming',
            expiresAt: Date.now() + requestTimeoutMs,
          }

          pendingRequest.current = request
          clearTemporaryResultTimer()
          setSearching(false)
          setNoOtherSelf(false)
          setConnectionEstablished(null)
          setIncomingRequest({ from: payload.from, requestId: payload.requestId })

          request.timer = setTimeout(() => {
            if (pendingRequest.current !== request) return
            pendingRequest.current = null
            setIncomingRequest(null)
            showTemporaryResult('failed')
            void sendConnectionResponse(channel, selfId, request, false)
          }, requestTimeoutMs)
        }
      })
      .on('broadcast', { event: 'connection_response' }, ({ payload }) => {
        const request = pendingRequest.current
        if (
          payload?.type === 'connection_response' &&
          payload.to === selfId &&
          typeof payload.accepted === 'boolean' &&
          request?.direction === 'outgoing' &&
          payload.from === request.peerId &&
          payload.requestId === request.requestId
        ) {
          clearRequestTimer(request)
          pendingRequest.current = null
          setSearching(false)

          const accepted =
            request.expiresAt !== undefined && Date.now() >= request.expiresAt ? false : payload.accepted

          if (accepted) {
            void establishPublicConnection(supabase, request.requestId, selfId, publicCredential)
              .then(() => beginConnection(request.peerId, request.requestId))
              .catch(error => {
                console.error('Accepted connection could not be established:', error)
                showTemporaryResult('failed')
              })
          } else showTemporaryResult('failed')
        }
      })
      .on('broadcast', { event: 'breathing_feedback' }, ({ payload }) => {
        const current = activeConnection.current
        const state = deepBreathingLive.current
        if (!current || !deepBreathingScreenActive.current || !sessionInterruptEligible.current || interruptedSession.current ||
          cancelledRequestIds.current.has(current.requestId) ||
          payload?.type !== 'breathing_feedback' || payload.exercise !== 'deep_breathing_10' ||
          payload.to !== selfId || payload.from !== current.otherSelfId || payload.requestId !== current.requestId ||
          !Number.isInteger(payload.breath) || payload.breath < 1 || payload.breath > peerFeedbackBreathCount ||
          (payload.phase !== 'inhale' && payload.phase !== 'exhale') ||
          state.requestId !== current.requestId || !state.enabled || !state.localReady || !state.otherReady ||
          state.phase === 'complete' || state.peerFeedbackEnded) return
        const received = deepBreathingReceived.current
        const order = payload.breath * 2 + (payload.phase === 'exhale' ? 1 : 0)
        if (!received || received.requestId !== current.requestId || received.ended || order <= received.order) return
        received.order = order
        sessionLog(`deep breathing feedback RECEIVE phase=${payload.phase} breath=${payload.breath}`, sessionDiagnostic.current)
        dispatchDeepBreathing({ type: 'peer-feedback', requestId: current.requestId, breath: payload.breath, phase: payload.phase })
        playPeerFeedbackSound(payload.phase)
      })
      .on('broadcast', { event: 'breathing_feedback_end' }, ({ payload }) => {
        const current = activeConnection.current
        const state = deepBreathingLive.current
        if (!current || !deepBreathingScreenActive.current || !sessionInterruptEligible.current || interruptedSession.current ||
          cancelledRequestIds.current.has(current.requestId) ||
          payload?.type !== 'breathing_feedback_end' || payload.exercise !== 'deep_breathing_10' ||
          payload.to !== selfId || payload.from !== current.otherSelfId || payload.requestId !== current.requestId ||
          payload.breath !== peerFeedbackBreathCount || state.requestId !== current.requestId ||
          !state.enabled || !state.localReady || !state.otherReady || state.phase === 'complete') return
        const received = deepBreathingReceived.current
        if (!received || received.requestId !== current.requestId || received.ended) return
        received.ended = true
        dispatchDeepBreathing({ type: 'peer-feedback-end', requestId: current.requestId })
      })
      .subscribe(status => {
        if (reliableSession.current === protocol) protocol.setStatus(status)
      })

    matchingChannel.current = channel

    return () => {
      protocol.dispose()
      if (reliableSession.current === protocol) reliableSession.current = null
      if (activeConnection.current) sessionLog('activeConnection cleared reason=matching-subscription-cleanup', sessionDiagnostic.current)
      clearRequestTimer(pendingRequest.current)
      pendingRequest.current = null

      if (connectionTransition.current !== null) clearTimeout(connectionTransition.current)
      connectionTransition.current = null
      clearDisconnectionTimer()
      clearTemporaryResultTimer()

      activeConnection.current = null
      readySentFor.current = null
      completionSentFor.current = null
      alternatingSent.current = null
      deepBreathingSent.current = null
      deepBreathingReceived.current = null
      numberSent.current = null
      finalPresenceSent.current = null
      guidedPresenceSent.current = null
      guidedReadySent.current = null
      guidedFinalSent.current = null
      guidedLive.current = initialGuidedState
      matchingChannel.current = null

      void supabase.removeChannel(channel)
    }
  }, [selfId, publicCredential, beginConnection, clearDisconnectionTimer, clearTemporaryResultTimer, showTemporaryResult, participationRequiresComputer])

  useEffect(() => {
    const token = invitationToken.current
    if (page !== '/session' || !token || participationRequiresComputer || activeConnection.current) return
    scheduledMode.current = true
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      try {
        await ensurePublicIdentity()
        const result = await enterScheduledConnection(supabase, selfId, token)
        if (cancelled) return
        setScheduledEntry(result)
        if (result.status === 'matched' && result.otherSelfId && result.requestId) {
          window.history.replaceState({}, '', '/')
          setPage('/')
          beginConnection(result.otherSelfId, result.requestId)
          return
        }
        if (result.status === 'expired' || result.status === 'late' || result.status === 'invalid') return
        const delay = result.status === 'early' ? 5_000 : 1_500
        timer = setTimeout(poll, delay)
      } catch (error) {
        if (cancelled) return
        console.error('Scheduled connection could not be entered:', error)
        setScheduledEntry({ status: 'invalid' })
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
    }
  }, [page, selfId, beginConnection, ensurePublicIdentity, participationRequiresComputer])

  useEffect(() => {
    const current = activeConnection.current, protocol = reliableSession.current
    if (!current || !protocol || current !== connection) return
    const facts = protocol.peerFacts
    const interruption = facts.find(fact => fact.eventType === 'session_interrupt')
    if (interruption) {
      sessionLog('session_interrupt RECEIVE', { ...sessionDiagnostic.current, reason: interruption.payload.reason, source: 'peer-critical-event' })
      interruptConnection(current, interruption.payload.reason as 'presence' | 'inactivity', 'peer-critical-event', false)
      return
    }
    if (facts.some(f => f.eventType === 'connection_ready') && readiness?.requestId === current.requestId && !readiness.otherReady)
      setReadiness({ ...readiness, otherReady: true })
    if (facts.some(f => f.eventType === 'exercise_complete' && f.payload.exercise === 'breathing_478') &&
      exerciseCompletion?.requestId === current.requestId && !exerciseCompletion.otherExerciseComplete)
      setExerciseCompletion({ ...exerciseCompletion, otherExerciseComplete: true })
    const reconcilableFacts = facts.filter(fact => !consumedProtocolTransitions.current.has(factKey(fact)))
    const { actions, acceptedTransitions, rejectedTransitions } = reconcileProtocol({ deepBreathing, alternating, number, colorChoice, finalPresence, guided, rating, postSession }, reconcilableFacts,
      current.requestId, performance.now(), Date.now())
    acceptedTransitions.forEach(key => {
      consumedProtocolTransitions.current.add(key)
      protocol.acceptPeerFact(key)
    })
    rejectedTransitions.forEach(key => protocol.rejectPeerFact(key))
    if (rejectedTransitions.length) sessionLog('PROTOCOL RECONCILIATION REJECTED', {
      ...sessionDiagnostic.current, transitions: rejectedTransitions,
    })
    actions.deepBreathing.forEach(dispatchDeepBreathing)
    actions.alternating.forEach(dispatchAlternating)
    actions.number.forEach(dispatchNumber)
    actions.colorChoice.forEach(applyColorChoice)
    actions.finalPresence.forEach(dispatchFinalPresence)
    actions.guided.forEach(applyGuided)
    actions.rating.forEach(applyRating)
    actions.postSession.forEach(applyPostSession)
    if (postSession.handleSent && protocol.hasAcknowledged('post_session_handle'))
      applyPostSession({ type: 'peer-ack', requestId: current.requestId })
    sendHandleIfMutual(current)
    const stage = postSession.entered ? 9 : rating.stage === 'rating' ? 8 : colorChoice.enabled ? 7 :
      number.enabled ? 6 : guided.phase !== 'intro' ? 5 : alternating.localReady ? 4 : deepBreathing.enabled ? 3 :
      guided.localPresenceComplete && guided.otherPresenceComplete ? 2 : finalPresence.enabled ? 1 : 0
    protocol.setStage(stage)
    // The lower SELF ID sets one wall-clock epoch, after the peer has ACKed its
    // readiness. Both clients convert that same epoch to their monotonic clock.
    if (finalPresence.localReady && finalPresence.otherReady && selfId.localeCompare(current.otherSelfId) < 0 &&
      protocol.hasAcknowledged('exercise_ready:final_presence') && !protocol.hasFact('presence_start:final_presence')) {
      protocol.commit({ eventType: 'presence_start', payload: { exercise: 'final_presence', epoch: Date.now() } })
    }
    const start = protocol.ownFacts.find(fact => fact.eventType === 'presence_start')
    if (start && finalPresence.localReady && finalPresence.otherReady && finalPresence.bothReadyAt === null)
      dispatchFinalPresence({ type: 'start', requestId: current.requestId, epoch: Number(start.payload.epoch), at: performance.now() + Number(start.payload.epoch) - Date.now() })
  }, [protocolRevision, connection, readiness, exerciseCompletion, deepBreathing, alternating, number, colorChoice, finalPresence,
    guided, rating, postSession, exerciseRequestId, selfId, interruptConnection, applyColorChoice, applyGuided, applyRating, applyPostSession, sendHandleIfMutual])

  useEffect(() => {
    if (!experienceStarted || !connectionExperience || !connection) return
    const current = connection

    const timer = setTimeout(() => {
      if (activeConnection.current === current) setExerciseRequestId(current.requestId)
    }, 1_200)

    return () => clearTimeout(timer)
  }, [experienceStarted, connectionExperience, connection])

  useEffect(() => {
    const current = activeConnection.current
    const channel = matchingChannel.current

    if (!localExerciseComplete || !current || !channel || completionSentFor.current === current.requestId) return

    dispatchAlternating({ type: 'local-1a-complete', requestId: current.requestId })
    completionSentFor.current = current.requestId

    void sendSessionMessage({
        type: 'broadcast',
        event: 'exercise_complete',
        payload: {
          type: 'exercise_complete',
          exercise: 'breathing_478',
          from: selfId,
          to: current.otherSelfId,
          requestId: current.requestId,
        },
      })
      .then(status => {
        if (status !== 'ok') console.error('Exercise completion could not be sent:', status)
      })
      .catch(error => console.error('Exercise completion could not be sent:', error))
  }, [localExerciseComplete, selfId, sendSessionMessage])

  useEffect(() => {
    if (!localExerciseComplete || !connection) return
    const current = connection

    const timer = setTimeout(() => {
      if (activeConnection.current === current) setBreathingCompletionShownFor(current.requestId)
    }, 1_200)

    return () => clearTimeout(timer)
  }, [localExerciseComplete, connection])

  useEffect(() => {
    if (
      connection && localExerciseComplete &&
      exerciseCompletion?.requestId === connection.requestId && exerciseCompletion.otherExerciseComplete
    ) {
      dispatchDeepBreathing({ type: 'enable', requestId: connection.requestId })
    }
  }, [connection, localExerciseComplete, exerciseCompletion])

  useEffect(() => {
    const current = activeConnection.current
    const channel = matchingChannel.current
    const sent = deepBreathingSent.current
    if (!current || !channel || !sent || sent.requestId !== current.requestId || deepBreathing.requestId !== current.requestId || deepBreathing.phase !== 'complete' || sent.complete) return
    sent.complete = true
    void sendSessionMessage({
      type: 'broadcast', event: 'exercise_complete',
      payload: { type: 'exercise_complete', exercise: 'deep_breathing_10', from: selfId, to: current.otherSelfId, requestId: current.requestId },
    }).then(status => {
      if (status !== 'ok') console.error('Exercise completion could not be sent:', status)
    }).catch(error => console.error('Exercise completion could not be sent:', error))
  }, [deepBreathing.requestId, deepBreathing.phase, selfId, sendSessionMessage])

  useEffect(() => {
    const current = activeConnection.current
    const channel = matchingChannel.current
    const sent = alternatingSent.current

    if (
      !current ||
      !channel ||
      !sent ||
      sent.requestId !== current.requestId ||
      alternating.requestId !== current.requestId
    ) return

    const turnNumber = alternating.lastCompletedTurn

    if (turnNumber !== null && !sent.turns.has(turnNumber)) {
      sent.turns.add(turnNumber)

      void sendSessionMessage({
          type: 'broadcast',
          event: 'breathing_turn',
          payload: {
            type: 'breathing_turn',
            exercise: 'breathing_alternating',
            from: selfId,
            to: current.otherSelfId,
            requestId: current.requestId,
            turnNumber,
          },
        })
        .then(status => {
          if (status !== 'ok') console.error('Breathing turn could not be sent:', status)
        })
        .catch(error => console.error('Breathing turn could not be sent:', error))
    }

    if (alternating.localExerciseComplete && !sent.complete) {
      sent.complete = true

      void sendSessionMessage({
          type: 'broadcast',
          event: 'exercise_complete',
          payload: {
            type: 'exercise_complete',
            exercise: 'breathing_alternating',
            from: selfId,
            to: current.otherSelfId,
            requestId: current.requestId,
          },
        })
        .then(status => {
          if (status !== 'ok') console.error('Exercise completion could not be sent:', status)
        })
        .catch(error => console.error('Exercise completion could not be sent:', error))
    }
  }, [alternating.requestId, alternating.lastCompletedTurn, alternating.localExerciseComplete, selfId, sendSessionMessage])

  useEffect(() => {
    if (connection && guided.requestId === connection.requestId && guided.phase === 'complete') {
      dispatchNumber({ type: 'enable', requestId: connection.requestId })
    }
  }, [connection, guided.requestId, guided.phase])

  useEffect(() => {
    if (connection && number.requestId === connection.requestId && number.phase === 'complete')
      applyColorChoice({ type: 'enable', requestId: connection.requestId })
  }, [connection, number.requestId, number.phase, applyColorChoice])

  useEffect(() => {
    const current = activeConnection.current
    const channel = matchingChannel.current
    const sent = numberSent.current
    if (current === null) return
    if (channel === null) return
    if (sent === null) return
    const requestId = current.requestId
    const otherSelfId = current.otherSelfId
    if (sent.requestId !== requestId || number.requestId !== requestId) return
    if (!number.enabled || !number.localReady || !number.otherReady) return
    const attempt = currentNumberAttempt(number)
    const key = `${number.round}:${number.attempt}`
    if (attempt.localChoice !== null && !sent.choices.has(key)) {
      sent.choices.add(key)
      void sendSessionMessage({ type: 'broadcast', event: 'number_choice', payload: {
        type: 'number_choice', exercise: 'number', from: selfId, to: otherSelfId,
        requestId, round: number.round, attempt: number.attempt, number: attempt.localChoice,
      } }).then(status => {
        if (status !== 'ok') console.error('Number choice could not be sent:', status)
      }).catch(error => console.error('Number choice could not be sent:', error))
    }
    if (attempt.localChoice !== null && attempt.otherChoice !== null && !sent.pairReady.has(key)) {
      sent.pairReady.add(key)
      dispatchNumber({ type: 'local-pair-ready', requestId, round: number.round, attempt: number.attempt, at: performance.now() })
      void sendSessionMessage({ type: 'broadcast', event: 'number_pair_ready', payload: {
        type: 'number_pair_ready', exercise: 'number', from: selfId, to: otherSelfId,
        requestId, round: number.round, attempt: number.attempt,
      } }).then(status => {
        if (status !== 'ok') console.error('Number reveal synchronization could not be sent:', status)
      }).catch(error => console.error('Number reveal synchronization could not be sent:', error))
    }
  }, [number, selfId, sendSessionMessage])

  useEffect(() => {
    if (['/reserve', '/participate'].includes(window.location.pathname.replace(/\/$/, ''))) {
      window.history.replaceState(null, '', '/')
    }

    const onPopState = () => {
      const destination = readPage()
      const token = tokenFromPath(window.location.pathname)
      invitationToken.current = token
      scheduledMode.current = token !== null
      if (activeConnection.current && destination !== '/') sessionLog('HOME RESET reason=popstate', { ...sessionDiagnostic.current, destination })
      routeChanged.current = true
      setPage(destination)
      setLanguageOpen(false)
      setSearchOpen(false)
      setSubject(null)
      setParticipationBlockReason(null)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    const title =
      page === '/about'
        ? t.about
        : page === '/privacy'
          ? t.privacy
          : page === '/participate'
            ? t.heading
            : page === '/system-log'
              ? t.systemLog.title
            : page === '/session'
              ? t.next
            : ''

    document.title = title ? `${title} — SYSTEM SELF` : 'SYSTEM SELF'
  }, [language, page, t])

  useEffect(() => {
    if (routeChanged.current) {
      main.current?.focus({ preventScroll: true })
      window.scrollTo(0, 0)
      routeChanged.current = false
    }
  }, [page])

  useEffect(() => {
    if (!languageOpen) return

    const outside = (event: PointerEvent) => {
      if (!languageControl.current?.contains(event.target as Node)) setLanguageOpen(false)
    }

    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation()
        setLanguageOpen(false)
        languageButton.current?.focus()
      }
    }

    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)

    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape, true)
    }
  }, [languageOpen])

  function openScheduledRegistration(slotAt: string) {
    if (participationRequiresComputer) {
      setParticipationBlockReason('scheduled')
      return
    }
    if (scheduledRegistrationPending) return
    if (scheduledRegistration) {
      setScheduledConfirmationOpen(true)
      return
    }
    setScheduledRegistrationSlot(slotAt)
    setScheduledGender('')
    setScheduledCountry('')
    setScheduledRegistrationError(false)
  }

  async function joinNextSession(slotAt: string, gender: ScheduledGender, countryCode: string) {
    if (participationRequiresComputer) {
      setScheduledRegistrationSlot(null)
      setParticipationBlockReason('scheduled')
      return
    }
    if (scheduledRegistrationPending || scheduledRegistration) return
    setScheduledRegistrationPending(true)
    setScheduledRegistrationError(false)
    try {
      await ensurePublicIdentity()
      const registration = await registerForScheduledConnection(
        supabase,
        resilientLocalStorage,
        selfId,
        slotAt,
        gender,
        countryCode,
        publicCredential,
      )
      setScheduledRegistration(registration)
      setScheduledConfirmationOpen(true)
      setScheduledRegistrationSlot(null)
      setLinkCopied(false)
    } catch (error) {
      console.error('Scheduled registration failed:', error)
      setScheduledRegistrationError(true)
    } finally {
      setScheduledRegistrationPending(false)
    }
  }

  async function copyScheduledLink() {
    if (!scheduledRegistration) return
    try {
      const copied = await copyInvitationLink(invitationUrl(scheduledRegistration.token))
      setLinkCopied(copied)
    } catch (error) {
      console.error('Invitation link could not be copied:', error)
      setLinkCopied(false)
    }
  }

  async function searchForConnection() {
    if (participationRequiresComputer) {
      setParticipationBlockReason('spontaneous')
      return
    }
    if (activeConnection.current || interruptedSession.current || searching || incomingRequest) return

    clearTemporaryResultTimer()
    setSearchOpen(false)
    setConnectionEstablished(null)
    setNoOtherSelf(false)

    if (otherSelfIds.length === 0) {
      setSelectedSelfId(null)
      setSearching(false)
      showTemporaryResult('no-other')
      return
    }

    const selectedSelfId = otherSelfIds[Math.floor(Math.random() * otherSelfIds.length)]
    setSelectedSelfId(selectedSelfId)

    const channel = matchingChannel.current
    if (!channel) {
      showTemporaryResult('failed')
      return
    }

    const request: PendingRequest = {
      requestId: crypto.randomUUID(),
      peerId: selectedSelfId,
      direction: 'outgoing',
    }

    pendingRequest.current = request
    setSearching(true)

    try {
      await ensurePublicIdentity()
      await createPublicConnectionRequest(
        supabase,
        request.requestId,
        selfId,
        publicCredential,
        selectedSelfId,
      )
      const status = await sendSessionMessage({
        type: 'broadcast',
        event: 'connection_request',
        payload: {
          type: 'connection_request',
          from: selfId,
          to: selectedSelfId,
          requestId: request.requestId,
        },
      })

      if (pendingRequest.current !== request) return

      if (status === 'ok') {
        request.expiresAt = Date.now() + requestTimeoutMs
        request.timer = setTimeout(() => {
          if (pendingRequest.current !== request) return
          pendingRequest.current = null
          setSearching(false)
          showTemporaryResult('failed')
        }, requestTimeoutMs)
      } else {
        pendingRequest.current = null
        setSearching(false)
        showTemporaryResult('failed')
      }
    } catch (error) {
      if (pendingRequest.current !== request) return
      pendingRequest.current = null
      setSearching(false)
      showTemporaryResult('failed')
      console.error('Connection request could not be sent:', error)
    }
  }

  async function respondToConnection(accepted: boolean) {
    const request = pendingRequest.current
    const channel = matchingChannel.current

    if (
      !request ||
      request.direction !== 'incoming' ||
      request.requestId !== incomingRequest?.requestId ||
      !channel
    ) return

    clearRequestTimer(request)

    const responseAccepted =
      request.expiresAt !== undefined && Date.now() >= request.expiresAt ? false : accepted

    try {
      if (responseAccepted || !accepted) {
        await respondToPublicConnectionRequest(
          supabase,
          request.requestId,
          selfId,
          publicCredential,
          responseAccepted,
        )
      }
    } catch (error) {
      console.error('Connection response could not be recorded:', error)
      if (pendingRequest.current === request) pendingRequest.current = null
      setIncomingRequest(null)
      setSearching(false)
      showTemporaryResult('failed')
      return
    }

    setIncomingRequest(null)
    setSearching(false)
    if (responseAccepted) {
      clearTemporaryResultTimer()
      setConnectionEstablished(true)
    } else showTemporaryResult('failed')

    await sendConnectionResponse(channel, selfId, request, responseAccepted)

    if (pendingRequest.current !== request) return
    pendingRequest.current = null
    if (responseAccepted) beginConnection(request.peerId, request.requestId)
  }

  function returnFromInterruption() {
    sessionLog('HOME RESET reason=return-from-interruption', sessionDiagnostic.current)
    reliableSession.current?.complete()
    clearDisconnectionTimer()
    interruptedSession.current = null
    scheduledMode.current = false
    invitationToken.current = null
    setInterruptedRequestId(null)
    go('/')
    main.current?.focus({ preventScroll: true })
  }

  function go(destination: Page) {
    if (page === destination) return

    if (activeConnection.current) sessionLog('HOME RESET reason=navigation', { ...sessionDiagnostic.current, destination })

    window.history.pushState(null, '', destination)
    routeChanged.current = true
    setPage(destination)
    setLanguageOpen(false)
    setSearchOpen(false)
    setSubject(null)
    setParticipationBlockReason(null)
  }

  async function markReady() {
    const current = activeConnection.current
    const channel = matchingChannel.current

    if (!current || !channel || !connectionExperience || readySentFor.current === current.requestId) return

    readySentFor.current = current.requestId
    setReadiness(previous =>
      previous?.requestId === current.requestId ? { ...previous, localReady: true } : previous,
    )

    try {
      const status = await sendSessionMessage({
        type: 'broadcast',
        event: 'connection_ready',
        payload: {
          type: 'connection_ready',
          from: selfId,
          to: current.otherSelfId,
          requestId: current.requestId,
        },
      })

      if (status !== 'ok') console.error('Connection readiness could not be sent:', status)
    } catch (error) {
      console.error('Connection readiness could not be sent:', error)
    }
  }

  async function markAlternatingReady() {
    const current = activeConnection.current
    const channel = matchingChannel.current
    const sent = alternatingSent.current

    if (
      !current ||
      !channel ||
      !sent ||
      sent.requestId !== current.requestId ||
      sent.ready ||
      !deepBreathingComplete ||
      alternating.requestId !== current.requestId ||
      !alternating.local1AComplete ||
      !alternating.other1AComplete
    ) return

    sent.ready = true
    dispatchAlternating({ type: 'local-ready', requestId: current.requestId })

    try {
      const status = await sendSessionMessage({
        type: 'broadcast',
        event: 'exercise_ready',
        payload: {
          type: 'exercise_ready',
          exercise: 'breathing_alternating',
          from: selfId,
          to: current.otherSelfId,
          requestId: current.requestId,
        },
      })

      if (status !== 'ok') console.error('Exercise readiness could not be sent:', status)
    } catch (error) {
      console.error('Exercise readiness could not be sent:', error)
    }
  }

  async function markDeepBreathingReady() {
    const current = activeConnection.current
    const channel = matchingChannel.current
    const sent = deepBreathingSent.current
    if (
      !current || !channel || !sent || sent.requestId !== current.requestId || sent.ready ||
      breathingCompletionShownFor !== current.requestId ||
      !deepBreathing.enabled || deepBreathing.requestId !== current.requestId
    ) return
    sent.ready = true
    dispatchDeepBreathing({ type: 'local-ready', requestId: current.requestId })
    try {
      const status = await sendSessionMessage({
        type: 'broadcast', event: 'exercise_ready',
        payload: { type: 'exercise_ready', exercise: 'deep_breathing_10', from: selfId, to: current.otherSelfId, requestId: current.requestId },
      })
      if (status !== 'ok') console.error('Exercise readiness could not be sent:', status)
    } catch (error) {
      console.error('Exercise readiness could not be sent:', error)
    }
  }

  function sendDeepBreathingFeedback(phase: PeerBreathingPhase, breath: number) {
    const current = activeConnection.current
    const channel = matchingChannel.current
    const state = deepBreathingLive.current
    if (!current || !channel || !sessionInterruptEligible.current || interruptedSession.current ||
      cancelledRequestIds.current.has(current.requestId) || state.requestId !== current.requestId ||
      !state.enabled || !state.localReady || !state.otherReady || state.phase === 'complete' ||
      breath !== state.breaths.length + 1 || breath < 1 || breath > peerFeedbackBreathCount ||
      (phase === 'inhale' && (state.phase !== 'inhale' || state.current !== null)) ||
      (phase === 'exhale' && (state.phase !== 'exhale' || state.current?.inhaleCompletedAt === undefined || state.current.exhaleStartedAt !== undefined))) return
    sessionLog(`deep breathing feedback SEND phase=${phase} breath=${breath}`, sessionDiagnostic.current)
    void sendSessionMessage({ type: 'broadcast', event: 'breathing_feedback', payload: {
      type: 'breathing_feedback', exercise: 'deep_breathing_10', phase, breath,
      from: selfId, to: current.otherSelfId, requestId: current.requestId,
    } }).then(status => {
      if (status !== 'ok') console.error('Deep breathing feedback could not be sent:', status)
    }).catch(error => console.error('Deep breathing feedback could not be sent:', error))
  }

  function endDeepBreathingFeedback() {
    const current = activeConnection.current
    const channel = matchingChannel.current
    const state = deepBreathingLive.current
    if (!current || !channel || !sessionInterruptEligible.current || interruptedSession.current ||
      cancelledRequestIds.current.has(current.requestId) || state.requestId !== current.requestId ||
      state.breaths.length + 1 !== peerFeedbackBreathCount || state.phase !== 'exhale' ||
      state.current?.exhaleStartedAt === undefined) return
    void sendSessionMessage({ type: 'broadcast', event: 'breathing_feedback_end', payload: {
      type: 'breathing_feedback_end', exercise: 'deep_breathing_10', breath: peerFeedbackBreathCount,
      from: selfId, to: current.otherSelfId, requestId: current.requestId,
    } }).then(status => {
      if (status !== 'ok') console.error('Deep breathing feedback end could not be sent:', status)
    }).catch(error => console.error('Deep breathing feedback end could not be sent:', error))
  }

  async function markNumberReady() {
    const current = activeConnection.current
    const channel = matchingChannel.current
    const sent = numberSent.current
    if (!current || !channel || !sent || sent.requestId !== current.requestId || sent.ready ||
      number.requestId !== current.requestId || !number.enabled || guidedLive.current.phase !== 'complete') return
    sent.ready = true
    dispatchNumber({ type: 'local-ready', requestId: current.requestId })
    try {
      const status = await sendSessionMessage({ type: 'broadcast', event: 'exercise_ready', payload: {
        type: 'exercise_ready', exercise: 'number', from: selfId, to: current.otherSelfId, requestId: current.requestId,
      } })
      if (status !== 'ok') console.error('Number readiness could not be sent:', status)
    } catch (error) { console.error('Number readiness could not be sent:', error) }
  }

  async function markFinalPresenceReady() {
    const current = activeConnection.current
    const channel = matchingChannel.current
    const sent = finalPresenceSent.current
    if (!current || !channel || !sent || sent.requestId !== current.requestId || sent.ready ||
      finalPresence.requestId !== current.requestId || !finalPresence.enabled || finalPresence.phase !== 'ready') return
    sent.ready = true
    dispatchFinalPresence({ type: 'local-ready', requestId: current.requestId, at: performance.now() })
    try {
      const status = await sendSessionMessage({ type: 'broadcast', event: 'exercise_ready', payload: {
        type: 'exercise_ready', exercise: 'final_presence', from: selfId, to: current.otherSelfId,
        requestId: current.requestId,
      } })
      if (status !== 'ok') console.error('Final presence readiness could not be sent:', status)
    } catch (error) { console.error('Final presence readiness could not be sent:', error) }
  }

  const markFinalPresenceComplete = useCallback(() => {
    const current = activeConnection.current
    const channel = matchingChannel.current
    if (!current || !channel || !sessionInterruptEligible.current || guidedPresenceSent.current === current.requestId ||
      cancelledRequestIds.current.has(current.requestId)) return
    guidedPresenceSent.current = current.requestId
    applyGuided({ type: 'local-presence-complete', requestId: current.requestId })
    experimentalData.recordExerciseCompletion(current.requestId, selfId, 'presence')
    void sendSessionMessage({ type: 'broadcast', event: 'exercise_complete', payload: {
      type: 'exercise_complete', exercise: 'final_presence', from: selfId, to: current.otherSelfId, requestId: current.requestId,
    } }).then(status => { if (status !== 'ok') console.error('Presence completion could not be sent:', status) })
      .catch(error => console.error('Presence completion could not be sent:', error))
  }, [selfId, applyGuided, sendSessionMessage])

  function beginGuided() {
    const current = activeConnection.current
    if (current && sessionInterruptEligible.current && alternatingComplete && guidedLive.current.requestId === current.requestId)
      applyGuided({ type: 'begin', requestId: current.requestId })
  }

  function markGuidedReady() {
    const current = activeConnection.current
    const channel = matchingChannel.current
    const state = guidedLive.current
    if (!current || !channel || !sessionInterruptEligible.current || state.requestId !== current.requestId ||
      state.phase !== 'ready' || guidedReadySent.current === `${current.requestId}:${state.round}`) return
    guidedReadySent.current = `${current.requestId}:${state.round}`
    applyGuided({ type: 'local-ready', requestId: current.requestId, round: state.round })
    sessionLog('guided breathing READY', { ...sessionDiagnostic.current, round: state.round, from: 'local' })
    void sendSessionMessage({ type: 'broadcast', event: 'exercise_ready', payload: {
      type: 'exercise_ready', exercise: 'guided_breathing', round: state.round, from: selfId,
      to: current.otherSelfId, requestId: current.requestId,
    } }).then(status => { if (status !== 'ok') console.error('Guided readiness could not be sent:', status) })
      .catch(error => console.error('Guided readiness could not be sent:', error))
  }

  function sendGuidedCommand(command: GuidedCommand, release = false) {
    const current = activeConnection.current
    const channel = matchingChannel.current
    const state = guidedLive.current
    if (!current || !channel || !sessionInterruptEligible.current || state.requestId !== current.requestId ||
      !isLocalGuide(state) || cancelledRequestIds.current.has(current.requestId)) return
    const breath = state.breaths.filter(item => item.exhaleReleaseAt !== undefined).length + 1
    const round = state.round
    const action: GuidedAction = { type: release ? 'release' : 'command', requestId: current.requestId, round, breath, command, at: performance.now() }
    if (guidedReducer(state, action) === state) return
    applyGuided(action)
    sessionLog(`guided breathing command SEND ${command}`, { ...sessionDiagnostic.current, round, breath })
    if (command === 'exhale' && release) {
      sessionLog(`guided breathing breath COMPLETE ${breath}/5`, sessionDiagnostic.current)
      if (breath === 5) {
        sessionLog(round === 1 ? 'guided breathing ROUND COMPLETE; ROLE REVERSE' : 'guided breathing ROUND COMPLETE', sessionDiagnostic.current)
        if (round === 1) sessionLog('guided breathing Round 2 roles', { guide: shortSessionId(current.otherSelfId), breather: shortSessionId(selfId) })
      }
    }
    void sendSessionMessage({ type: 'broadcast', event: 'guided_breathing_command', payload: {
      type: 'guided_breathing_command', exercise: 'guided_breathing', round, breath, command,
      ...(release ? { release: true } : {}),
      from: selfId, to: current.otherSelfId, requestId: current.requestId,
    } }).then(status => { if (status !== 'ok') console.error('Guided command could not be sent:', status) })
      .catch(error => console.error('Guided command could not be sent:', error))
  }

  function markGuidedFinal() {
    const current = activeConnection.current
    const channel = matchingChannel.current
    if (!current || !channel || !sessionInterruptEligible.current || guidedLive.current.phase !== 'final' ||
      guidedLive.current.requestId !== current.requestId || guidedFinalSent.current === current.requestId) return
    guidedFinalSent.current = current.requestId
    applyGuided({ type: 'local-final', requestId: current.requestId })
    sessionLog('guided breathing final confirmation SEND', sessionDiagnostic.current)
    if (guidedLive.current.localFinal && guidedLive.current.otherFinal) sessionLog('guided breathing CONNECTION COMPLETE', sessionDiagnostic.current)
    void sendSessionMessage({ type: 'broadcast', event: 'guided_breathing_final', payload: {
      type: 'guided_breathing_final', exercise: 'guided_breathing', from: selfId,
      to: current.otherSelfId, requestId: current.requestId,
    } }).then(status => { if (status !== 'ok') console.error('Guided completion could not be sent:', status) })
      .catch(error => console.error('Guided completion could not be sent:', error))
  }

  function continueSessionIntroduction() {
    const current = activeConnection.current
    if (!current || !sessionInterruptEligible.current || !experienceStarted ||
      sessionIntroduction?.requestId !== current.requestId || sessionIntroduction.dismissed) return
    dispatchFinalPresence({ type: 'enable', requestId: current.requestId })
    setSessionIntroduction({ requestId: current.requestId, dismissed: true })
    sessionLog('connection session introduction CONTINUE', sessionDiagnostic.current)
  }

  function commitColor(event: 'color_choice' | 'color_guess', color: ColorChoice) {
    const current = activeConnection.current
    const channel = matchingChannel.current
    const state = colorChoiceLive.current
    const action: ColorChoiceAction = event === 'color_choice'
      ? { type: 'local-own', requestId: current?.requestId ?? '', color }
      : { type: 'local-guess', requestId: current?.requestId ?? '', color }
    if (!current || !channel || !sessionInterruptEligible.current || state.requestId !== current.requestId ||
      !state.enabled || (event === 'color_choice' ? state.phase !== 'own' : state.phase !== 'guess') ||
      !applyColorChoice(action)) return
    sessionLog(`${event} SEND`, sessionDiagnostic.current)
    void sendSessionMessage({ type: 'broadcast', event, payload: {
      type: event, exercise: 'color_choice', color, from: selfId,
      to: current.otherSelfId, requestId: current.requestId,
    } }).then(status => { if (status !== 'ok') console.error('Color commitment could not be sent:', status) })
      .catch(error => console.error('Color commitment could not be sent:', error))
  }

  function beginConnectionRating() {
    const current = activeConnection.current
    if (!current || !sessionInterruptEligible.current || colorChoiceLive.current.requestId !== current.requestId ||
      colorChoiceLive.current.phase !== 'complete') return
    if (applyRating({ type: 'begin', requestId: current.requestId }))
      sessionLog('connection rating BEGIN', sessionDiagnostic.current)
  }

  function selectConnectionRating(value: number) {
    const current = activeConnection.current
    const channel = matchingChannel.current
    if (!current || !channel || !sessionInterruptEligible.current || colorChoiceLive.current.phase !== 'complete') return
    if (!applyRating({ type: 'select', requestId: current.requestId, value, selectedAt: Date.now() })) return
    sessionLog('connection rating completion SEND', sessionDiagnostic.current)
    void sendSessionMessage({ type: 'broadcast', event: 'exercise_complete', payload: {
      type: 'exercise_complete', exercise: 'connection_rating', from: selfId,
      to: current.otherSelfId, requestId: current.requestId,
    } }).then(status => { if (status !== 'ok') console.error('Rating completion could not be sent:', status) })
      .catch(error => console.error('Rating completion could not be sent:', error))
  }

  function continueFromConnectionRating() {
    const current = activeConnection.current
    if (!current || ratingLive.current.requestId !== current.requestId ||
      ratingLive.current.selection === null || !ratingLive.current.otherComplete) return
    if (applyPostSession({ type: 'enter', requestId: current.requestId })) {
      sessionLog('post-session handle stage ENTER', sessionDiagnostic.current)
      sendHandleIfMutual(current)
    }
  }

  function submitHandleDecision(consent: boolean, handle: string | null) {
    const current = activeConnection.current
    const channel = matchingChannel.current
    if (!current || !channel || !sessionInterruptEligible.current ||
      ratingLive.current.requestId !== current.requestId || ratingLive.current.selection === null ||
      !ratingLive.current.otherComplete || postSessionLive.current.requestId !== current.requestId ||
      !postSessionLive.current.entered || (consent && (!handle || normalizeXHandle(handle) !== handle))) return
    if (!applyPostSession({ type: 'local-decision', requestId: current.requestId, consent, handle })) return
    sessionLog('post-session decision SEND', sessionDiagnostic.current)
    void sendSessionMessage({ type: 'broadcast', event: 'post_session_decision', payload: {
      type: 'post_session_decision', from: selfId, to: current.otherSelfId,
      requestId: current.requestId, consent,
    } }).then(status => { if (status !== 'ok') console.error('Post-session decision could not be sent:', status) })
      .catch(error => console.error('Post-session decision could not be sent:', error))
    sendHandleIfMutual(current)
  }

  function continueFromHandleResult() {
    const current = activeConnection.current
    if (!current || postSessionLive.current.requestId !== current.requestId) return
    if (applyPostSession({ type: 'final', requestId: current.requestId })) reliableSession.current?.complete()
  }

  function returnFromCompletedSession() {
    const current = activeConnection.current
    if (!current || postSessionLive.current.requestId !== current.requestId || !postSessionLive.current.final) return
    reliableSession.current?.complete()
    scheduledMode.current = false
    invitationToken.current = null
    activeConnection.current = null
    sessionInterruptEligible.current = false
    cancelledRequestIds.current.add(current.requestId)
    clearDisconnectionTimer()
    clearTemporaryResultTimer()
    clearRequestTimer(pendingRequest.current)
    pendingRequest.current = null
    if (connectionTransition.current !== null) clearTimeout(connectionTransition.current)
    connectionTransition.current = null
    readySentFor.current = null
    completionSentFor.current = null
    alternatingSent.current = null
    deepBreathingSent.current = null
    deepBreathingReceived.current = null
    numberSent.current = null
    finalPresenceSent.current = null
    guidedPresenceSent.current = null
    guidedReadySent.current = null
    guidedFinalSent.current = null
    guidedLive.current = initialGuidedState
    ratingLive.current = initialConnectionRatingState
    postSessionLive.current = initialPostSessionState
    dispatchRating({ type: 'cancel', requestId: current.requestId })
    dispatchPostSession({ type: 'cancel', requestId: current.requestId })
    dispatchBreathing({ type: 'cancel', requestId: current.requestId })
    dispatchDeepBreathing({ type: 'cancel', requestId: current.requestId })
    dispatchAlternating({ type: 'cancel', requestId: current.requestId })
    dispatchNumber({ type: 'cancel', requestId: current.requestId })
    applyColorChoice({ type: 'cancel', requestId: current.requestId })
    dispatchFinalPresence({ type: 'cancel', requestId: current.requestId })
    dispatchGuided({ type: 'cancel', requestId: current.requestId })
    setSessionIntroduction(null)
    setReadiness(null)
    setExerciseRequestId(null)
    setExerciseCompletion(null)
    setBreathingCompletionShownFor(null)
    setConnection(null)
    setConnectionExperience(false)
    setConnectionEstablished(null)
    setIncomingRequest(null)
    setSelectedSelfId(null)
    setSearching(false)
    setSearchOpen(false)
    setNoOtherSelf(false)
    setSubject(null)
    setLanguageOpen(false)
    wasSessionActive.current = false
    sessionLog('HOME RESET reason=completed-session-return', sessionDiagnostic.current)
    main.current?.focus({ preventScroll: true })
  }

  function navigate(event: MouseEvent<HTMLAnchorElement>, destination: Page) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    go(destination)
  }

  function link(destination: Page, children: ReactNode, className = '') {
    return (
      <a className={`quiet-link ${className}`} href={destination} onClick={event => navigate(event, destination)}>
        {children}
      </a>
    )
  }

  function openLayer(next: Subject, event: MouseEvent<HTMLButtonElement>) {
    layerTrigger.current = event.currentTarget
    setSubject(next)
  }

  function closeLayer() {
    setSubject(null)
    layerTrigger.current?.focus({ preventScroll: true })
  }

  function renderAboutParagraph(paragraph: string) {
    const index = paragraph.indexOf(t.register)
    if (index === -1) return paragraph

    return (
      <>
        {paragraph.slice(0, index)}
        {link('/participate', t.register, 'text-participate-link')}
        {paragraph.slice(index + t.register.length)}
      </>
    )
  }

  function renderLanguageControl() {
    return <div className="homepage-settings">
      <div
        className="homepage-languages"
        ref={languageControl}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setLanguageOpen(false)
        }}
      >
        <button
          ref={languageButton}
          className="quiet-link"
          type="button"
          aria-expanded={languageOpen}
          aria-controls="language-options"
          onClick={() => setLanguageOpen(!languageOpen)}
        >
          {t.language}
        </button>
        <div
          id="language-options"
          className={`language-reveal ${languageOpen ? 'is-open' : ''}`}
          inert={!languageOpen}
          aria-hidden={!languageOpen}
        >
          <div className="language-options">
            {(['fr', 'en'] as const).map(option => (
              <button
                key={option}
                type="button"
                className="quiet-link"
                lang={language}
                aria-pressed={language === option}
                onClick={() => {
                  chooseLanguage(option)
                  setLanguageOpen(false)
                  languageButton.current?.focus()
                }}
              >
                {t.languages[option]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  }

  if ((page === '/' || page === '/session') && !entranceWarningOpen && savedLanguage === null) {
    return <LanguageSelection onSelect={chooseLanguage} />
  }

  if (page === '/system-log') {
    return <>
      <div inert={entranceWarningOpen}>
        <SystemLog
          language={language}
          text={t.systemLog}
          currentPublicId={currentPublicId}
          initialPublicId={readSystemLogPublicId()}
          onReturn={event => navigate(event, '/')}
        />
      </div>
      {entranceWarningOpen && <EntranceWarning onAccept={acceptEntranceWarning} />}
    </>
  }

  if (page === '/' && interruptedRequestId !== null) {
    return (
      <main ref={main} tabIndex={-1} className="homepage" inert={entranceWarningOpen}>
        <section className="incoming-request-layer" aria-labelledby="connection-interrupted-title">
          <div className="incoming-request-content">
            <h2 id="connection-interrupted-title" className="bilingual-connection-heading" role="status">
              {bilingualLanguages.map(language =>
                <span key={language} lang={language}>{renderLineBreaks(copy[language].connectionState.interrupted)}</span>,
              )}
            </h2>
            <div className="incoming-request-actions bilingual-begin-actions">
              {bilingualLanguages.map(language =>
                <button key={language} type="button" className="quiet-link" lang={language} onClick={returnFromInterruption}>
                  {copy[language].connectionState.return}
                </button>,
              )}
            </div>
          </div>
        </section>
        {entranceWarningOpen && <EntranceWarning onAccept={acceptEntranceWarning} />}
      </main>
    )
  }

  if (page === '/' && connection?.connected && connectionExperience) {
    return (
      <main ref={main} tabIndex={-1} className="homepage" inert={entranceWarningOpen}>
        {exerciseRequestId !== connection.requestId && <header className={`homepage-header session-language-header ${languageOpen ? 'has-open-menu' : ''}`}>
          {renderLanguageControl()}
        </header>}
        {exerciseRequestId === connection.requestId && exerciseCompletion?.requestId === connection.requestId ? (
          sessionIntroduction?.requestId === connection.requestId && !sessionIntroduction.dismissed ?
            <ConnectionSessionIntroduction language={language} onContinue={continueSessionIntroduction} /> :
          !guided.localPresenceComplete || !guided.otherPresenceComplete ? (
            <FinalPresenceExercise
              key={connection.requestId}
              state={finalPresence}
              dispatch={dispatchFinalPresence}
              requestId={connection.requestId}
              onReady={markFinalPresenceReady}
              onComplete={markFinalPresenceComplete}
              language={language}
            />
          ) : breathingCompletionShownFor !== connection.requestId ||
              deepBreathing.requestId !== connection.requestId || !deepBreathing.enabled ? (
            <BreathingExercise
              key={connection.requestId}
              state={breathing}
              dispatch={dispatchBreathing}
              requestId={connection.requestId}
              language={language}
            />
          ) : !deepBreathingComplete || !alternating.local1AComplete || !alternating.other1AComplete ? (
              <DeepBreathingExercise
                key={connection.requestId}
                state={deepBreathing}
                dispatch={dispatchDeepBreathing}
                requestId={connection.requestId}
                onBegin={markDeepBreathingReady}
                onFeedback={sendDeepBreathingFeedback}
                onFeedbackEnd={endDeepBreathingFeedback}
                language={language}
              />
          ) : !alternatingComplete ? (
            <AlternatingBreathingExercise
              key={connection.requestId}
              state={alternating}
              dispatch={dispatchAlternating}
              requestId={connection.requestId}
              onBegin={markAlternatingReady}
              onSpaceHoldChange={onAlternatingSpaceHoldChange}
              language={language}
            />
          ) : guided.phase !== 'complete' ? (
            <GuidedBreathingExercise
              key={connection.requestId}
              state={guided}
              language={language}
              onBegin={beginGuided}
              onReady={markGuidedReady}
              onCommand={sendGuidedCommand}
              onFinal={markGuidedFinal}
            />
          ) : number.phase !== 'complete' ? (
            <NumberExercise
              key={connection.requestId}
              state={number}
              dispatch={dispatchNumber}
              requestId={connection.requestId}
              onBegin={markNumberReady}
              language={language}
            />
          ) : postSession.entered && postSession.requestId === connection.requestId ? (
            postSession.final ? <ThankYou language={language} onReturn={returnFromCompletedSession} /> :
              <HandleReveal key={connection.requestId} state={postSession} language={language} onDecision={submitHandleDecision} onContinue={continueFromHandleResult} />
          ) : rating.requestId === connection.requestId && rating.stage === 'rating' ? (
            <ConnectionRating state={rating} language={language} onSelect={selectConnectionRating} onContinue={continueFromConnectionRating} />
          ) : (
            <ColorChoiceExercise
              state={colorChoice}
              language={language}
              onChooseOwn={color => commitColor('color_choice', color)}
              onGuess={color => commitColor('color_guess', color)}
              onContinue={beginConnectionRating}
            />
          )
        ) : (
          <section className="incoming-request-layer" aria-labelledby="connection-experience-title">
            <div className="incoming-request-content">
              <BilingualConnectionHeading
                id="connection-experience-title"
                message={experienceStarted ? 'begins' : localReady ? 'waitingOther' : 'connected'}
              />

              {localReady && !otherReady && (
                <div className="searching-ellipsis" aria-hidden="true">
                  .<span>.</span><span>.</span>
                </div>
              )}

              {!localReady && (
                <div className="incoming-request-actions bilingual-begin-actions">
                  {bilingualLanguages.map(language =>
                    <button key={language} type="button" className="quiet-link" lang={language} onClick={markReady}>
                      {copy[language].connectionState.begin}
                    </button>,
                  )}
                </div>
              )}
            </div>
          </section>
        )}
        {entranceWarningOpen && <EntranceWarning onAccept={acceptEntranceWarning} />}
      </main>
    )
  }

  if (page === '/session') {
    if (participationRequiresComputer) {
      return (
        <main ref={main} tabIndex={-1} className="homepage scheduled-invitation-page computer-required-page" inert={entranceWarningOpen}>
          <header className={`homepage-header session-language-header ${languageOpen ? 'has-open-menu' : ''}`}>
            {renderLanguageControl()}
          </header>
          <ComputerRequired
            title={t.computerRequired.title}
            message={t.computerRequired.invitation}
            returnLabel={t.scheduled.returnToSystem}
            onReturn={() => {
              invitationToken.current = null
              scheduledMode.current = false
              go('/')
            }}
          />
          {entranceWarningOpen && <EntranceWarning onAccept={acceptEntranceWarning} />}
        </main>
      )
    }

    const ended = scheduledEntry?.status === 'expired'
    const unavailable = scheduledEntry?.status === 'late'
    const invalid = scheduledEntry?.status === 'invalid'
    const slotAt = scheduledEntry?.slotAt
    const heading = scheduledEntry?.status === 'waiting'
      ? t.scheduled.waiting
      : ended
        ? t.scheduled.ended
        : invalid
          ? t.scheduled.invalid
          : unavailable
            ? t.scheduled.unavailable
            : t.scheduled.opensIn
    return (
      <main ref={main} tabIndex={-1} className="homepage scheduled-invitation-page" inert={entranceWarningOpen}>
        <header className={`homepage-header session-language-header ${languageOpen ? 'has-open-menu' : ''}`}>
          {renderLanguageControl()}
        </header>
        <section className="incoming-request-layer" aria-labelledby="scheduled-invitation-title">
          <div className="incoming-request-content scheduled-invitation-content">
            <h1 id="scheduled-invitation-title">{heading}</h1>
            {slotAt && !invalid && !unavailable && (
              <p className="scheduled-time">{formatSessionTime(language, browserTimeZone, slotAt)}</p>
            )}
            {scheduledEntry?.status === 'waiting' && (
              <div className="searching-ellipsis" aria-hidden="true">.<span>.</span><span>.</span></div>
            )}
            {(ended || unavailable || invalid) && (
              <button
                type="button"
                className="quiet-link scheduled-return"
                onClick={() => {
                  invitationToken.current = null
                  scheduledMode.current = false
                  go('/')
                }}
              >
                {t.scheduled.returnToSystem}
              </button>
            )}
          </div>
        </section>
        {entranceWarningOpen && <EntranceWarning onAccept={acceptEntranceWarning} />}
      </main>
    )
  }

  return (
    <main
      ref={main}
      tabIndex={-1}
      inert={entranceWarningOpen}
      className={
        page === '/'
          ? 'homepage' +
            (languageOpen ? ' language-is-open' : '') +
            (incomingRequest ? ' has-incoming-request' : '') +
            (searching ? ' is-searching' : '') +
            (connectionEstablished !== null || noOtherSelf || participationBlockReason || scheduledRegistrationSlot || scheduledRegistrationPending || scheduledConfirmationOpen || scheduledRegistrationError ? ' has-connection-result' : '')
          : page === '/participate'
            ? 'participation-page'
            : 'text-page'
      }
    >
      <header className={`homepage-header ${page !== '/' ? 'inner-header' : 'ss-fade'} ${languageOpen ? 'has-open-menu' : ''}`}>
        {page === '/' && (
          <nav className="homepage-nav" aria-label={t.navigation}>
            {link('/about', t.about)}
            {link('/privacy', t.privacy)}
          </nav>
        )}

        {renderLanguageControl()}
      </header>

      {page === '/' ? (
        <>
          <h1 className={`homepage-title ss-rise${languageOpen ? ' is-menu-blurred' : ''}`}>
            <button
              type="button"
              className="title-word"
              aria-expanded={subject === 'system'}
              aria-haspopup="dialog"
              onClick={event => openLayer('system', event)}
            >
              SYSTEM
            </button>
            <button
              type="button"
              className="title-word"
              aria-expanded={subject === 'self'}
              aria-haspopup="dialog"
              onClick={event => openLayer('self', event)}
            >
              SELF
            </button>
          </h1>

          <button
            type="button"
            className="homepage-connection"
            aria-expanded={subject === 'connection'}
            aria-haspopup="dialog"
            onClick={event => openLayer('connection', event)}
          >
            <span className="connection-label">{t.next}</span>
            <span className="connection-time">{formatSessionTime(language, browserTimeZone, nextConnectionSlot)}</span>
          </button>

          <div className="homepage-actions">
            <button className="action-button" type="button" onClick={searchForConnection}>
              {t.search}
            </button>
            <button
              className="action-button"
              type="button"
              onClick={() => openScheduledRegistration(nextConnectionSlot)}
            >
              {t.join}
            </button>
          </div>

          <div className="homepage-metadata">
            <p>
              {t.you} <span className="live-number">{presenceCount}</span>
            </p>
            <p data-completed-connections-status={completedConnectionsStatus}>
              <span className="live-number live-number-offset">
                {completedConnectionsCount === null
                  ? '—'
                  : formatCompletedConnectionsCount(completedConnectionsCount, language)}
              </span>{' '}
              {completedConnectionsCount === 1n ? t.connection : t.connections}
            </p>
            <p className="homepage-system-log-link">{link('/system-log', t.systemLog.title)}</p>
          </div>

          {subject && (
            <ExplanatoryLayer
              key={`${subject}-${language}`}
              explanation={t.explanations[subject]}
              about={t.about}
              close={t.close}
              onClose={closeLayer}
              onAbout={event => navigate(event, '/about')}
            />
          )}

          {searching && !incomingRequest && (
            <section className="incoming-request-layer" role="status">
              <div className="incoming-request-content">
                <BilingualConnectionHeading message="searching" />
                <div className="searching-ellipsis" aria-hidden="true">
                  .<span>.</span><span>.</span>
                </div>
              </div>
            </section>
          )}

          {!searching && !incomingRequest && connectionEstablished !== null && !noOtherSelf && (
            <section className="incoming-request-layer" role="status">
              <div className="incoming-request-content">
                <BilingualConnectionHeading message={connectionEstablished ? 'established' : 'notEstablished'} />
              </div>
            </section>
          )}

          {noOtherSelf && (
            <section className="incoming-request-layer" role="status">
              <div className="incoming-request-content">
                <BilingualConnectionHeading message="noOther" />
              </div>
            </section>
          )}

          {participationBlockReason && (
            <ComputerRequired
              title={t.computerRequired.title}
              message={t.computerRequired[participationBlockReason]}
              returnLabel={t.back}
              onReturn={() => setParticipationBlockReason(null)}
            />
          )}

          {scheduledRegistrationSlot && !scheduledRegistration && (
            <section
              className="incoming-request-layer"
              role="dialog"
              aria-modal="false"
              aria-labelledby="scheduled-registration-title"
            >
              <form
                className="incoming-request-content scheduled-registration"
                onSubmit={event => {
                  event.preventDefault()
                  if (!scheduledGender || !scheduledCountry) return
                  void joinNextSession(scheduledRegistrationSlot, scheduledGender, scheduledCountry)
                }}
              >
                <h2 id="scheduled-registration-title">{t.join}</h2>
                <p className="scheduled-registration-time">
                  {formatSessionTime(language, browserTimeZone, scheduledRegistrationSlot)}
                </p>
                <label className="line-field">
                  <span>{t.scheduled.gender}</span>
                  <select
                    name="gender"
                    value={scheduledGender}
                    required
                    autoFocus
                    onChange={event => setScheduledGender(event.target.value as ScheduledGender | '')}
                  >
                    <option value="" disabled>{t.scheduled.chooseGender}</option>
                    {scheduledGenders.map(value => (
                      <option key={value} value={value}>{t.scheduled.genderOptions[value]}</option>
                    ))}
                  </select>
                </label>
                <label className="line-field">
                  <span>{t.scheduled.country}</span>
                  <select
                    name="country"
                    value={scheduledCountry}
                    required
                    onChange={event => setScheduledCountry(event.target.value)}
                  >
                    <option value="" disabled>{t.scheduled.chooseCountry}</option>
                    {scheduledCountries.map(country => (
                      <option key={country.code} value={country.code}>{country.name}</option>
                    ))}
                  </select>
                </label>
                <button className="action-button" type="submit" disabled={scheduledRegistrationPending}>
                  {scheduledRegistrationPending ? t.scheduled.joining : t.join}
                </button>
                <button
                  className="quiet-link"
                  type="button"
                  disabled={scheduledRegistrationPending}
                  onClick={() => setScheduledRegistrationSlot(null)}
                >
                  {t.close}
                </button>
                {scheduledRegistrationError && (
                  <p className="scheduled-registration-error" role="status">{t.scheduled.unavailable}</p>
                )}
              </form>
            </section>
          )}

          {scheduledRegistration && scheduledConfirmationOpen && (
            <section className="incoming-request-layer" role="status" aria-live="polite">
              <div className="incoming-request-content scheduled-confirmation">
                <h2>{t.scheduled.expected}</h2>
                <p className="scheduled-time">
                  {formatSessionTime(language, browserTimeZone, scheduledRegistration.slotAt)}
                </p>
                <p className="scheduled-link-label">{t.scheduled.connectionLink}</p>
                <button type="button" className="quiet-link" onClick={copyScheduledLink}>
                  {t.scheduled.copyLink}
                </button>
                <p className="scheduled-copy-status">{linkCopied ? t.scheduled.copied : ''}</p>
                <button
                  type="button"
                  className="quiet-link scheduled-return"
                  onClick={() => {
                    setScheduledConfirmationOpen(false)
                    main.current?.focus({ preventScroll: true })
                  }}
                >
                  {t.close}
                </button>
              </div>
            </section>
          )}

          {incomingRequest && (
            <section
              className="incoming-request-layer"
              role="dialog"
              aria-modal="false"
              aria-labelledby="incoming-request-title"
            >
              <div className="incoming-request-content incoming-request-bilingual">
                {bilingualLanguages.map(language =>
                  <div key={language} className="incoming-request-language">
                    <h2 id={language === 'en' ? 'incoming-request-title' : undefined} lang={language}>
                      {renderLineBreaks(copy[language].connectionState.incoming)}
                    </h2>
                    <div className="incoming-request-actions incoming-request-language-actions">
                      <button type="button" className="quiet-link" lang={language} onClick={() => respondToConnection(true)}>
                        {copy[language].connectionState.accept}
                      </button>
                      <button type="button" className="quiet-link" lang={language} onClick={() => respondToConnection(false)}>
                        {copy[language].connectionState.decline}
                      </button>
                    </div>
                  </div>,
                )}
              </div>
            </section>
          )}
        </>
      ) : page === '/participate' ? (
        <>
          {link('/', t.back, 'page-return participation-return')}
          <ParticipationPage t={t} />
        </>
      ) : (
        <>
          <TextPage
            title={page === '/about' ? t.about : t.privacy}
            paragraphs={page === '/about' ? t.aboutText : t.privacyText}
            renderParagraph={page === '/about' ? renderAboutParagraph : undefined}
          />
          {link('/', t.back, 'page-return text-return')}
        </>
      )}
      {entranceWarningOpen && <EntranceWarning onAccept={acceptEntranceWarning} />}
    </main>
  )
}

function TextPage({
  title,
  paragraphs,
  renderParagraph,
}: {
  title: string
  paragraphs: string[]
  renderParagraph?: (paragraph: string) => ReactNode
}) {
  return (
    <section className="text-content ss-fade" aria-label={title}>
      <h1 className="sr-only">{title}</h1>
      {paragraphs.map(paragraph => (
        <p key={paragraph} style={{ whiteSpace: 'pre-line' }}>
          {renderParagraph ? renderParagraph(paragraph) : paragraph}
        </p>
      ))}
    </section>
  )
}

function ParticipationPage({ t }: { t: Copy }) {
  const [attempted, setAttempted] = useState(false)

  return (
    <div className="participation-content ss-fade">
      <h1>{t.heading}</h1>
      <form
        className="participation-form"
        onSubmit={event => {
          event.preventDefault()
          setAttempted(true)
        }}
      >
        <label className="line-field">
          <span>{t.email}</span>
          <input type="email" name="email" autoComplete="email" required />
        </label>

        <div className="consent-group">
          <label className="consent">
            <input type="checkbox" name="connection-consent" required />
            <span>{t.consent}</span>
          </label>
          <label className="consent">
            <input type="checkbox" name="data-consent" required />
            <span>{t.dataConsent}</span>
          </label>
        </div>

        <button className="action-button participation-submit" type="submit">
          {t.heading}
        </button>
        <p className="participation-status" role="status">
          {attempted ? t.participationUnavailable : ''}
        </p>
      </form>
    </div>
  )
}

export default App
