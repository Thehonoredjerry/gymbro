import { t } from '../lib/i18n.js'

const TIER_NAME = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', diamond: 'Diamond', champion: 'Champion' }
const ROMAN = { 1: 'I', 2: 'II', 3: 'III' }

/** A strength rank's name in the reader's language: "Gold II", "Champion", "Unranked". */
export const rankName = r => r?.tier ? t(TIER_NAME[r.tier]) + (r.division ? ' ' + ROMAN[r.division] : '') : t('Unranked')

// A tier-coloured shield with its division; no rank (a first rank's "before") shows a dash.
export default function RankBadge({ tier, division, size = 56 }) {
  return <span className={'rank-badge rank-' + (tier || 'none')} style={{ '--rb': size + 'px' }} role="img" aria-label={rankName({ tier, division })}>
    {tier ? (ROMAN[division] || '★') : '–'}
  </span>
}
