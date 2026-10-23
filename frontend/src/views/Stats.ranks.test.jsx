// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { _setLangState } from '../lib/i18n-core.js'
import th from '../locales/th.js'
import { RanksCard } from '../components/Ranks.jsx'

vi.mock('../sheets.jsx', () => ({ bwSheet: vi.fn() }))

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); _setLangState('en', null, null, null) })

const BENCH = '0025', SQUAT = '0043'
const daysAgo = n => new Date(Date.now() - n * 86400000)
const workout = (n, id, w) => ({ id: id + n, d: daysAgo(n).toISOString().slice(0, 10), start: daysAgo(n).getTime(), entries: [{ id, sets: [{ w, r: 1, done: true }] }] })
// Bench 68 kg twice at 80 kg body weight → Gold III; squat 120 kg twice → Gold II.
const S = (extra = {}) => ({
  unit: 'kg', body: 'male', bodyweight: [{ d: daysAgo(30).toISOString().slice(0, 10), w: 80 }],
  workouts: [workout(10, BENCH, 68), workout(3, BENCH, 68), workout(9, SQUAT, 120), workout(2, SQUAT, 120)], ...extra,
})
const mount = s => act(() => root.render(<RanksCard S={s} />))
const rows = () => [...host.querySelectorAll('.rank-row')].map(r => r.textContent)

describe('Stats ranks', () => {
  it('lists ranked exercises by points, each with its next tier', () => {
    mount(S())
    expect(rows()).toHaveLength(2)
    expect(rows()[0]).toContain('Gold II')
    expect(rows()[1]).toContain('Gold III')
    expect(rows()[0]).toContain('next tier at')
  })
  it('asks for a body weight first', () => {
    mount(S({ bodyweight: [] }))
    expect(host.textContent).toContain('Log your body weight to get ranks')
    expect(rows()).toHaveLength(0)
  })
  it('in Thai', () => {
    _setLangState('th', th, null, null)
    mount(S())
    expect(rows()[0]).toContain(th['Gold'] + ' II')
    expect(host.textContent).not.toMatch(/next tier at|Ranks|Unranked|Gold/)
    act(() => root.render(<RanksCard S={S({ bodyweight: [] })} />))
    expect(host.textContent).toContain(th['Log your body weight to get ranks'])
  })
})
