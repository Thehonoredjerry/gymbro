// XP and levels (GymBro): rewards showing up, so a beginner levels up as surely as the strongest
// friend. Derived from workout history, never stored, so it syncs and recomputes for free.
import { isWarmupRow } from './workout-model.js'

export const XP = { WORKOUT: 50, SET: 5, SET_CAP: 40, STREAK_WEEK: 25 }

const doneWork = s => s && s.done === true && !isWarmupRow(s)

/** A finished workout's XP: its base plus each completed working set, up to SET_CAP sets. */
export function workoutXp(w) {
  const n = (w?.entries || []).reduce((sum, e) => sum + (e?.sets || []).filter(doneWork).length, 0)
  return XP.WORKOUT + Math.min(n, XP.SET_CAP) * XP.SET
}

// The Monday of a workout's week, as a day number, so consecutive weeks differ by exactly 7.
const weekOf = d => {
  const t = Date.parse(String(d).slice(0, 10) + 'T00:00:00Z')
  if (!Number.isFinite(t)) return null
  const day = Math.floor(t / 86400000)
  return day - ((new Date(t).getUTCDay() + 6) % 7)
}

/** Every workout's XP, plus STREAK_WEEK for each trained week that follows a trained week. */
export function totalXp(S) {
  const ws = S?.workouts || []
  const weeks = new Set(ws.map(w => weekOf(w.d)).filter(v => v != null))
  const streak = [...weeks].filter(wk => weeks.has(wk - 7)).length
  return ws.reduce((sum, w) => sum + workoutXp(w), 0) + streak * XP.STREAK_WEEK
}

/** Level L needs 50 × L × (L − 1) total XP: L2 at 100, L3 at 300, L4 at 600. */
export function levelOf(xp) {
  const need = L => 50 * L * (L - 1)
  let level = 1
  while (xp >= need(level + 1)) level++
  const intoLevel = xp - need(level), forNext = need(level + 1) - need(level)
  return { level, xp, intoLevel, forNext, progress: intoLevel / forNext }
}
