// Thai is a first-class language in GymBro: every string the friends-app screens added (welcome,
// ranks, levels, rank-up, the empty-start rule) has a real Thai translation, not the English
// copy the hidden packs carry.
import { describe, expect, it } from 'vitest'
import th from '../locales/th.js'

const NEW_KEYS = [
  'Enter reps first',
  'Rank up!', 'Level {0}', 'Level up!', 'Overall rank', 'Unranked',
  'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Champion',
  'Ranks', '{0} / {1} XP', 'Unranked — rank three exercises', 'Log your body weight to get ranks', 'next tier at {0}',
  'Machine ranks are approximate — machines differ between gyms.',
  'Create account', 'Enter your body weight.', 'Hi, {0}!', 'Get a nudge when your rest is over.', 'Turn on', 'optional',
]
// Nothing to translate beyond placeholders, numbers and the "XP" unit.
const untranslatable = k => /^[\s\d{}/XP]*$/.test(k)
const placeholders = s => (s.match(/\{\d+\}/g) || []).sort()

describe('Thai for the new screens', () => {
  it.each(NEW_KEYS)('%s', key => {
    const v = th[key]
    expect(v, 'missing').toBeTruthy()
    expect(v.trim()).not.toBe('')
    if (!untranslatable(key)) expect(v).not.toBe(key)
    expect(placeholders(v)).toEqual(placeholders(key))
  })
})
