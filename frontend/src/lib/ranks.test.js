import { describe, it, expect } from 'vitest'
import { estimate1RM } from './onerm.js'
import { movementGroup, rankingStrength, rankFor, allRanks, overallFromPoints, overallRank, RANK_NEEDS_BW } from './ranks.js'

const NOW = Date.parse('2026-10-20T12:00:00')
const day = n => new Date(NOW - n * 86400000)
const iso = d => d.toISOString().slice(0, 10)
// One workout `daysAgo` days back with one exercise and its sets ([w, r] pairs, all done).
const workout = (daysAgo, id, sets) => {
  const d = day(daysAgo)
  return { id: id + '-' + daysAgo, d: iso(d), start: d.getTime(), entries: [{ id, sets: sets.map(([w, r]) => ({ w, r, done: true })) }] }
}
const profile = (workouts, extra = {}) => ({ unit: 'kg', body: 'male', bodyweight: [{ d: '2026-10-01', w: 80 }], workouts, ...extra })
const BENCH = '0025', SQUAT = '0043', LEGPRESS = '2287', LATERAL = '0334', DB_BENCH = '0289', BIKE = '3893'

describe('movementGroup', () => {
  it('sorts exercises into groups from the catalogue', () => {
    expect(movementGroup(BENCH)).toBe('hpress')
    expect(movementGroup(LEGPRESS)).toBe('legpress')
    expect(movementGroup(SQUAT)).toBe('squat')
    expect(movementGroup(LATERAL)).toBe('shoulderIso')
    expect(movementGroup(BIKE)).toBe(null)
  })
})

describe('prove it twice', () => {
  it('one session only is unranked', () => {
    const S = profile([workout(3, BENCH, [[100, 1]])])
    expect(rankingStrength(S, BENCH, { now: NOW })).toBe(null)
    expect(rankFor(S, BENCH, { now: NOW })).toBe(null)
  })
  it('counts the lower of the two best sessions', () => {
    const S = profile([workout(10, BENCH, [[100, 1]]), workout(3, BENCH, [[80, 1]])])
    expect(rankingStrength(S, BENCH, { now: NOW })).toBeCloseTo(estimate1RM(80, 1))
  })
  it('a heavy single never ranks you up alone', () => {
    const S = profile([workout(20, BENCH, [[140, 1]]), workout(10, BENCH, [[100, 1]]), workout(3, BENCH, [[100, 1]])])
    expect(rankingStrength(S, BENCH, { now: NOW })).toBeCloseTo(estimate1RM(100, 1))
  })
  it('sessions older than 90 days do not count', () => {
    const S = profile([workout(120, BENCH, [[100, 1]]), workout(3, BENCH, [[80, 1]])])
    expect(rankingStrength(S, BENCH, { now: NOW })).toBe(null)
  })
})

describe('rankFor', () => {
  const twice = (id, w) => [workout(10, id, [[w, 1]]), workout(3, id, [[w, 1]])]
  it('maps strength ÷ body weight to a tier, division and points', () => {
    const r = rankFor(profile(twice(BENCH, 68)), BENCH, { now: NOW })   // ≈ 0.88 × body weight
    expect(r).toMatchObject({ tier: 'gold', division: 3, points: 7, group: 'hpress' })
    expect(r.nextKg).toBeCloseTo(80 * (0.85 + (1.2 - 0.85) / 3))
  })
  it('uses lower thresholds for a female body type', () => {
    expect(rankFor(profile(twice(BENCH, 68), { body: 'female' }), BENCH, { now: NOW })).toMatchObject({ tier: 'platinum', division: 3, points: 10 })
  })
  it('scales dumbbell thresholds for the per-hand load', () => {
    expect(rankFor(profile(twice(DB_BENCH, 32)), DB_BENCH, { now: NOW }).tier).toBe('gold')   // ≈ 0.40 × bw vs gold at 0.85 × 0.45 = 0.3825
    expect(rankFor(profile(twice(BENCH, 32)), BENCH, { now: NOW }).tier).toBe('bronze')   // the same load on a barbell
  })
  it('reaches champion with no division and no next step', () => {
    expect(rankFor(profile(twice(BENCH, 150)), BENCH, { now: NOW })).toMatchObject({ tier: 'champion', division: null, points: 16, nextKg: null })
  })
  it('asks for a body weight before it can rank', () => {
    expect(rankFor(profile(twice(BENCH, 68), { bodyweight: [] }), BENCH, { now: NOW })).toEqual({ blocked: RANK_NEEDS_BW })
  })
  it('lists every ranked exercise, best first', () => {
    const S = profile([...twice(BENCH, 68), ...twice(LATERAL, 20)])
    const ranks = allRanks(S, { now: NOW })
    expect(ranks.map(r => r.exId)).toEqual([LATERAL, BENCH])
  })
})

describe('overall rank', () => {
  it('needs three ranked exercises', () => {
    expect(overallFromPoints([12, 10])).toBe(null)
  })
  it('averages the top five, rounded down to a division', () => {
    expect(overallFromPoints([12, 10, 9, 7, 7, 3])).toMatchObject({ tier: 'gold', division: 1, points: 9, count: 6 })
  })
  it('comes from the profile\'s ranks', () => {
    expect(overallRank(profile([]), { now: NOW })).toBe(null)
  })
})
