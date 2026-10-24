// GymBro's first launch, phone-first: language → account → profile → notifications. The phone
// app signs in to its built-in server with a name and password (lib/server-url.js, a bearer
// token); the web app uses the same routes with its session cookie, and keeps the passkey as a
// second way in where the browser has one. A signed-in account without a profile starts at
// `profile` (App.jsx decides where to start).
import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t, ACTIVE_LANGS, LANGS } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import { webauthnOK, passkeyLogin, passkeyError, passwordLogin, passwordRegister } from '../lib/api.js'
import { builtinServer } from '../lib/server-url.js'
import { pushSupported, enablePush } from '../lib/push.js'
import { guestAllowed } from '../lib/guest.js'
import { askAddDeviceData } from '../sheets.jsx'
import { passwordError, MIN_PASSWORD } from '../components/PasswordAuth.jsx'
import { openDeviceLinkRedeem } from '../components/Passkeys.jsx'
import { Button, Segmented } from '../components/ui.jsx'

const store = () => useStore.getState()
const num = v => { const n = Number(String(v).trim().replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null }
const field = { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false }
const errStyle = { color: 'var(--red)', marginTop: 10 }
const lbl = { display: 'block', marginBottom: 6 }
const wrap = { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh' }

const Head = () => <div style={{ textAlign: 'center', marginBottom: 22 }}>
  <img className="brand-logo" src="logo.png" alt="" width="150" height="140" />
  <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.028em', margin: '10px 0 0' }}>GymBro</h1>
</div>

function LangStep({ next }) {
  const pick = k => { store().update(s => { s.lang = k; s.langAuto = false }); next() }
  return <>
    {ACTIVE_LANGS.map(k => <div key={k} style={{ marginBottom: 10 }}>
      <Button variant={k === 'th' ? 'primary' : undefined} onClick={() => pick(k)}>{LANGS[k]}</Button>
    </div>)}
  </>
}

function AccountStep({ next }) {
  const config = useStore(s => s.config)
  const phone = !!builtinServer()
  const [create, setCreate] = useState(false)
  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  // The phone cannot read the server's config before it is signed in, so it always asks.
  const askInvite = create && (phone || !!config?.invite_only)
  const submit = async ev => {
    ev.preventDefault()
    if (busy) return
    const n = name.trim()
    const bad = !n ? t('Enter a name') : !pw ? t('Enter your password.')
      : create && [...pw].length < MIN_PASSWORD ? t('Use at least {0} characters.', MIN_PASSWORD) : null
    if (bad) { setErr(bad); return }
    setBusy(true); setErr(null)
    try {
      if (phone) await store().signInToServer(create ? { create, name: n, password: pw, code: code.trim() } : { create, name: n, password: pw }, askAddDeviceData)
      else {
        const u = create ? await passwordRegister(n, pw, code.trim()) : await passwordLogin(n, pw)
        store().setUser(u, { adopt: true })
        await store().adoptProfile(askAddDeviceData)
      }
      next()
    } catch (e) { setErr(passwordError(e)) }
    finally { setBusy(false) }
  }
  const passkey = async () => {
    try { const u = await passkeyLogin(); store().setUser(u, { adopt: true }); await store().adoptProfile(askAddDeviceData); next() }
    catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') setErr(passkeyError(e, t('Sign-in failed'))) }
  }
  return <>
    <Segmented options={[{ value: false, label: t('Sign in') }, { value: true, label: t('Create account') }]} value={create} onChange={v => { setCreate(v); setErr(null) }} />
    <form onSubmit={submit} style={{ marginTop: 14 }}>
      <input className="input" name="username" autoComplete="username" placeholder={t('Your name')} maxLength={40} value={name} onChange={e => setName(e.target.value)} {...field} />
      <div style={{ height: 10 }} />
      <input className="input" type="password" name="password" autoComplete={create ? 'new-password' : 'current-password'} placeholder={t('Password')} value={pw} onChange={e => setPw(e.target.value)} />
      {askInvite && <>
        <div style={{ height: 10 }} />
        <input className="input" name="invite" placeholder={t('Invite code')} maxLength={40} value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          // Spaced out only once typed: on a Thai placeholder the spacing tears the vowel marks off.
          style={{ letterSpacing: code ? '.14em' : 0, fontWeight: 600, textAlign: 'center' }} {...field} />
      </>}
      {err && <div className="small" role="alert" style={errStyle}>{err}</div>}
      <div style={{ height: 14 }} />
      <Button variant="primary" type="submit" disabled={busy}>{create ? t('Create account') : t('Sign in')}</Button>
    </form>
    {!phone && webauthnOK() && <>
      <div style={{ height: 10 }} />
      <Button icon="fingerprint" onClick={passkey}>{t('Sign in with passkey')}</Button>
      <div style={{ height: 4 }} />
      <Button variant="ghost" className="dim" icon="qr" onClick={openDeviceLinkRedeem}>{t('Use a code from your other device')}</Button>
    </>}
    {!phone && guestAllowed(config) && <Button variant="ghost" className="dim" onClick={() => store().setGuest(true)}>{t('Continue without account')}</Button>}
  </>
}

function ProfileStep({ next }) {
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const [body, setBody] = useState(S.body === 'female' ? 'female' : 'male')
  const [bw, setBw] = useState('')
  const [goal, setGoal] = useState('')
  const [err, setErr] = useState(null)
  const submit = ev => {
    ev.preventDefault()
    const w = num(bw)
    if (!w) { setErr(t('Enter your body weight.')); return }
    next({ body, w, goal: num(goal) })
  }
  return <>
    {user?.name && <div className="big" style={{ fontSize: 22, marginBottom: 12, textAlign: 'center' }}>{t('Hi, {0}!', user.name)}</div>}
    <Segmented options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]} value={body} onChange={setBody} />
    <form onSubmit={submit} style={{ marginTop: 14 }}>
      <label className="small muted" style={lbl}>{t('Body weight')} ({S.unit})</label>
      <input className="input" name="bodyweight" inputMode="decimal" value={bw} onChange={e => setBw(e.target.value)} />
      <div style={{ height: 10 }} />
      <label className="small muted" style={lbl}>{t('Goal')} ({S.unit}) · {t('optional')}</label>
      <input className="input" name="goal" inputMode="decimal" value={goal} onChange={e => setGoal(e.target.value)} />
      {err && <div className="small" role="alert" style={errStyle}>{err}</div>}
      <div style={{ height: 14 }} />
      <Button variant="primary" type="submit">{t('Save')}</Button>
    </form>
  </>
}

