// @vitest-environment happy-dom
// GymBro: the colours people can choose go past the accent — the whole background can be black,
// and "Black & white" is an accent like the others (white buttons on black, black on white).
import { describe, expect, it } from 'vitest'
import { applyPalette, paletteKey, themeColor } from './accent.js'
import { ACCENTS, ACCENT_INK, ACCENT_NAMES } from './format.js'
import { DEF } from '../store/useStore.js'

const el = () => ({ dataset: {} })

describe('background palette', () => {
  it('is black unless dusk was picked, whatever else is stored', () => {
    expect(paletteKey({})).toBe('black')
    expect(paletteKey({ palette: 'dusk' })).toBe('dusk')
    expect(paletteKey({ palette: 'url(x)' })).toBe('black')
  })

  it('marks the page for black and clears the mark for dusk', () => {
    const de = el()
    applyPalette(de, 'black')
    expect(de.dataset.palette).toBe('black')
    applyPalette(de, 'dusk')
    expect('palette' in de.dataset).toBe(false)
  })

  it('tints the browser bar to match', () => {
    expect(themeColor('dusk', 'dark')).toBe('#15122a')
    expect(themeColor('dusk', 'light')).toBe('#f5f2fc')
    expect(themeColor('black', 'dark')).toBe('#000000')
    expect(themeColor('black', 'light')).toBe('#f2f2f2')
  })
})

describe('black & white accent', () => {
  it('is a preset with its name and its ink', () => {
    expect(ACCENTS.mono).toBeDefined()
    expect(ACCENT_NAMES.mono).toBe('Black & white')
    expect(ACCENT_INK.mono).toBe('#0a0a0a')
  })

  it('is what a new profile starts with', () => {
    expect(DEF.accent).toBe('mono')
  })
})
