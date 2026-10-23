import { t, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import { EXIDX } from '../lib/exercises.js'
import { fmtNum } from '../lib/format.js'
import { allRanks, overallRank, kgIn } from '../lib/ranks.js'
import { totalXp, levelOf } from '../lib/xp.js'
import { bodyweightKgOf } from '../lib/structuralBalance.js'
import { bwSheet } from '../sheets.jsx'
import RankBadge, { rankName } from './RankBadge.jsx'
import { Button } from './ui.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'

// Home's level card: the level, a bar through it, and the overall rank beside it.
export function LevelCard({ S, onClick }) {
  const lv = levelOf(totalXp(S)), overall = overallRank(S)
  const pct = Math.round(lv.progress * 100)
  return <div className="card tappable" style={{ cursor: 'pointer' }} {...tappable(onClick)}>
    <div className="row" style={{ gap: 12 }}>
      <RankBadge tier={overall?.tier} division={overall?.division} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row between" style={{ alignItems: 'baseline' }}>
          <div className="ttl" style={{ fontWeight: 700 }}>{t('Level {0}', lv.level)}</div>
          <div className="small muted">{t('{0} / {1} XP', lv.intoLevel, lv.forNext)}</div>
        </div>
        <div className="level-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: pct + '%' }} /></div>
        <div className="small muted" style={{ marginTop: 4 }}>{overall ? rankName(overall) : t('Unranked — rank three exercises')}</div>
      </div>
    </div>
  </div>
}

// Stats' Ranks section: the overall rank, then every ranked exercise with what the next tier needs.
export function RanksCard({ S }) {
  if (!bodyweightKgOf(S)) return <div className="card">
    <h2>{t('Ranks')}</h2>
    <div className="muted small" style={{ marginBottom: 10 }}>{t('Log your body weight to get ranks')}</div>
    <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
  </div>
  const ranks = allRanks(S), overall = overallRank(S)
  return <div className="card">
    <h2>{t('Ranks')}</h2>
    <div className="row" style={{ gap: 10, marginBottom: 8 }}>
      <RankBadge tier={overall?.tier} division={overall?.division} size={48} />
      <div>
        <div className="lbl2">{t('Overall rank')}</div>
        <div className="ttl" style={{ fontWeight: 700 }}>{overall ? rankName(overall) : t('Unranked — rank three exercises')}</div>
      </div>
    </div>
    {ranks.map(r => <div key={r.exId} className="rank-row row" style={{ gap: 10 }}>
      <RankBadge tier={r.tier} division={r.division} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className={exerciseNameClass(EXIDX[r.exId])}>{EXIDX[r.exId] ? exerciseNameFor(EXIDX[r.exId]) : r.exId}</div>
        <div className="small muted">
          {rankName(r)} · {fmtNum(kgIn(r.strengthKg, S.unit))} {S.unit}
          {r.nextKg != null && <> · {t('next tier at {0}', fmtNum(kgIn(r.nextKg, S.unit)) + ' ' + S.unit)}</>}
        </div>
      </div>
    </div>)}
  </div>
}
