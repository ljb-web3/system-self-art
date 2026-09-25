import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import { alternatingIsComplete, breathsPerSelf, isLocalBreathingTurn } from './breathingAlternating'
import type { AlternatingAction, AlternatingState } from './breathingAlternating'
import { copy } from './copy'
import type { Language } from './copy'

type Props = { state: AlternatingState; dispatch: Dispatch<AlternatingAction>; requestId: string; onBegin: () => void; onSpaceHoldChange: (held: boolean, requestId: string, turn: number) => void; language: Language }

export default function AlternatingBreathingExercise({ state, dispatch, requestId, onBegin, onSpaceHoldChange, language }: Props) {
  const t = copy[language].alternatingBreathing
  const active = state.requestId === requestId && isLocalBreathingTurn(state)
  const turnNumber = state.turnNumber
  const complete = alternatingIsComplete(state)
  const latest = useRef(state)
  useLayoutEffect(() => { latest.current = state }, [state])

  useEffect(() => {
    if (!active) return
    const held = new Map<string, string>()
    const onKeyDown = (event: KeyboardEvent) => {
      const type = event.code === 'Space' ? 'space'
        : event.code === 'Enter' || event.code === 'NumpadEnter' || event.key === 'Enter' ? 'enter'
        : null
      if (!type) return
      event.preventDefault()
      if (event.repeat || held.has(type)) return
      held.set(type, event.code || event.key)
      if (type === 'space' && latest.current.inhaleStartedAt === null) onSpaceHoldChange(true, requestId, turnNumber)
      dispatch({ type, requestId, turnNumber, at: performance.now() })
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const type = event.code === 'Space' ? 'space'
        : event.code === 'Enter' || event.code === 'NumpadEnter' || event.key === 'Enter' ? 'enter'
        : null
      if (!type) return
      event.preventDefault()
      if (held.get(type) !== (event.code || event.key)) return
      held.delete(type)
      if (type === 'space') onSpaceHoldChange(false, requestId, turnNumber)
      dispatch({ type: `${type}-release`, requestId, turnNumber, at: performance.now() })
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      held.clear()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [active, dispatch, requestId, turnNumber, onSpaceHoldChange])

  return <section className="incoming-request-layer" aria-labelledby="alternating-breathing-title" lang={language}>
    <div className="incoming-request-content breathing-content">
      {!state.localReady ? <>
        <h2 id="alternating-breathing-title" style={{ whiteSpace: 'pre-line' }}>{t.introTitle}</h2>
        <p className="breathing-guidance" style={{ whiteSpace: 'pre-line' }}>{t.introInstruction}</p>
        <dl className="breathing-controls">
          <div><dt>{t.spaceKey}</dt><dd>{t.inhaleTitle}</dd></div>
          <div><dt>{t.enterKey}</dt><dd>{t.exhaleTitle}</dd></div>
        </dl>
        <div className="incoming-request-actions"><button type="button" className="quiet-link" onClick={onBegin}>{t.begin}</button></div>
      </> : complete ? <h2 id="alternating-breathing-title" aria-live="polite" style={{ whiteSpace: 'pre-line' }}>{t.complete}</h2> : active ? <>
        <h2 id="alternating-breathing-title" aria-live="polite">{state.inhaleCompletedAt === null ? t.inhaleTitle : t.exhaleTitle}</h2>
        <p className="breathing-guidance">{state.inhaleCompletedAt === null ? t.inhaleInstruction : t.exhaleInstruction}</p>
        <p className="breathing-guidance">{state.breaths.length + 1} / {breathsPerSelf}</p>
      </> : <h2 id="alternating-breathing-title" aria-live="polite" style={{ whiteSpace: 'pre-line' }}>{t.waitingOther}</h2>}
    </div>
  </section>
}
