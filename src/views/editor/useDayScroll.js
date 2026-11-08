// All days of a week on one page (user, 2026-11-08): which day is at the top
// of the list (the tiles' underline follows it) and jumping to a day — by
// tile, by Alt+1–5 and to today when a week opens.
import { useCallback, useEffect, useRef, useState } from 'react'

// px between the tiles' lower edge and a card that was jumped to
const GAP = 12
// a card counts as "at the top" once its top passes this far below the tiles
const LINE = 48

// The element that actually scrolls a card: the left column in a wide
// window, the whole editor area in a narrow one (container query in the view)
function scrollParent(el) {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * `rootRef` holds the scroll containers, `tilesRef` the sticky tile row;
 * `weekId` + `dates` the week shown, `initial` its start day.
 * Returns { active, jump(date, { smooth }) }.
 */
export function useDayScroll({ rootRef, tilesRef, weekId, dates, initial }) {
  // remembered per week: a stale entry from another week falls back to `initial`
  const [state, setState] = useState({ weekId: null, date: null })
  const active = state.weekId === weekId && dates.includes(state.date) ? state.date : initial
  // while a jump scrolls, the position in between must not move the underline
  const jumping = useRef(false)
  const release = useRef(null)
  const datesKey = dates.join()

  const cardOf = useCallback((date) => rootRef.current?.querySelector(`[data-daycard="${date}"]`), [rootRef])

  const measure = useCallback(() => {
    if (jumping.current || !tilesRef.current) return
    const line = tilesRef.current.getBoundingClientRect().bottom + LINE
    let current = dates[0]
    for (const date of dates) {
      const card = cardOf(date)
      if (card && card.getBoundingClientRect().top <= line) current = date
    }
    setState((s) => (s.weekId === weekId && s.date === current ? s : { weekId, date: current }))
    // datesKey stands for `dates` (a new array on every render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId, datesKey, cardOf, tilesRef])

  const jump = useCallback(
    (date, { smooth = true } = {}) => {
      setState({ weekId, date })
      const card = cardOf(date)
      const scroller = scrollParent(card)
      if (!card || !scroller || !tilesRef.current) return
      const delta = card.getBoundingClientRect().top - tilesRef.current.getBoundingClientRect().bottom - GAP
      const max = scroller.scrollHeight - scroller.clientHeight
      const top = Math.min(max, Math.max(0, scroller.scrollTop + delta))
      if (Math.abs(top - scroller.scrollTop) < 1) return
      // the last day can't always reach the top: hold the underline on the
      // picked day until the scroll has ended (timer as a fallback)
      jumping.current = true
      clearTimeout(release.current)
      release.current = setTimeout(() => (jumping.current = false), 1000)
      scroller.scrollTo({ top, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' })
    },
    [weekId, cardOf, tilesRef]
  )

  // scroll events don't bubble, but they pass the root while capturing
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onEnd = () => {
      clearTimeout(release.current)
      jumping.current = false
    }
    root.addEventListener('scroll', measure, true)
    root.addEventListener('scrollend', onEnd, true)
    return () => {
      root.removeEventListener('scroll', measure, true)
      root.removeEventListener('scrollend', onEnd, true)
    }
  }, [rootRef, measure])

  useEffect(() => () => clearTimeout(release.current), [])

  return { active, jump }
}
