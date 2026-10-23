import { useStore } from '../store/useStore.js'
import { t, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import { EXIDX } from '../lib/exercises.js'
import { fmtNum } from '../lib/format.js'
import { kgIn } from '../lib/ranks.js'
import RankBadge, { rankName } from './RankBadge.jsx'
import { Button } from './ui.jsx'

// The celebration after a workout that moved an exercise rank, the overall rank or the level up
// (lib/rankup.js). Closing it goes on to the usual finish summary.
export default function RankUp({ ups, close }) {
  const unit = useStore(s => s.S.unit)
  return <div className="rankup" style={{ textAlign: 'center', padding: '8px 0' }}>
    <h3 style={{ margin: '4px 0 14px' }}>{t('Rank up!')}</h3>
    {ups.map((u, i) => <div key={i} className="rankup-row">
      {u.kind === 'level'
        ? <div className="rankup-level">{t('Level {0}', u.to)}</div>
        : <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
          <RankBadge tier={u.from?.tier} division={u.from?.division} size={40} />
          <span aria-hidden="true">→</span>
          <RankBadge tier={u.to.tier} division={u.to.division} size={64} />
        </div>}
      {u.kind !== 'level' && <div style={{ fontWeight: 700, marginTop: 6 }}>{rankName(u.to)}</div>}
      <div className="small muted">
        {u.kind === 'level' ? t('Level up!')
          : u.kind === 'overall' ? t('Overall rank')
          : <><span className={exerciseNameClass(EXIDX[u.exId])}>{EXIDX[u.exId] ? exerciseNameFor(EXIDX[u.exId]) : u.exId}</span>
            {' · '}{t('Estimated 1RM')} {fmtNum(kgIn(u.to.strengthKg, unit))} {unit}</>}
      </div>
    </div>)}
    <Button variant="primary" onClick={close}>{t('Continue')}</Button>
  </div>
}
