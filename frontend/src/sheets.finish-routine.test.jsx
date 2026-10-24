// @vitest-environment happy-dom
// GymBro: finishing saves the workout either way. The summary then asks about the routine only
// when it matters: keep a freestyle session as a routine, or (when the exercises themselves
// changed) update the routine it came from. Heavier weights or more reps never ask.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { finishWorkout } from './sheets.jsx'

const mounted = []
function renderSummary() {
  const sheet = useUI.getState().sheets.find(x => {
    const h = document.createElement('div'); const r = createRoot(h)
    act(() => r.render(x.render(() => {})))
    const hit = h.textContent.includes('Workout complete!'); act(() => r.unmount()); return hit
  })
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host); mounted.push(root)
  act(() => root.render(sheet.render(() => {})))
  return host
}
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)

const routine = { id: 'r1', name: 'Push', prog: 'off', ex: [{ id: '0025', sets: 1, reps: 8, weight: 60 }, { id: '0426', sets: 1, reps: 10, weight: 20 }] }
const set = w => ({ w, r: 8, done: true })
const startWith = (entries, routineIds = ['r1']) => useStore.setState({
  user: null,
  S: { ...structuredClone(DEF), routines: [structuredClone(routine)], active: { id: 'a1', d: '2026-10-24', start: Date.now() - 600000, routineIds, name: 'Push', cur: 0, entries } },
})

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(r => r.unmount()) }) })

describe('finish: the routine question', () => {
  it('does not ask when only the weights changed', () => {
    startWith([{ id: '0025', rid: 'r1', sets: [set(80)] }, { id: '0426', rid: 'r1', sets: [set(30)] }])
    finishWorkout()
    const host = renderSummary()
    expect(host.querySelector('.routine-choice')).toBeNull()
    expect(useStore.getState().S.routines[0].ex.map(x => x.weight)).toEqual([60, 20])
    expect(useStore.getState().S.workouts).toHaveLength(1)
  })

  it('asks when the order changed, and updates the routine only on Update routine', () => {
    startWith([{ id: '0426', rid: 'r1', sets: [set(30)] }, { id: '0025', rid: 'r1', sets: [set(80)] }])
    finishWorkout()
    const host = renderSummary()
    expect(host.querySelector('.routine-choice').textContent).toContain('You changed “Push”')
    expect(useStore.getState().S.routines[0].ex.map(x => x.id)).toEqual(['0025', '0426'])
    act(() => button(host, 'Update routine').click())
    const r = useStore.getState().S.routines[0]
    expect(r.ex.map(x => x.id)).toEqual(['0426', '0025'])
    expect(r.ex.map(x => x.weight)).toEqual([20, 60])
  })

  it('leaves the routine alone on Keep original', () => {
    startWith([{ id: '0025', rid: 'r1', sets: [set(80)] }])
    finishWorkout()
    const host = renderSummary()
    act(() => button(host, 'Keep original').click())
    expect(useStore.getState().S.routines).toHaveLength(1)
    expect(useStore.getState().S.routines[0].ex).toHaveLength(2)
    expect(host.querySelector('.routine-choice').textContent).toContain('is unchanged')
  })

  it('offers to keep a freestyle session as a routine', () => {
    startWith([{ id: '0025', sets: [set(80)] }], [])
    finishWorkout()
    const host = renderSummary()
    const input = host.querySelector('.routine-choice input')
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Legs'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    act(() => button(host, 'Save routine').click())
    const rs = useStore.getState().S.routines
    expect(rs).toHaveLength(2)
    expect(rs[1]).toMatchObject({ name: 'Legs' })
    expect(rs[1].ex.map(x => x.id)).toEqual(['0025'])
  })
})
