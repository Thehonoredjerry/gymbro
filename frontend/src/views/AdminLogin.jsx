// The admin website's front door: one password (ADMIN_PASSWORD on the server), nothing else.
// English-only like the panel it opens, and in the same glass theme (admin.css).
import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useStore } from '../store/useStore.js'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import '../admin.css'

const why = e => e?.status === 401 ? 'That password isn’t right.'
  : e?.status === 429 ? 'Too many wrong tries. Wait a few minutes, then try again.'
  : e?.status === 404 ? 'The admin password isn’t set on the server yet (ADMIN_PASSWORD).'
  : 'Couldn’t reach the server. Check the connection and try again.'

export default function AdminLogin() {
  const setUser = useStore(s => s.setUser)
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  useEffect(() => { const de = document.documentElement; de.dataset.adm = ''; return () => { delete de.dataset.adm } }, [])
  const submit = async ev => {
    ev.preventDefault()
    if (busy || !pw) return
    setBusy(true); setErr(null)
    try {
      const { user } = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: pw }) })
      setUser(user)
    } catch (e) { setErr(why(e)); setBusy(false) }
  }
  return <div className="adm-login">
    <form className="card adm-sec adm-login-card" onSubmit={submit}>
      <div className="adm-login-mark" aria-hidden="true"><Icon name="lock" /></div>
      <h1>GymBro admin</h1>
      <div className="adm-field">
        <label htmlFor="adm-login-pw">Admin password</label>
        <div className="adm-row">
          <input id="adm-login-pw" className="field" type={show ? 'text' : 'password'} autoComplete="current-password" autoFocus
            value={pw} onChange={e => setPw(e.target.value)} aria-invalid={!!err} aria-describedby={err ? 'adm-login-err' : undefined} />
          <Button type="button" onClick={() => setShow(s => !s)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</Button>
        </div>
      </div>
      {err && <div id="adm-login-err" className="adm-err" role="alert">{err}</div>}
      <Button variant="primary" type="submit" disabled={busy || !pw}>{busy ? 'Signing in…' : 'Sign in'}</Button>
    </form>
  </div>
}
