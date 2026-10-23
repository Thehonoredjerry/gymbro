// @vitest-environment happy-dom
// GymBro translates the interface only: exercise names stay English in every language.
import { describe, expect, it } from 'vitest'
import { setLang, exerciseNameFor, t } from './i18n.js'

describe('Thai interface, English exercises', () => {
  it('translates the UI but not the exercise name', async () => {
    await setLang('th')
    expect(t('By muscle')).toBe('ตามกล้ามเนื้อ')
    expect(exerciseNameFor({ id: '1001', n: 'band single leg split squat' })).toBe('band single leg split squat')
  })
})
