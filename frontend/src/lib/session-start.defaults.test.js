import { describe, it, expect } from 'vitest'
import { buildSessionEntries } from './session-start.js'
import { withProgDefault } from './routines.js'

// GymBro's defaults for friends: a routine opens at exactly what was lifted the most recent time
// (never an older, heavier day), adds no weight on its own, and an exercise never done before
// opens empty for the lifter to fill in.
describe('workout defaults', () => {
  const set = (w, r) => ({ w, r, done: true })
  const st = {
    unit: 'kg', exWeights: {}, routines: [],
    workouts: [
      { id: 'w1', d: '2026-10-01', start: Date.parse('2026-10-01T10:00:00'), entries: [{ id: '0025', sets: [set(70, 5), set(70, 5), set(70, 5)] }] },
      { id: 'w2', d: '2026-10-08', start: Date.parse('2026-10-08T10:00:00'), entries: [{ id: '0025', sets: [set(60, 8), set(60, 8), set(57.5, 7)] }] },
    ],
  }
  // Every routine the app creates is stamped with progression off (withProgDefault).
  const routine = withProgDefault({ id: 'r', ex: [{ id: '0025', sets: 3, reps: 8, weight: 0 }, { id: '0032', sets: 3, reps: 10, weight: 0 }] })

  it('opens a done exercise at the most recent session, set by set, never the older heavier one', () => {
    const [bench] = buildSessionEntries(st, routine)
    expect(bench.sets.map(s => s.w)).toEqual([60, 60, 57.5])
  })

  it('adds no weight when no progression rule is set', () => {
    const [bench] = buildSessionEntries(st, routine)
    expect(bench.plan.kind).toBe('off')
    expect(bench.target.weight ?? 0).toBe(0)
  })

  it('opens an exercise never done before empty: no weight and no reps', () => {
    const [, fresh] = buildSessionEntries(st, routine)
    expect(fresh.sets).toHaveLength(3)
    for (const s of fresh.sets) { expect(s.w).toBe(0); expect(s.r).toBe(0); expect(s.done).toBe(false) }
  })

  it('a bodyweight exercise never done opens at the planned reps: it has no load to enter', () => {
    const [situp] = buildSessionEntries(st, withProgDefault({ id: 'b', ex: [{ id: '0001', sets: 2, reps: 15, weight: 0 }] }))
    expect(situp.sets.map(s => s.r)).toEqual([15, 15])
  })

  it('stamps progression off only when no rule is set, keeping a chosen one', () => {
    expect(withProgDefault({ id: 'a', ex: [] }).prog).toBe('off')
    expect(withProgDefault({ id: 'b', ex: [], prog: 'greyskull' }).prog).toBe('greyskull')
  })

  it('still adds weight for someone who switched progression on', () => {
    const [bench] = buildSessionEntries(st, { ...routine, prog: 'linear' })
    expect(bench.plan.kind).not.toBe('off')
  })
})
