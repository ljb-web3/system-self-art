import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getOrCreateSelfId } from '../selfId'
import { enterPublicSystem, getOrCreatePublicCredential } from '../lib/publicSystemLog'
import { resilientLocalStorage } from '../localStorage'

type RealtimeStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'
export type PresenceEvidence = {
  status: RealtimeStatus | null
  socketConnected: boolean
  generation: number
  snapshotRevision: number
  snapshotReceivedAt: number | null
  trackConfirmed: boolean
  healthy: boolean
  peerPresent: boolean
  peerLastSeenRevision: number
}

export function usePresence() {
  const [presenceCount, setPresenceCount] = useState(0)
  const [selfId] = useState(() => getOrCreateSelfId(resilientLocalStorage))
  const [publicCredential] = useState(() => getOrCreatePublicCredential(resilientLocalStorage, selfId))
  const [presentSelfIds, setPresentSelfIds] = useState<string[]>([])
  const [presenceHealthy, setPresenceHealthy] = useState(false)
  const statusRef = useRef<RealtimeStatus | null>(null)
  const syncedRef = useRef(false)
  const trackConfirmedRef = useRef(false)
  const generationRef = useRef(0)
  const observedSyncRef = useRef(0)
  const snapshotRevisionRef = useRef(0)
  const snapshotReceivedAtRef = useRef<number | null>(null)
  const peerLastSeenRevisionRef = useRef(new Map<string, number>())
  const presentSelfIdsRef = useRef<string[]>([])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const isPresenceHealthy = useCallback(() => statusRef.current === 'SUBSCRIBED' && syncedRef.current &&
    channelRef.current?.socket.isConnected() === true, [])
  const isSelfPresent = useCallback((id: string) => presentSelfIdsRef.current.includes(id), [])
  const getPresenceEvidence = useCallback((peerId?: string): PresenceEvidence => ({
    status: statusRef.current,
    socketConnected: channelRef.current?.socket.isConnected() === true,
    generation: generationRef.current,
    snapshotRevision: snapshotRevisionRef.current,
    snapshotReceivedAt: snapshotReceivedAtRef.current,
    trackConfirmed: trackConfirmedRef.current,
    healthy: statusRef.current === 'SUBSCRIBED' && syncedRef.current && trackConfirmedRef.current &&
      channelRef.current?.socket.isConnected() === true,
    peerPresent: peerId === undefined ? false : presentSelfIdsRef.current.includes(peerId),
    peerLastSeenRevision: peerId === undefined ? 0 : peerLastSeenRevisionRef.current.get(peerId) ?? 0,
  }), [])

  useEffect(() => {
    let cancelled = false
    let connectedChannel: ReturnType<typeof supabase.channel> | null = null

    const connect = async () => {
      try {
        await enterPublicSystem(supabase, selfId, publicCredential)
      } catch (error) {
        // Keep Presence available during a staggered deployment. Once the
        // migration is installed, identity assignment precedes UUID exposure.
        console.error('Public SELF identity could not be established before Presence:', error)
      }
      if (cancelled) return

    const channel = supabase.channel('system-self-presence', {
      config: {
        presence: {
          key: selfId,
        },
      },
    })
    connectedChannel = channel
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        observedSyncRef.current++
        const state = channel.presenceState()

        const count = Object.values(state).reduce(
          (total, presences) => total + presences.length,
          0
        )

        setPresenceCount(count)
        const ids = Object.keys(state)
        presentSelfIdsRef.current = ids
        setPresentSelfIds(ids)
        if (statusRef.current === 'SUBSCRIBED' && trackConfirmedRef.current) {
          if (!syncedRef.current) console.info('[SYSTEM-SELF SESSION]', 'REALTIME HEALTH RESTORED')
          syncedRef.current = true
          snapshotRevisionRef.current++
          snapshotReceivedAtRef.current = Date.now()
          ids.forEach(id => peerLastSeenRevisionRef.current.set(id, snapshotRevisionRef.current))
          setPresenceHealthy(true)
        }
      })
      .subscribe(async (status) => {
        statusRef.current = status
        console.info('[SYSTEM-SELF SESSION]', 'REALTIME STATUS', { status })
        if (status === 'SUBSCRIBED') {
          // A new subscription needs its own Presence snapshot before absence is trusted.
          const generation = ++generationRef.current
          const syncBaseline = observedSyncRef.current
          syncedRef.current = false
          trackConfirmedRef.current = false
          setPresenceHealthy(false)
          const trackStatus = await channel.track({
            online_at: new Date().toISOString(),
          })
          if (statusRef.current === 'SUBSCRIBED' && generationRef.current === generation && trackStatus === 'ok') {
            trackConfirmedRef.current = true
            if (observedSyncRef.current > syncBaseline) {
              syncedRef.current = true
              snapshotRevisionRef.current++
              snapshotReceivedAtRef.current = Date.now()
              presentSelfIdsRef.current.forEach(id => peerLastSeenRevisionRef.current.set(id, snapshotRevisionRef.current))
              setPresenceHealthy(true)
              console.info('[SYSTEM-SELF SESSION]', 'REALTIME HEALTH RESTORED', { generation, source: 'post-track-sync' })
            }
          } else if (statusRef.current === 'SUBSCRIBED' && generationRef.current === generation) {
            console.error('[SYSTEM-SELF SESSION]', 'PRESENCE TRACK FAILED', { status: trackStatus, generation })
          }
        } else {
          syncedRef.current = false
          trackConfirmedRef.current = false
          setPresenceHealthy(false)
        }
      })

    }

    void connect()

    return () => {
      cancelled = true
      statusRef.current = null
      syncedRef.current = false
      trackConfirmedRef.current = false
      channelRef.current = null
      if (connectedChannel) void supabase.removeChannel(connectedChannel)
    }
  }, [selfId, publicCredential])

  const otherSelfIds = presentSelfIds.filter((id) => id !== selfId)

  return { presenceCount, selfId, presentSelfIds, otherSelfIds, presenceHealthy, isPresenceHealthy, isSelfPresent, getPresenceEvidence }
}
