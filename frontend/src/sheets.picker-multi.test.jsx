// @vitest-environment happy-dom
// GymBro: adding exercises is a bulk pick. With `onPickMany` the picker ticks rows instead of
// adding them one by one, counts them on one button ("Add 2 exercises") and hands them over
// together, in the order they were ticked.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exercisePicker } from './sheets.jsx'

const mounted = []

function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

const rowButtons = host => [...host.querySelectorAll('.list .item button[aria-label]')]
const addAll = host => host.querySelector('.picker-multi-bar button.primary, .picker-multi-bar .btn-primary, .picker-multi-bar button:last-child')
const bar = host => host.querySelector('.picker-multi-bar')

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: structuredClone(DEF), user: null })
  document.body.innerHTML = ''
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('exercise picker, many at once', () => {
  it('ticks rows and adds them together, in the order they were ticked', () => {
    const onPick = vi.fn(), onPickMany = vi.fn()
    exercisePicker(onPick, { onPickMany })
    const host = renderTop()
    expect(bar(host)).toBeNull()
    const [a, b] = rowButtons(host)
    act(() => b.click())
    act(() => a.click())
    expect(bar(host).textContent).toContain('Add 2 exercises')
    expect(a.getAttribute('aria-pressed')).toBe('true')
    act(() => addAll(host).click())
    expect(onPick).not.toHaveBeenCalled()
    expect(onPickMany).toHaveBeenCalledTimes(1)
    const picked = onPickMany.mock.calls[0][0].map(e => e.id)
    expect(picked).toHaveLength(2)
    expect(new Set(picked).size).toBe(2)
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('unticks a row tapped again, so nothing is added twice', () => {
    exercisePicker(vi.fn(), { onPickMany: vi.fn() })
    const host = renderTop()
    const [a, b] = rowButtons(host)
    act(() => a.click()); act(() => b.click()); act(() => a.click())
    expect(bar(host).textContent).toContain('Add 1 exercise')
    expect(a.getAttribute('aria-pressed')).toBe('false')
  })

  it('clears the whole selection', () => {
    exercisePicker(vi.fn(), { onPickMany: vi.fn() })
    const host = renderTop()
    const [a, b] = rowButtons(host)
    act(() => a.click()); act(() => b.click())
    const clear = [...bar(host).querySelectorAll('button')].find(x => x.textContent.trim() === 'Clear')
    act(() => clear.click())
    expect(bar(host)).toBeNull()
  })

  it('still adds one at a time without onPickMany', () => {
    const onPick = vi.fn()
    exercisePicker(onPick)
    const host = renderTop()
    act(() => rowButtons(host)[0].click())
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(bar(host)).toBeNull()
  })
})
