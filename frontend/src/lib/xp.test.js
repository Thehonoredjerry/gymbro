import { describe, it, expect } from 'vitest'
import { XP, workoutXp, totalXp, levelOf } from './xp.js'

const sets = (n, extra = {}) => Array.from({ length: n }, () => ({ w: 50, r: 8, done: true, ...extra }))
const w = (d, entries) => ({ id: d, d, entries })

describe('XP', () => {
  it('gives a finished workout its base plus each completed working set', () => {
    const one = w('2026-10-05', [{ id: '0025', sets: [...sets(12), ...sets(2, { warmup: true }), { w: 50, r: 8, done: false }] }])
    expect(workoutXp(one)).toBe(XP.WORKOUT + 12 * XP.SET)
  })
  it('caps the sets a single workout can count', () => {
    expect(workoutXp(w('2026-10-05', [{ id: '0025', sets: sets(60) }]))).toBe(XP.WORKOUT + XP.SET_CAP * XP.SET)
  })
  it('adds a streak bonus for each week that follows a trained week', () => {
    const S = { workouts: [w('2026-10-05', [{ id: 'a', sets: sets(1) }]), w('2026-10-13', [{ id: 'a', sets: sets(1) }]), w('2026-10-20', [{ id: 'a', sets: sets(1) }])] }
    expect(totalXp(S)).toBe(3 * (XP.WORKOUT + XP.SET) + 2 * XP.STREAK_WEEK)
  })
  it('an empty profile has no XP', () => { expect(totalXp({ workouts: [] })).toBe(0) })
})

describe('levelOf', () => {
  it('needs 50 × L × (L − 1) XP to reach level L', () => {
    expect(levelOf(0)).toMatchObject({ level: 1, intoLevel: 0, forNext: 100, progress: 0 })
    expect(levelOf(100)).toMatchObject({ level: 2, intoLevel: 0, forNext: 200, progress: 0 })
    expect(levelOf(450)).toMatchObject({ level: 3, intoLevel: 150, forNext: 300, progress: 0.5 })
  })
})
