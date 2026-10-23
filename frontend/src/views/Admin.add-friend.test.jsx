// @vitest-environment happy-dom
// GymBro admin: "Add a friend" either mints an invite code (with a note, and a message ready to
// send) or creates the account directly with a starting password shown once.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Admin from './Admin.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ calls: [], answers: {}, fail: {} }))
vi.mock('../lib/api.js', () => ({
  api: (path, opts) => {
    const key = path.split('?')[0]
    mocks.calls.push({ key, body: opts?.body ? JSON.parse(opts.body) : null })
    if (key in mocks.fail) return Promise.reject(mocks.fail[key])
    return key in mocks.answers ? Promise.resolve(mocks.answers[key]) : Promise.reject(new Error('not found'))
  }
}))
vi.mock('../store/useStore.js', () => {
  const snap = () => ({ user: { id: 'adm', name: 'Admin', admin: true }, S: {} })
  const useStore = selector => selector ? selector(snap()) : snap()
  useStore.getState = snap
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: () => {}, openSheet: () => {} })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({ confirmSheet: vi.fn() }))

let host, root
const settle = () => act(() => new Promise(r => setTimeout(r, 0)))
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const type = (sel, value) => {
  const el = host.querySelector(sel)
  const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set
  act(() => { set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })) })
}
const submit = async sel => { await act(async () => { host.querySelector(sel).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await settle() }

beforeEach(async () => {
  mocks.calls.length = 0; mocks.fail = {}
  mocks.answers = {
    '/api/admin/users': { users: [], invite_only: true },
    '/api/admin/invites': { invites: [] },
    '/api/admin/audit': { enabled: false },
    '/api/admin/invites/new': { invite: { code: 'AB12CD34EF56AB78', note: 'Somchai' } },
    '/api/admin/users/new': { user: { id: 'n1', name: 'Somchai' } },
  }
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<Admin />))
  await settle()
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('Add a friend', () => {
  it('makes an invite code with a note and a message ready to send', async () => {
    type('form.adm-invite input[name="note"]', 'Somchai')
    await submit('form.adm-invite')
    expect(mocks.calls.find(c => c.key === '/api/admin/invites/new').body).toEqual({ note: 'Somchai' })
    const out = host.querySelector('.adm-new')
    expect(out.textContent).toContain('AB12CD34EF56AB78')
    expect(out.querySelector('textarea').value).toContain('AB12CD34EF56AB78')
    expect(out.querySelector('textarea').value).toContain('GymBro app')   // the website is only the admin panel
  })

  it('creates an account directly and shows the sign-in details once', async () => {
    act(() => button('Create account').click())
    type('form.adm-create input[name="name"]', 'Somchai')
    act(() => button('Generate').click())
    const pw = host.querySelector('form.adm-create input[name="password"]').value
    expect(pw.length).toBeGreaterThanOrEqual(12)
    await submit('form.adm-create')
    expect(mocks.calls.find(c => c.key === '/api/admin/users/new').body).toEqual({ name: 'Somchai', password: pw })
    const out = host.querySelector('.adm-new')
    expect(out.textContent).toContain('Somchai')
    expect(out.querySelector('textarea').value).toContain(pw)
    expect(mocks.calls.filter(c => c.key === '/api/admin/users').length).toBeGreaterThan(1)   // the list reloads
  })

  it('says why the server refused, next to the form', async () => {
    mocks.fail['/api/admin/users/new'] = Object.assign(new Error('another profile already signs in with this name'), { status: 409, data: { code: 'name-taken' } })
    act(() => button('Create account').click())
    type('form.adm-create input[name="name"]', 'Taken')
    type('form.adm-create input[name="password"]', 'correct horse battery')
    await submit('form.adm-create')
    expect(host.querySelector('form.adm-create [role="alert"]').textContent).toContain('That name is already taken')
    expect(host.querySelector('.adm-new')).toBeNull()
  })
})
