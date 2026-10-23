// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { _setLangState } from '../lib/i18n-core.js'
import th from '../locales/th.js'
import Home from './Home.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '',
}))

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); _setLangState('en', null, null, null) })

// Nine set-less workouts on one day: 9 × 50 = 450 XP, no streak bonus — level 3 (300…600).
const workouts = Array.from({ length: 9 }, (_, i) => ({ id: 'w' + i, d: '2026-01-05', start: Date.parse('2026-01-05T10:00:00'), entries: [] }))
const mount = () => {
  useStore.setState(s => ({ S: { ...s.S, routines: [], workouts, bodyweight: [], dayPlan: {}, week: {}, active: null }, user: null }))
  act(() => root.render(<Home />))
}

describe('Home level card', () => {
  it('shows the level and how far into it', () => {
    mount()
    expect(host.textContent).toContain('Level 3')
    expect(host.textContent).toContain('150 / 300 XP')
    expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('50')
  })
  it('in Thai', () => {
    _setLangState('th', th, null, null)
    mount()
    expect(host.textContent).toContain(th['Level {0}'].replace('{0}', 3))
    expect(host.textContent).not.toContain('Level')
  })
})
