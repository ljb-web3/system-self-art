import { useEffect, useLayoutEffect, useRef } from 'react'

export type RequiredAction = {
  requestId: string
  exercise: string
  action: string
  // Optional reducer commit timestamp; otherwise the deadline begins when the
  // required action becomes visible in this hook's committed effect.
  startedAt?: number
}

export const requiredActionTimeoutMs = 20_000

// One local deadline for the action this SELF currently owes. Callers decide
// which states require an action; passive waiting must pass null.
export function useRequiredActionTimeout(
  required: RequiredAction | null,
  isStillRequired: (action: RequiredAction) => boolean,
  onTimeout: (action: RequiredAction) => void,
) {
  const latest = useRef({ isStillRequired, onTimeout })
  const activeDeadline = useRef<symbol | null>(null)
  useLayoutEffect(() => { latest.current = { isStillRequired, onTimeout } }, [isStillRequired, onTimeout])

  const requestId = required?.requestId
  const exercise = required?.exercise
  const action = required?.action
  const startedAt = required?.startedAt

  useEffect(() => {
    if (requestId === undefined || exercise === undefined || action === undefined) return
    const actionStartedAt = startedAt ?? performance.now()
    const identity = { requestId, exercise, action, startedAt: actionStartedAt }
    const deadline = Symbol(action)
    activeDeadline.current = deadline
    let fired = false
    console.info('[SYSTEM-SELF SESSION]', 'inactivity timer START', { exercise, action, requestId: requestId.slice(0, 8) })
    const timer = setTimeout(() => {
      if (activeDeadline.current !== deadline || !latest.current.isStillRequired(identity)) {
        console.info('[SYSTEM-SELF SESSION]', 'inactivity timer IGNORE stale action', { exercise, action, requestId: requestId.slice(0, 8) })
        return
      }
      fired = true
      console.info('[SYSTEM-SELF SESSION]', 'inactivity timer FIRE', { exercise, action, requestId: requestId.slice(0, 8) })
      latest.current.onTimeout(identity)
    }, Math.max(0, actionStartedAt + requiredActionTimeoutMs - performance.now()))
    return () => {
      clearTimeout(timer)
      if (activeDeadline.current === deadline) activeDeadline.current = null
      if (!fired) console.info('[SYSTEM-SELF SESSION]', 'inactivity timer CANCEL', { exercise, action, requestId: requestId.slice(0, 8) })
    }
  }, [requestId, exercise, action, startedAt])
}
