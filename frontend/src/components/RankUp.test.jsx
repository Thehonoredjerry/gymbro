// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { _setLangState } from '../lib/i18n-core.js'
import th from '../locales/th.js'
import RankUp from './RankUp.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root
afterEach(() => { act(() => root.unmount()); _setLangState('en', null, null, null) })

const ups = [
  { kind: 'exercise', exId: '0025', from: { tier: 'gold', division: 3 }, to: { tier: 'gold', division: 2, strengthKg: 80 } },
  { kind: 'overall', from: null, to: { tier: 'silver', division: 1 } },
  { kind: 'level', from: 1, to: 2 },
]

describe('RankUp', () => {
  it('speaks Thai, with no English copy left', () => {
    _setLangState('th', th, null, null)
    const host = document.createElement('div')
    root = createRoot(host)
    const close = vi.fn()
    act(() => root.render(<RankUp ups={ups} close={close} />))
    const text = host.textContent
    expect(text).toContain(th['Rank up!'])
    expect(text).toContain(th['Gold'] + ' II')
    expect(text).toContain(th['Level {0}'].replace('{0}', 2))
    expect(text).toContain(th['Overall rank'])
    for (const en of ['Rank up', 'Gold', 'Silver', 'Level', 'Overall', 'Continue', 'Estimated']) expect(text).not.toContain(en)
    act(() => host.querySelector('button').click())
    expect(close).toHaveBeenCalled()
  })
})
