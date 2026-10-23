// The rank-up screen's diff (GymBro): what went up between the progress before a workout was
// saved and after it. Ranks and levels are derived from history (lib/ranks.js, lib/xp.js), so a
// snapshot is just their numbers; a rank that went down is never reported.
import { allRanks, overallRank, rankFor, fromPoints } from './ranks.js'
import { totalXp, levelOf } from './xp.js'

export function progressSnapshot(S, opts = {}) {
  return {
    ranks: Object.fromEntries(allRanks(S, opts).map(r => [r.exId, r.points])),
    overall: overallRank(S, opts)?.points || 0,
    level: levelOf(totalXp(S)).level,
  }
}

/** Each exercise rank, overall rank and level that went up; `from` is null for a first rank. */
export function rankUps(before, after, S, opts = {}) {
  const ups = []
  for (const [exId, points] of Object.entries(after.ranks)) {
    const was = before.ranks[exId] || 0
    if (points > was) ups.push({ kind: 'exercise', exId, from: was ? fromPoints(was) : null, to: rankFor(S, exId, opts) })
  }
  if (after.overall > before.overall) ups.push({ kind: 'overall', from: before.overall ? fromPoints(before.overall) : null, to: overallRank(S, opts) })
  if (after.level > before.level) ups.push({ kind: 'level', from: before.level, to: after.level })
  return ups
}
