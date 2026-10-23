// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { _setLangState } from '../lib/i18n-core.js'
import { todayISO } from '../lib/format.js'
import th from '../locales/th.js'

const m = vi.hoisted(() => ({ builtin: '', webauthn: false, passwordLogin: vi.fn(), passwordRegister: vi.fn() }))
vi.mock('../lib/server-url.js', () => ({ builtinServer: () => m.builtin }))
vi.mock('../lib/api.js', async orig => ({
  ...(await orig()),
  webauthnOK: () => m.webauthn, passwordLogin: m.passwordLogin, passwordRegister: m.passwordRegister,
}))
vi.mock('../sheets.jsx', () => ({ askAddDeviceData: vi.fn() }))
vi.mock('../components/Passkeys.jsx', () => ({ openDeviceLinkRedeem: vi.fn() }))
const { default: Welcome } = await import('./Welcome.jsx')

let host, root, signInToServer
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  m.builtin = ''; m.webauthn = false
  signInToServer = vi.fn().mockResolvedValue()
  useStore.setState(s => ({ S: { ...s.S, lang: 'en', langAuto: true, body: 'male', unit: 'kg', bodyweight: [], profileDone: false }, user: null, signInToServer }))
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); _setLangState('en', null, null, null) })

const mount = start => act(() => root.render(<Welcome start={start} />))
const buttons = () => [...host.querySelectorAll('button')]
const button = text => buttons().find(b => b.textContent.trim() === text)
const click = el => act(() => el.click())
const type = (sel, value) => {
  const el = host.querySelector(sel)
  const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set
  act(() => { set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })) })
}
const submit = async () => { await act(async () => { host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }) }
const fillCreate = () => {
  click(button('Create account'))
  type('input[name="username"]', 'Ann'); type('input[type="password"]', 'long-password-1'); type('input[name="invite"]', 'abc')
}

describe('Welcome — language', () => {
  it('offers exactly Thai and English, and Thai switches the app', async () => {
    mount('lang')
    expect(buttons().map(b => b.textContent.trim())).toEqual(['ไทย', 'English'])
    await act(async () => button('ไทย').click())
    expect(useStore.getState().S.lang).toBe('th')
    expect(useStore.getState().S.langAuto).toBe(false)
    _setLangState('th', th, null, null)   // the pack loads asynchronously in the app
    mount('account')
    expect(host.textContent).toContain(th['Sign in'])
    expect(host.textContent).not.toMatch(/Sign in|Password|Create account/)
  })
})

describe('Welcome — account on the phone app', () => {
  beforeEach(() => { m.builtin = 'https://gym.test' })
  it('creates an account with an invite and goes on to the profile', async () => {
    mount('account')
    fillCreate()
    await submit()
    expect(signInToServer).toHaveBeenCalledWith({ create: true, name: 'Ann', password: 'long-password-1', code: 'ABC' }, expect.any(Function))
    expect(host.querySelector('input[name="bodyweight"]')).toBeTruthy()
  })
  it('a bad invite says so in Thai and stays put', async () => {
    _setLangState('th', th, null, null)
    signInToServer.mockRejectedValue(Object.assign(new Error('x'), { status: 403, data: { code: 'invite' } }))
    mount('account')
    click(button(th['Create account']))
    type('input[name="username"]', 'Ann'); type('input[type="password"]', 'long-password-1'); type('input[name="invite"]', 'abc')
    await submit()
    expect(host.textContent).toContain(th['That invite code is not valid.'])
    expect(host.querySelector('input[name="bodyweight"]')).toBeFalsy()
  })
  it('a wrong password, and an unreachable server', async () => {
    mount('account')
    signInToServer.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 401, data: { code: 'bad-credentials' } }))
    type('input[name="username"]', 'Ann'); type('input[type="password"]', 'nope-nope-nope')
    await submit()
    expect(host.textContent).toContain('Wrong name, e-mail or password.')
    signInToServer.mockRejectedValueOnce(Object.assign(new Error('Could not reach gym.test. Check the address and that this phone can reach it.'), { code: 'unreachable' }))
    await submit()
    expect(host.textContent).toContain('Could not reach gym.test.')
  })
})

describe('Welcome — account on the web', () => {
  it('signs in with the cookie routes', async () => {
    m.passwordLogin.mockResolvedValue({ id: 'u1', name: 'Ann' })
    const adoptProfile = vi.fn().mockResolvedValue()
    useStore.setState({ adoptProfile })
    mount('account')
    type('input[name="username"]', 'Ann'); type('input[type="password"]', 'long-password-1')
    await submit()
    expect(m.passwordLogin).toHaveBeenCalledWith('Ann', 'long-password-1')
    expect(signInToServer).not.toHaveBeenCalled()
    expect(useStore.getState().user).toMatchObject({ name: 'Ann' })
  })
  it('offers the passkey only where the browser has one', () => {
    mount('account')
    expect(button('Sign in with passkey')).toBeFalsy()
    act(() => root.unmount()); root = createRoot(host)
    m.webauthn = true
    mount('account')
    expect(button('Sign in with passkey')).toBeTruthy()
  })
})

describe('Welcome — profile', () => {
  it('saves body type, today’s body weight and marks the profile done', async () => {
    useStore.setState({ user: { id: 'u1', name: 'Ann' } })
    mount('profile')
    expect(host.textContent).toContain('Ann')
    click(button('Female'))
    type('input[name="bodyweight"]', '72.5')
    await submit()
    const S = useStore.getState().S
    expect(S.bodyweight.at(-1)).toMatchObject({ d: todayISO(), w: 72.5 })
    expect(S.body).toBe('female')
    expect(S.profileDone).toBe(true)
  })
})
