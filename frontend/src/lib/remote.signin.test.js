import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ passwordAt: vi.fn(), setRemoteAuth: vi.fn(), saveRemoteFile: vi.fn() }))
vi.mock('./api.js', () => ({ passwordAt: m.passwordAt, setRemoteAuth: m.setRemoteAuth, pairRedeem: vi.fn() }))
vi.mock('./mobile.js', () => ({ saveRemoteFile: m.saveRemoteFile, loadRemoteFile: vi.fn() }))
vi.mock('./cf-access.js', () => ({ clearCfAccess: vi.fn() }))
const { signInWithPassword } = await import('./remote.js')

const BASE = 'https://gym.test'
const user = { id: 'u1', name: 'Ann' }
beforeEach(() => { vi.clearAllMocks(); m.passwordAt.mockResolvedValue({ token: 'tok', user }) })

describe('signInWithPassword', () => {
  it('creates an account on the register route and keeps the token', async () => {
    expect(await signInWithPassword(BASE, { create: true, name: 'Ann', password: 'pw-long-enough', code: 'ABC' })).toEqual({ token: 'tok', user })
    expect(m.passwordAt).toHaveBeenCalledWith(BASE, '/api/register/password', { name: 'Ann', password: 'pw-long-enough', code: 'ABC' })
    expect(m.setRemoteAuth).toHaveBeenCalledWith(BASE, 'tok')
    expect(m.saveRemoteFile).toHaveBeenCalledWith({ mode: 'remote', base: BASE, token: 'tok', user })
  })
  it('signs in on the login route', async () => {
    await signInWithPassword(BASE, { create: false, name: 'Ann', password: 'pw' })
    expect(m.passwordAt).toHaveBeenCalledWith(BASE, '/api/login/password', { name: 'Ann', password: 'pw' })
  })
  it('saves nothing when the server refuses', async () => {
    m.passwordAt.mockRejectedValue(Object.assign(new Error('nope'), { status: 401 }))
    await expect(signInWithPassword(BASE, { name: 'Ann', password: 'x' })).rejects.toThrow('nope')
    expect(m.saveRemoteFile).not.toHaveBeenCalled()
  })
})
