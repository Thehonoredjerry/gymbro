// #303: an instance-wide default language, and the browser's, apply only to a copy nobody has
// picked a language for — never to an existing profile, whose `lang: 'en'` may be a choice.
import { describe, expect, it } from 'vitest'
import { matchLocale, autoLang } from './default-lang.js'

describe('matchLocale', () => {
  it('matches the full tag first, in any case or separator', () => {
    expect(matchLocale('th')).toBe('th')
    expect(matchLocale('th_TH')).toBe('th')
    expect(matchLocale(' TH-th ')).toBe('th')
  })
  it('falls back to the base language, and to nothing for one the app does not have', () => {
    expect(matchLocale('en-AU')).toBe('en')
    expect(matchLocale('en-US')).toBe('en')
    expect(matchLocale('pt')).toBe(null)
    expect(matchLocale('nl-NL')).toBe(null)
    expect(matchLocale('')).toBe(null)
    expect(matchLocale(undefined)).toBe(null)
  })
})

describe('autoLang', () => {
  const fresh = { lang: 'en', langAuto: true }
  it('leaves a copy alone that chose, or that predates the mark', () => {
    expect(autoLang({ lang: 'en' }, { default_lang: 'pt-BR' }, ['de-DE'])).toBe(null)
    expect(autoLang({ lang: 'en', langAuto: false }, { default_lang: 'pt-BR' }, ['de-DE'])).toBe(null)
  })
  it('puts DEFAULT_LANG before the browser, the browser before English', () => {
    expect(autoLang(fresh, { default_lang: 'th' }, ['de-DE'])).toBe('th')
    expect(autoLang(fresh, {}, ['nl-NL', 'en-US'])).toBe('en')
    expect(autoLang(fresh, {}, ['nl-NL'])).toBe('en')
    expect(autoLang(fresh, { default_lang: 'xx' }, ['th-TH'])).toBe('th')
  })
})

describe('only Thai and English are offered', async () => {
  const { ACTIVE_LANGS } = await import('./i18n-core.js')
  const { matchLocale: match, autoLang: auto } = await import('./default-lang.js')
  it('lists exactly Thai and English', () => {
    expect(ACTIVE_LANGS).toEqual(['th', 'en'])
  })
  it('matches a browser language only when it is one of them', () => {
    expect(match('th-TH')).toBe('th')
    expect(match('en-GB')).toBe('en')
    expect(match('de-DE')).toBe(null)
    expect(match('pt-BR')).toBe(null)
  })
  it('a fresh copy in a German browser that also lists Thai opens in Thai, otherwise English', () => {
    expect(auto({ langAuto: true }, {}, ['de-DE', 'th'])).toBe('th')
    expect(auto({ langAuto: true }, {}, ['de-DE'])).toBe('en')
  })
})
