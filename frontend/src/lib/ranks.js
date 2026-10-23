// Strength ranks (GymBro): every weighted exercise earns a tier, Bronze → Champion with III–I
// inside each tier, from how strong you are on it relative to your body weight.
//
// "Prove it twice": a level only counts once it has been reached in two different sessions. The
// ranking strength is the second-highest session best (estimated 1RM, lib/onerm.js) of the last
// 90 days, so one lucky heavy day never ranks anyone up — matching it once more does.
//
// There are no published standards for 5,600 exercises, machines included, so exercises fall
// into movement groups read off the catalogue, each with GymBro's own thresholds. Machine ranks
// are approximate by nature: machines differ between gyms. Derived from history, never stored.
import { e1rmSeries } from './onerm.js'
import { bodyweightKgOf } from './structuralBalance.js'
import { LB_TO_KG } from './recovery.js'
import { EXIDX } from './exercises.js'

export const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion']
export const RANK_NEEDS_BW = 'no-bodyweight'
export const RANK_WINDOW_DAYS = 90
const FEMALE_FACTOR = 0.7
const PER_HAND_FACTOR = 0.45

// Male tier-start ratios (strength ÷ body weight) for silver, gold, platinum, diamond, champion.
export const GROUP_RATIOS = {
  legpress: [1.5, 2.5, 3.5, 4.5, 5.5],
  squat: [0.75, 1.25, 1.75, 2.25, 2.75],
  hinge: [1.0, 1.5, 2.0, 2.5, 3.0],
  hpress: [0.5, 0.85, 1.2, 1.5, 1.85],
  vpress: [0.35, 0.55, 0.75, 0.95, 1.15],
  shoulderIso: [0.1, 0.18, 0.26, 0.34, 0.42],
  pull: [0.5, 0.8, 1.1, 1.4, 1.7],
  arms: [0.2, 0.35, 0.5, 0.65, 0.8],
  legIso: [0.4, 0.7, 1.0, 1.3, 1.6],
  calves: [0.75, 1.25, 1.75, 2.25, 2.75],
  core: [0.2, 0.4, 0.6, 0.8, 1.0],
  default: [0.3, 0.5, 0.75, 1.0, 1.25],
}
const UNRANKED_CATS = new Set(['cardio', 'stretching', 'mobility', 'yoga'])
const PER_HAND_EQ = new Set(['dumbbell', 'kettlebell'])
const has = (name, words) => words.some(w => name.includes(w))

/** The movement group an exercise ranks in, or null for one that has no rank (cardio, stretches). */
export function movementGroup(exId) {
  const ex = EXIDX[exId]
  if (!ex || UNRANKED_CATS.has(ex.cat) || ex.tg === 'cardiovascular system') return null
  const n = String(ex.n || '').toLowerCase(), tg = ex.tg
  if (has(n, ['leg press', 'hack squat', 'sled'])) return 'legpress'
  if (has(n, ['squat', 'lunge', 'split']) || tg === 'quads') return 'squat'
  if (has(n, ['deadlift', 'good morning', 'hip thrust', 'glute bridge', 'rack pull']) || tg === 'glutes' || tg === 'traps') return 'hinge'
  if (tg === 'pectorals') return has(n, ['fly', 'crossover']) ? 'arms' : 'hpress'
  if (tg === 'delts') return n.includes('raise') ? 'shoulderIso' : 'vpress'
  if (['lats', 'upper back', 'levator scapulae', 'serratus anterior'].includes(tg)) return 'pull'
  if (['biceps', 'triceps', 'forearms'].includes(tg)) return 'arms'
  if (['hamstrings', 'adductors', 'abductors'].includes(tg)) return 'legIso'
  if (tg === 'calves') return 'calves'
  if (tg === 'abs' || tg === 'spine') return 'core'
  return 'default'
}

const toKg = (v, unit) => (unit === 'lb' ? v * LB_TO_KG : v)

/** Second-highest session best (kg) within the window; null with fewer than two sessions. */
export function rankingStrength(S, exId, { now = Date.now() } = {}) {
  const since = now - RANK_WINDOW_DAYS * 86400000
  const bests = e1rmSeries(S, exId).filter(p => p.t >= since && p.t <= now && p.y > 0).map(p => p.y).sort((a, b) => b - a)
  return bests.length >= 2 ? toKg(bests[1], S.unit) : null
}

// Points 1..16: bronze III = 1 … diamond I = 15, champion = 16.
const pointsOf = (tierIdx, division) => (tierIdx === 5 ? 16 : tierIdx * 3 + (4 - division))
const fromPoints = points => {
  if (points >= 16) return { tier: 'champion', division: null, points: 16 }
  const p = Math.max(1, points), tierIdx = Math.floor((p - 1) / 3)
  return { tier: TIERS[tierIdx], division: 3 - ((p - 1) % 3), points: p }
}

function thresholdsFor(S, exId, group) {
  let f = S.body === 'female' ? FEMALE_FACTOR : 1
  if (PER_HAND_EQ.has(EXIDX[exId]?.eq)) f *= PER_HAND_FACTOR
  return [0, ...GROUP_RATIOS[group].map(r => r * f)]   // tier starts, bronze first
}

/**
 * The rank of one exercise: null when it has none (no group, or not proven twice), `{ blocked }`
 * without a body weight, otherwise { tier, division, points, group, strengthKg, ratio, nextKg }.
 */
export function rankFor(S, exId, opts = {}) {
  const group = movementGroup(exId)
  if (!group) return null
  const strengthKg = rankingStrength(S, exId, opts)
  if (strengthKg == null) return null
  const bw = bodyweightKgOf(S)
  if (!bw) return { blocked: RANK_NEEDS_BW }
  const starts = thresholdsFor(S, exId, group)
  const ratio = strengthKg / bw
  let tierIdx = 0
  while (tierIdx < 5 && ratio >= starts[tierIdx + 1]) tierIdx++
  if (tierIdx === 5) return { tier: 'champion', division: null, points: 16, group, strengthKg, ratio, nextKg: null }
  const lo = starts[tierIdx], step = (starts[tierIdx + 1] - lo) / 3
  const part = Math.min(2, Math.floor((ratio - lo) / step))   // 0 = III, 1 = II, 2 = I
  const division = 3 - part
  return { tier: TIERS[tierIdx], division, points: pointsOf(tierIdx, division), group, strengthKg, ratio, nextKg: bw * (lo + step * (part + 1)) }
}

/** Every ranked exercise in the profile's history, highest points first. */
export function allRanks(S, opts = {}) {
  const ids = new Set((S.workouts || []).flatMap(w => (w.entries || []).map(e => e?.id).filter(Boolean)))
  return [...ids].map(exId => ({ exId, ...rankFor(S, exId, opts) }))
    .filter(r => r.tier)
    .sort((a, b) => b.points - a.points)
}

/** Overall rank from exercise points: average of the top five, rounded down; null under three. */
export function overallFromPoints(points) {
  if (points.length < 3) return null
  const top = [...points].sort((a, b) => b - a).slice(0, 5)
  return { ...fromPoints(Math.floor(top.reduce((s, p) => s + p, 0) / top.length)), count: points.length }
}

export const overallRank = (S, opts = {}) => overallFromPoints(allRanks(S, opts).map(r => r.points))
