import { describe, it, expect } from 'vitest'
import { progressSnapshot, rankUps } from './rankup.js'

const NOW = Date.parse('2026-10-20T12:00:00')
const opts = { now: NOW }
const day = n => new Date(NOW - n * 86400000)
const workout = (daysAgo, id, sets) => {
  const d = day(daysAgo)
  return { id: id + '-' + daysAgo, d: d.toISOString().slice(0, 10), start: d.getTime(), entries: [{ id, sets: sets.map(([w, r]) => ({ w, r, done: true })) }] }
}
const profile = workouts => ({ unit: 'kg', body: 'male', bodyweight: [{ d: '2026-10-01', w: 80 }], workouts })
const BENCH = '0025', BIKE = '3893'

describe('rankUps', () => {
  it('reports an exercise that climbs a division', () => {
    const before = profile([workout(20, BENCH, [[80, 1]]), workout(10, BENCH, [[68, 1]])])
    const after = profile([...before.workouts, workout(1, BENCH, [[80, 1]])])
    const ups = rankUps(progressSnapshot(before, opts), progressSnapshot(after, opts), after, opts).filter(u => u.kind === 'exercise')
    expect(ups).toHaveLength(1)
    expect(ups[0]).toMatchObject({ exId: BENCH, from: { tier: 'gold', division: 3 }, to: { tier: 'gold', division: 2 } })
    expect(ups[0].to.strengthKg).toBeCloseTo(80)
  })
  it('reports a level crossing', () => {
    const before = profile([workout(1, BIKE, [[0, 10]])])
    const after = profile([...before.workouts, workout(0, BIKE, [[0, 10]])])
    expect(rankUps(progressSnapshot(before, opts), progressSnapshot(after, opts), after, opts))
      .toEqual([{ kind: 'level', from: 1, to: 2 }])
  })
  it('reports nothing when nothing changed', () => {
    const S = profile([workout(20, BENCH, [[80, 1]]), workout(10, BENCH, [[68, 1]])])
    expect(rankUps(progressSnapshot(S, opts), progressSnapshot(S, opts), S, opts)).toEqual([])
  })
  it('never reports a rank going down', () => {
    const S = profile([workout(20, BENCH, [[80, 1]]), workout(10, BENCH, [[68, 1]])])
    const before = { ranks: { [BENCH]: 12 }, overall: 0, level: 99 }
    expect(rankUps(before, progressSnapshot(S, opts), S, opts)).toEqual([])
  })
})
