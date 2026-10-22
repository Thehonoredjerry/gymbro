// @vitest-environment happy-dom
// /api/config is what tells a client what the server offers (invite-only signup, guest mode).
// loadConfig() caches it for a boot; refreshConfig() always asks, because the admin may have
// changed the instance since boot.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn() }))

import { api } from '../lib/api.js'
import { useStore } from './useStore.js'

beforeEach(() => { api.mockReset(); useStore.setState({ config: null }) })
afterEach(() => { useStore.setState({ config: null }) })

describe('server config', () => {
  it('loadConfig fetches once and then answers from the cache', async () => {
    api.mockResolvedValue({ invite_only: true, allow_guest: false })
    expect(await useStore.getState().loadConfig()).toEqual({ invite_only: true, allow_guest: false })
    expect(await useStore.getState().loadConfig()).toMatchObject({ invite_only: true })
    expect(api).toHaveBeenCalledTimes(1)
    expect(api).toHaveBeenCalledWith('/api/config')
  })

  it('refreshConfig always asks the server, so a change after boot is seen', async () => {
    api.mockResolvedValueOnce({ invite_only: true, allow_guest: false })
    await useStore.getState().loadConfig()
    expect(useStore.getState().config.invite_only).toBe(true)

    api.mockResolvedValueOnce({ invite_only: false, allow_guest: false })
    await useStore.getState().refreshConfig()
    expect(useStore.getState().config.invite_only).toBe(false)
    expect(api).toHaveBeenCalledTimes(2)
  })

  it('two callers asking at once make one request', async () => {
    // Signing in re-asks and the pairing flow awaits a refresh of its own right after it, so
    // both used to go out. It is one answer.
    api.mockResolvedValue({ invite_only: false, allow_guest: true })
    const [a, b] = await Promise.all([useStore.getState().refreshConfig(), useStore.getState().refreshConfig()])
    expect(api).toHaveBeenCalledTimes(1)
    expect(a).toEqual(b)

    // Not a cache, though: the next caller gets a fresh answer.
    await useStore.getState().refreshConfig()
    expect(api).toHaveBeenCalledTimes(2)
  })

  it('an unreachable server leaves the cached config alone', async () => {
    useStore.setState({ config: { invite_only: true } })
    api.mockRejectedValueOnce(new Error('offline'))
    expect(await useStore.getState().refreshConfig()).toBeNull()
    expect(useStore.getState().config.invite_only).toBe(true)
  })
})
