// @vitest-environment happy-dom
// GymBro: Home leads with the two ways to train — an empty workout right now, or one of your
// routines — before anything else on the page.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { startFlow, chooseRoutineSheet } from '../sheets.jsx'
import Home from './Home.jsx'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(), chooseRoutineSheet: vi.fn(),
}))

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  nav.mockClear(); startFlow.mockClear(); chooseRoutineSheet.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const setS = (over = {}) => useStore.setState(s => ({ S: { ...s.S, routines: [], dayPlan: {}, workouts: [], active: null, week: {}, ...over }, user: null }))
const mount = () => act(() => root.render(<Home />))
const btn = text => [...host.querySelectorAll('.quick-start button')].find(b => b.textContent.includes(text))
const click = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

describe('Home quick start', () => {
  it('starts an empty workout in one tap', () => {
    setS(); mount()
    click(btn('Empty workout'))
    expect(startFlow).toHaveBeenCalledWith([])
  })

  it('opens the routine chooser', () => {
    setS(); mount()
    click(btn('Choose routine'))
    expect(chooseRoutineSheet).toHaveBeenCalled()
    expect(startFlow).not.toHaveBeenCalled()
  })

  it('makes way for the session already running', () => {
    setS({ active: { id: 'a', name: 'Push', entries: [], cur: 0 } }); mount()
    expect(host.querySelector('.quick-start')).toBeNull()
  })
})
