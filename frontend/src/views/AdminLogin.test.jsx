// @vitest-environment happy-dom
// GymBro's website is only the admin panel: one password field, sent to /api/admin/login.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminLogin from './AdminLogin.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ calls: [], answer: null, fail: null, setUser: null }))
vi.mock('../lib/api.js', () => ({
  api: (path, opts) => {
    mocks.calls.push({ path, body: JSON.parse(opts.body) })
    return mocks.fail ? Promise.reject(mocks.fail) : Promise.resolve(mocks.answer)
  }
}))
vi.mock('../store/useStore.js', () => {
  const snap = () => ({ setUser: mocks.setUser })
  const useStore = selector => selector ? selector(snap()) : snap()
  useStore.getState = snap
  return { useStore }
})

let host, root
const type = value => {
  const el = host.querySelector('input[type="password"]')
  const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set
  act(() => { set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })) })
}
const submit = async () => {
  await act(async () => { host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  await act(() => new Promise(r => setTimeout(r, 0)))
}

beforeEach(() => {
  mocks.calls.length = 0; mocks.fail = null; mocks.setUser = vi.fn()
  mocks.answer = { user: { id: 'p', name: 'Admin', admin: true } }
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<AdminLogin />))
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('admin sign-in page', () => {
  it('has one labelled password field and nothing about accounts', () => {
    const input = host.querySelector('input[type="password"]')
    expect(input).not.toBeNull()
    expect(host.querySelector(`label[for="${input.id}"]`)).not.toBeNull()
    expect(host.textContent).not.toMatch(/create account|passkey/i)
  })

  it('sends the password and signs in with the account it returns', async () => {
    type('open sesame 42')
    await submit()
    expect(mocks.calls).toEqual([{ path: '/api/admin/login', body: { password: 'open sesame 42' } }])
    expect(mocks.setUser).toHaveBeenCalledWith({ id: 'p', name: 'Admin', admin: true })
  })

  it('says the password is wrong, next to the field', async () => {
    mocks.fail = Object.assign(new Error('wrong name or password'), { status: 401 })
    type('nope nope')
    await submit()
    expect(host.querySelector('[role="alert"]').textContent).toBe('That password isn’t right.')
    expect(mocks.setUser).not.toHaveBeenCalled()
  })
})
