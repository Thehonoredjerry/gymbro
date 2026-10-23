import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { fmtDate, fmtNum, fmtVol, fmtDur } from '../lib/format.js'
import { auditCat, auditLine, fmtWhen } from '../lib/audit.js'
import { workoutVolume, setsDone } from '../lib/history.js'
import { confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Segmented } from '../components/ui.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'
import '../admin.css'

// Admin-only operator dashboard (owner passkey + admin flag; guarded again server-side).
// Deliberately English-only — it isn't part of the translated end-user surface, so it stays
// out of the per-language string packs.
//
// One page of cards, each opening with a sentence that says what it is for. An operator who
// looks at this twice a year should not have to remember what "synced 3d ago" or an invite
// code means.

const rel = ts => {
  if (!ts) return 'never'
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + ' min ago'
  if (s < 86400) return Math.floor(s / 3600) + ' h ago'
  return Math.floor(s / 86400) + ' d ago'
}
const dur = ms => { const m = Math.max(0, Math.floor(ms / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min' }

// The one time the reset code is visible. Locked, so a tap beside the sheet cannot lose it
// before it has been copied or written down.
function ResetCodeSheet({ name, email, code, expires, close }) {
  const toast = useUI(s => s.toast)
  const copy = () => { navigator.clipboard?.writeText(code).catch(() => {}); toast('Copied') }
  return <>
    <h3>Reset code for {name}</h3>
    <div className="adm-lead">Give them this code. They choose “Sign in with password” → “Have a reset code from your admin?”, enter their name <b>{name}</b>{email && <> (or their sign-in e-mail <b>{email}</b>)</>}, the code and a new password. It works once, until {new Date(expires).toLocaleString()}, and will not be shown again.</div>
    <button className="adm-code" style={{ fontSize: 22, width: '100%', padding: '14px 0' }} onClick={copy} aria-label="copy code">{code}</button>
    <div style={{ height: 12 }} />
    <Button variant="primary" onClick={close}>Done</Button>
  </>
}

function UserDetail({ id, onChanged, close }) {
  const [d, setD] = useState(null)
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  useEffect(() => { api('/api/admin/user?id=' + encodeURIComponent(id)).then(setD).catch(e => toast(e.message)) }, [id])
  if (!d) return <div className="muted small">Loading…</div>
  const u = d.user
  // The document comes straight off the user's state file. PUT /api/data drops null and
  // shapeless entries now, but a file written before it did still answers with them, and this
  // sheet renders outside the route's ErrorBoundary: one throw here blanked the whole app and
  // left exactly this account un-disableable. setsDone/workoutVolume walk entries and sets, so
  // an entry that lacks either has nothing to show and is skipped rather than drawn.
  const workouts = (d.workouts || []).filter(w => w && Array.isArray(w.entries) && w.entries.every(e => e && Array.isArray(e.sets)))
  // Their whole record as the admin API already returns it — the export the delete sheet offers.
  const exportUser = () => {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `gymbro-${u.name.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()}-${u.id}.json`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const doDelete = () => {
    api('/api/admin/user/delete', { method: 'POST', body: JSON.stringify({ id: u.id }) })
      .then(() => { toast('Account deleted'); onChanged(); close() })
      .catch(e => toast(e.message))
  }
  const setDisabled = disabled => {
    api('/api/admin/user/disable', { method: 'POST', body: JSON.stringify({ id: u.id, disabled }) })
      .then(() => { toast(disabled ? 'User disabled' : 'User enabled'); onChanged(); close() })
      .catch(e => toast(e.message))
  }
  // Password sign-in (#118): the server only sends `password` when the instance offers it. The
  // code comes back once, is shown once, and is never stored anywhere but as a hash.
  const pwInstance = typeof u.password === 'boolean'
  const resetPassword = () => confirmSheet({
    title: 'Reset ' + u.name + '’s password?',
    message: 'You get a one-time code to hand them. Their current password stops working now and they are signed out everywhere; their passkeys keep working. They set a new password with the code under “Sign in with password”. It is shown once and is valid for 24 hours.',
    confirmText: 'Create reset code',
    danger: true,
    onConfirm: () => api('/api/admin/user/password-reset', { method: 'POST', body: JSON.stringify({ id: u.id }) })
      .then(r => { onChanged(); close(); openSheet(done => <ResetCodeSheet name={r.name} email={u.email} code={r.code} expires={r.expires} close={done} />, { locked: true }) })
      .catch(e => toast(e.message)),
  })
  return <>
    <h3 className="capitalize">{u.name}</h3>
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '8px 0 12px' }}>
      {u.admin && <span className="adm-pill acc">admin</span>}
      {u.disabled && <span className="adm-pill bad">disabled</span>}
      {u.invitedBy && <span className="adm-pill">invite {u.invitedBy}</span>}
      {u.password && <span className="adm-pill">password</span>}
      {/* The sign-in e-mail (password instances only): shown to admins and nobody else. */}
      {u.email && <span className="adm-pill" title="sign-in e-mail">{u.email}</span>}
      {u.resetUntil && <span className="adm-pill acc">reset code until {new Date(u.resetUntil).toLocaleString()}</span>}
      <span className="adm-pill">joined {u.created ? fmtDate(u.created.slice(0, 10)) : '–'}</span>
    </div>
    <div className="tiles" style={{ textAlign: 'start' }}>
      <div className="tile"><div className="l">Workouts</div><div className="v" style={{ fontSize: '1.1rem' }}>{workouts.length}</div></div>
      <div className="tile"><div className="l">Weigh-ins</div><div className="v" style={{ fontSize: '1.1rem' }}>{d.bodyweight.length}</div></div>
      <div className="tile"><div className="l">Measurements</div><div className="v" style={{ fontSize: '1.1rem' }}>{(d.measurements || []).length}</div></div>
      <div className="tile"><div className="l">Routines</div><div className="v" style={{ fontSize: '1.1rem' }}>{d.routines.length}</div></div>
      <div className="tile"><div className="l">Last sync</div><div className="v" style={{ fontSize: '.95rem' }}>{rel(d.lastSync)}</div></div>
    </div>
    {!u.admin && <>
      <button className={'btn ' + (u.disabled ? 'primary' : 'danger')} style={{ margin: '12px 0 4px' }}
        onClick={() => u.disabled ? setDisabled(false)
          : confirmSheet({ title: 'Disable ' + u.name + '?', message: 'They are signed out everywhere and can no longer sync or log in until re-enabled. Their data stays.', confirmText: 'Disable', danger: true, onConfirm: () => setDisabled(true) })}>
        {u.disabled ? 'Enable account' : 'Disable account'}</button>
      <div className="adm-hint">{u.disabled ? 'Enabling lets them sign in and sync again.' : 'Disabling signs them out everywhere and blocks sign-in. Nothing is deleted.'}</div>
      {/* The one destructive action in the app (issue #107), so it asks twice and offers the
          export first — that history is theirs. The second step names the account again, because
          the first sheet can be dismissed by anyone who was not reading. */}
      <button className="btn danger" style={{ margin: '14px 0 4px' }}
        onClick={() => confirmSheet({
          title: 'Delete ' + u.name + '?',
          message: 'Everything goes: their workouts, weigh-ins, routines, passkeys and notifications. This cannot be undone, and the invite code they joined with stays used. Download their data first if they might want it.',
          confirmText: 'Continue',
          danger: true,
          onConfirm: () => confirmSheet({
            title: 'Delete ' + u.name + ' for good?',
            message: 'Last chance. There’s no undo and no backup of this on the server.',
            confirmText: 'Delete account',
            danger: true,
            onConfirm: doDelete,
          }),
        })}>Delete account</button>
      <button className="btn" style={{ marginBottom: 4 }} onClick={exportUser}>Download their data</button>
      <div className="adm-hint">Deleting removes the account and every trace of its training history from this server.</div>
      {pwInstance && <>
        <button className="btn" style={{ margin: '14px 0 4px' }} onClick={resetPassword}>Reset password</button>
        <div className="adm-hint">{u.password
          ? 'For a forgotten password: a one-time code lets them choose a new one. Their current password stops working at once.'
          : 'No password yet. A one-time code lets them set one. That’s the way back in after losing their only passkey.'}</div>
      </>}
    </>}
    <h4 className="sec">Workout history</h4>
    {workouts.length ? <div className="list" style={{ gap: 0 }}>
      {workouts.slice(0, 60).map(w => <div key={w.id} className="row between" style={{ padding: '9px 2px', borderBottom: '1px solid var(--sep)' }}>
        <div><div className="small" style={{ fontWeight: 600 }}>{w.name}</div>
          <div className="dim" style={{ fontSize: '.72rem' }}>{fmtDate(w.d, true)} · {fmtDur((w.end || w.start) - w.start)} · {setsDone(w)} sets{w.prs?.length ? ' · ' + w.prs.length + ' PR' : ''}</div></div>
        <span className="small muted">{fmtVol(w.vol ?? workoutVolume(w), d.unit)}</span>
      </div>)}
    </div> : <div className="adm-empty">No workouts logged.</div>}
  </>
}

// What the admin hands a friend, written out once: the code or the starting password is shown
// here and nowhere else, with a message ready to paste into a chat.
const pwAlphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function newPassword() {
  const b = crypto.getRandomValues(new Uint8Array(12))
  const c = [...b].map(x => pwAlphabet[x % pwAlphabet.length]).join('')
  return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8)
}
// The server's refusals, said plainly. Anything else is shown as the server worded it.
const refusal = e => ({
  'name-taken': 'That name is already taken. Pick another.',
  'too-short': 'The password needs at least 6 characters.',
  'too-long': 'That password is too long.',
  'too-common': 'That password is too easy to guess.',
  missing: 'Enter a name.',
}[e?.data?.code] || e?.message || 'Something went wrong.')

function Handout({ title, lines, message, onDone }) {
  const toast = useUI(s => s.toast)
  const copy = () => { navigator.clipboard?.writeText(message).catch(() => {}); toast('Message copied') }
  const share = () => navigator.share({ text: message }).catch(() => {})
  return <div className="adm-new" role="status">
    <div className="adm-new-t">{title}</div>
    {lines.map(([k, v]) => <div key={k} className="adm-kv"><span className="k">{k}</span><span className="v adm-mono">{v}</span></div>)}
    <label className="adm-label" htmlFor="adm-msg">Message to send</label>
    <textarea id="adm-msg" className="adm-msg" readOnly rows={4} value={message} onFocus={e => e.target.select()} />
    <div className="adm-actions">
      <Button variant="primary" icon="copy" onClick={copy}>Copy message</Button>
      {typeof navigator.share === 'function' && <Button icon="share" onClick={share}>Share</Button>}
      <Button variant="ghost" onClick={onDone}>Done</Button>
    </div>
    <div className="adm-note">This is the only time it is shown.</div>
  </div>
}

function AddFriend({ inviteOnly, onAdded }) {
  const [mode, setMode] = useState('invite')
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [made, setMade] = useState(null)
  const site = location.origin
  const run = async (ev, call) => {
    ev.preventDefault()
    if (busy) return
    setBusy(true); setErr(null)
    try { setMade(await call()); onAdded() } catch (e) { setErr(refusal(e)) } finally { setBusy(false) }
  }
  const invite = ev => run(ev, async () => {
    const { invite } = await api('/api/admin/invites/new', { method: 'POST', body: JSON.stringify({ note: note.trim() }) })
    setNote('')
    return {
      title: 'Invite code ready' + (invite.note ? ' for ' + invite.note : ''),
      lines: [['Code', invite.code]],
      message: `Join me on GymBro: ${site}\nTap "Create account", pick a name and a password, and enter this invite code:\n${invite.code}`,
    }
  })
  const create = ev => run(ev, async () => {
    const n = name.trim()
    if (!n) throw new Error('Enter a name.')
    const { user } = await api('/api/admin/users/new', { method: 'POST', body: JSON.stringify({ name: n, password: pw }) })
    setName(''); setPw('')
    return {
      title: 'Account created for ' + user.name,
      lines: [['Name', user.name], ['Password', pw]],
      message: `Your GymBro account is ready: ${site}\nName: ${user.name}\nPassword: ${pw}\nSign in, then change the password in Settings, Account.`,
    }
  })
  const pick = m => { setMode(m); setErr(null) }
  return <section className="card adm-sec">
    <h2>Add a friend</h2>
    <Segmented options={[{ value: 'invite', label: 'Invite code' }, { value: 'create', label: 'Create account' }]} value={mode} onChange={pick} />
    {made ? <Handout {...made} onDone={() => setMade(null)} />
      : mode === 'invite' ? <form className="adm-invite adm-form" onSubmit={invite}>
        <div className="adm-field"><label htmlFor="adm-note">Who is it for? <span className="adm-opt">optional</span></label>
          <input id="adm-note" name="note" className="field" maxLength={60} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Somchai" autoComplete="off" /></div>
        {!inviteOnly && <div className="adm-note">Sign-up is open right now, so anyone can join without a code. Set INVITE_ONLY=1 on the server to require one.</div>}
        {err && <div className="adm-err" role="alert">{err}</div>}
        <Button variant="primary" type="submit" disabled={busy}>Create code</Button>
      </form>
      : <form className="adm-create adm-form" onSubmit={create}>
        <div className="adm-field"><label htmlFor="adm-name">Name they sign in with</label>
          <input id="adm-name" name="name" className="field" maxLength={40} value={name} onChange={e => setName(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} /></div>
        <div className="adm-field"><label htmlFor="adm-pw">Starting password</label>
          <div className="adm-row">
            <input id="adm-pw" name="password" className="field adm-mono" value={pw} onChange={e => setPw(e.target.value)} autoComplete="off" spellCheck={false} />
            <Button type="button" onClick={() => setPw(newPassword())}>Generate</Button>
          </div></div>
        {err && <div className="adm-err" role="alert">{err}</div>}
        <Button variant="primary" type="submit" disabled={busy}>Create account</Button>
      </form>}
  </section>
}

function InviteList({ invites, reload }) {
  const toast = useUI(s => s.toast)
  const revoke = code => confirmSheet({
    title: 'Revoke ' + code + '?', message: 'The code stops working. Anyone who already joined with it keeps their account.',
    confirmText: 'Revoke', danger: true,
    onConfirm: () => api('/api/admin/invites/revoke', { method: 'POST', body: JSON.stringify({ code }) })
      .then(() => { toast('Code revoked'); reload() }).catch(e => toast(e.message))
  })
  const copy = code => { navigator.clipboard?.writeText(code).catch(() => {}); toast('Copied ' + code) }
  const list = [...(invites || [])].sort((a, b) => (b.created || '').localeCompare(a.created || ''))
  return <section className="card adm-sec">
    <h2>Invite codes <span className="adm-count">{list.filter(i => !i.usedBy).length} unused</span></h2>
    {list.length ? <div className="adm-table">
      {list.map(i => <div key={i.code} className={'adm-tr' + (i.usedBy ? ' used' : '')}>
        <div className="adm-td grow">
          <div className="adm-mono">{i.code}</div>
          <div className="adm-sub">{[i.note, i.usedBy ? 'used by ' + (i.usedByName || 'someone') : 'unused', i.created && fmtDate(i.created.slice(0, 10))].filter(Boolean).join(' · ')}</div>
        </div>
        {!i.usedBy && <>
          <button className="iconbtn adm-iconbtn" onClick={() => copy(i.code)} aria-label={'Copy ' + i.code}><Icon name="copy" /></button>
          <button className="iconbtn adm-iconbtn adm-danger" onClick={() => revoke(i.code)} aria-label={'Revoke ' + i.code}><Icon name="trash" /></button>
        </>}
      </div>)}
    </div> : <div className="adm-empty">No codes yet.</div>}
  </section>
}

// Who signed in, who tried and failed, what an admin changed. A card rather than its own route:
// the dashboard is deliberately one page of cards, and the 95 % use of this is a glance at the
// last twenty events. Paging follows Library.jsx's house style — "Show more", not page numbers.
function AuditCard({ tick }) {
  const toast = useUI(s => s.toast)
  const [meta, setMeta] = useState(null)      // last response minus the rows: total, retention, …
  const [rows, setRows] = useState([])
  const [cat, setCat] = useState('')

  const load = (c, before) => api('/api/admin/audit?limit=50&cat=' + c + (before ? '&before=' + before : ''))
    .then(r => { setMeta(r); setRows(x => (before ? x.concat(r.events) : r.events)) })
    .catch(e => toast(e.message))
  const pick = c => { setCat(c); setRows([]); setMeta(null); load(c) }
  // Reloads on mount and whenever the header's ↻ bumps the tick. Deliberately not on the 15s
  // poll that drives "training now": this is history, not presence.
  useEffect(() => { load(cat) }, [tick])

  const clear = () => confirmSheet({
    title: 'Clear the activity log?',
    message: 'Every recorded event is deleted. The clear itself is logged, so the gap stays visible.',
    confirmText: 'Clear', danger: true,
    onConfirm: () => api('/api/admin/audit/clear', { method: 'POST', body: '{}' })
      .then(() => { toast('Activity log cleared'); pick(cat) }).catch(e => toast(e.message))
  })

  if (meta && !meta.enabled) return null      // AUDIT_LOG=0 — the card isn't there at all

  return <section className="card adm-sec">
    <div className="row between"><h2 style={{ margin: 0 }}>Activity log</h2>
      <button className="iconbtn adm-iconbtn" style={{ color: 'var(--red)' }} onClick={clear} aria-label="clear log"><Icon name="trash" /></button></div>
    {meta && <div className="adm-note">{[fmtNum(meta.total) + ' events', meta.retention.days && 'kept ' + meta.retention.days + ' days', meta.ip_mode === 'off' && 'no IP addresses'].filter(Boolean).join(' · ')}</div>}
    <div className="chips" style={{ marginBottom: 10 }}>
      {[['', 'All'], ['auth', 'Sign-ins'], ['admin', 'Admin'], ['fail', 'Failed']].map(([v, l]) =>
        <button key={v} className={'chip' + (cat === v ? ' on' : '')} onClick={() => pick(v)}>{l}</button>)}
    </div>
    {rows.map(e => {
      const line = auditLine(e)
      return <div key={e.id} className="row between" style={{ padding: '8px 2px', borderBottom: 'var(--hair) solid var(--sep)' }}>
        <div className="grow">
          <div className="small" style={{ fontWeight: 600 }}>{line.title}
            {/* a red pill, not a red row: twenty fumbled Face IDs in a row shouldn't read as an incident */}
            {!e.ok && <span className="adm-pill bad" style={{ marginInlineStart: 6 }}>failed</span>}
            {auditCat(e.ev) === 'admin' && <span className="adm-pill acc" style={{ marginInlineStart: 6 }}>admin</span>}</div>
          {line.sub && <div className="dim" style={{ fontSize: '.72rem' }}>{line.sub}</div>}
        </div>
        <span className="small muted" style={{ flex: 'none', marginInlineStart: 8 }}>{fmtWhen(e.ts, meta?.now)}</span>
      </div>
    })}
    {meta && !rows.length && <div className="adm-empty">Nothing logged yet.</div>}
    {meta?.nextBefore && <div style={{ marginTop: 10 }}>
      <Button size="sm" onClick={() => load(cat, meta.nextBefore)}>Show more</Button></div>}
  </section>
}

export default function Admin() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const openSheet = useUI(s => s.openSheet)
  const [users, setUsers] = useState(null)
  const [usersErr, setUsersErr] = useState(null)   // why the last load failed, until one succeeds
  const [invites, setInvites] = useState(null)
  const [inviteOnly, setInviteOnly] = useState(false)
  const [tick, setTick] = useState(0)          // the refresh button; the activity log listens to it

  // A failed load, or an answer without a list, says so where the list would be; the poll (or
  // refresh) keeps trying, and a list that did load stays up, marked as the last one through.
  const loadUsers = () => api('/api/admin/users')
    .then(d => {
      if (!Array.isArray(d?.users)) throw new Error('The server answered without a list of users.')
      setUsers(d.users); setInviteOnly(!!d.invite_only); setUsersErr(null)
    })
    .catch(e => setUsersErr(e.message || 'Failed to load'))
  const loadInvites = () => api('/api/admin/invites').then(d => setInvites(d.invites)).catch(() => {})
  const reload = () => { loadUsers(); loadInvites() }
  // poll every 15s so "training now" stays live without a manual refresh
  useEffect(() => { if (!user?.admin) return; reload(); const iv = setInterval(loadUsers, 15000); return () => clearInterval(iv) }, [])
  if (!user?.admin) return null

  const openUser = id => openSheet(close => <UserDetail id={id} onChanged={loadUsers} close={close} />)
  const live = (users || []).filter(u => u.live)
  const active = (users || []).filter(u => u.lastSync && Date.now() - u.lastSync < 7 * 86400000).length
  const n = users?.length || 0
  const sub = users ? `${n} ${n === 1 ? 'user' : 'users'} · ${active} active this week · sign-up ${inviteOnly ? 'by invite only' : 'open'}`
    : usersErr ? 'Could not load' : 'Loading…'

  return <div className="narrow adm-page">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/settings/account')} aria-label="Back"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 8 }}><h1 style={{ margin: 0 }}>Admin</h1><div className="sub">{sub}</div></div>
      <button className="iconbtn" onClick={() => { reload(); setTick(x => x + 1) }} aria-label="refresh"><Icon name="reset" /></button>
    </div>

    {usersErr && <div className="card adm-sec" role="alert" style={{ borderColor: 'var(--red)' }}>
      <div className="row between"><h2 style={{ margin: 0 }}>{users ? 'The last update failed' : 'Could not load the users'}</h2>
        <Button size="sm" icon="reset" onClick={loadUsers}>Try again</Button></div>
      <div className="adm-note">{usersErr} {users ? 'The list below is the last one that loaded.' : 'It tries again every 15 seconds.'}</div>
    </div>}

    <div className="adm-cols">
      <div>
        <AddFriend inviteOnly={inviteOnly} onAdded={reload} />
        <InviteList invites={invites} reload={loadInvites} />
      </div>
      <div>
        <section className="card adm-sec">
          <h2>People <span className="adm-count">{live.length ? live.length + ' training now' : ''}</span></h2>
          <div className="list">
            {(users || []).map(u => <div key={u.id} className={'item' + (u.disabled ? ' adm-off' : '')} {...tappable(() => openUser(u.id))}>
              <div className="grow"><div className="tt">{u.live && <span className="adm-live" aria-label="training now" />}{u.name}
                {u.admin && <span className="adm-pill">admin</span>}{u.disabled && <span className="adm-pill bad">disabled</span>}</div>
                <div className="ss">{u.live ? 'Training now · ' + u.live.name + ' · ' + dur(Date.now() - u.live.startedAt)
                  : u.workouts + ' workouts · last seen ' + rel(u.lastSync)}</div>
                {u.email && <div className="ss" title="sign-in e-mail">{u.email}</div>}</div>
              <Icon name="chevronRight" className="chev" />
            </div>)}
            {users && !users.length && <div className="adm-empty">Nobody yet. Add a friend to get started.</div>}
          </div>
        </section>
        <AuditCard tick={tick} />
      </div>
    </div>
  </div>
}
