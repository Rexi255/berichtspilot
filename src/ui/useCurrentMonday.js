// The Monday of the running week that also changes while the app stays open
// (over a weekend): checked once a minute, re-renders only when the week
// actually changes. Sidebar badge and overview count with the same value.
import { useEffect, useState } from 'react'
import { mondayOf } from '../lib/dates.js'

export function useCurrentMonday() {
  const [monday, setMonday] = useState(() => mondayOf(new Date()))
  useEffect(() => {
    const timer = setInterval(() => setMonday(mondayOf(new Date())), 60_000)
    return () => clearInterval(timer)
  }, [])
  return monday
}