function NotifyStep({ done }) {
  const on = async () => { try { await enablePush() } catch { /* declined or unsupported: Settings can turn it on later */ } done() }
  return <>
    <h3 style={{ textAlign: 'center' }}>{t('Notifications')}</h3>
    <div className="muted small" style={{ marginBottom: 14, textAlign: 'center' }}>{t('Get a nudge when your rest is over.')}</div>
    <Button variant="primary" icon="bell" onClick={on}>{t('Turn on')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" onClick={done}>{t('Not now')}</Button>
  </>
}

// The profile is written in one go at the end, so App.jsx's gate (no profile, no weigh-in) lets
// go only once the notification question has been answered too.
function saveProfile({ body, w, goal }) {
  store().update(s => {
    s.body = body
    const iso = todayISO()
    const ex = s.bodyweight.find(b => b.d === iso)
    if (ex) { ex.w = w; ex.t = Date.now() } else s.bodyweight.push({ d: iso, w, t: Date.now() })
    s.bodyweight.sort((a, b) => (a.d < b.d ? -1 : 1))
    if (goal) s.targetW = goal
    s.profileDone = true
  })
}

export default function Welcome({ start = 'lang' }) {
  const [step, setStep] = useState(start)
  const [profile, setProfile] = useState(null)
  const afterProfile = p => { if (!builtinServer() && pushSupported()) { setProfile(p); setStep('notify') } else saveProfile(p) }
  return <div className="narrow" style={wrap}>
    <Head />
    {step === 'lang' && <LangStep next={() => setStep('account')} />}
    {step === 'account' && <AccountStep next={() => setStep('profile')} />}
    {step === 'profile' && <ProfileStep next={afterProfile} />}
    {step === 'notify' && <NotifyStep done={() => saveProfile(profile)} />}
  </div>
}
