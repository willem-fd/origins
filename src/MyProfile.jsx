import { useState } from 'react'
import { supabase } from './supabase'

// User-level profile editor. Triggered from the user dropdown in the sidebar.
// Scope intentionally small for V1: full name + password change.
// Email is shown read-only; changing it has security implications and we'll
// handle it separately when transactional email is in place.
export default function MyProfile({ profile, onClose, onUpdated }) {
  const [firstName, setFirstName] = useState(profile?.first_name || '')
  const [lastName, setLastName]   = useState(profile?.last_name || '')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const nameChanged = (firstName.trim() !== (profile?.first_name || '').trim())
                    || (lastName.trim()  !== (profile?.last_name  || '').trim())
  const wantsPwChange = pw.length > 0 || pw2.length > 0

  const save = async () => {
    setErr(''); setOk('')
    if (!firstName.trim() || !lastName.trim()) { setErr('First and last name are required.'); return }
    if (wantsPwChange) {
      if (pw.length < 8) { setErr('New password must be at least 8 characters.'); return }
      if (pw !== pw2)    { setErr('Passwords do not match.'); return }
    }
    if (!nameChanged && !wantsPwChange) { onClose(); return }

    setSaving(true)
    if (nameChanged) {
      const { error: nErr } = await supabase
        .from('users').update({ first_name: firstName.trim(), last_name: lastName.trim() })
        .eq('id', profile.id)
      if (nErr) { setSaving(false); setErr(nErr.message); return }
    }
    if (wantsPwChange) {
      const { error: pErr } = await supabase.auth.updateUser({ password: pw })
      if (pErr) { setSaving(false); setErr(pErr.message); return }
    }
    setSaving(false)
    setOk('Saved.')
    onUpdated?.({ ...profile, first_name: firstName.trim(), last_name: lastName.trim() })
    setTimeout(() => onClose(), 700)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="modal-title"><i className="ti ti-user" aria-hidden="true" /> My profile</div>
          <div className="btn-icon" onClick={onClose}><i className="ti ti-x" aria-hidden="true" /></div>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">First name *</label>
              <input className="form-input" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">Last name *</label>
              <input className="form-input" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="form-label">Email</label>
            <input className="form-input" value={profile?.email || ''} readOnly disabled />
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>
              To change your email, contact your admin.
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Change password</div>
            <div>
              <label className="form-label">New password (min. 8 chars)</label>
              <input className="form-input" type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" placeholder="Leave blank to keep current" />
            </div>
            <div style={{ marginTop: 8 }}>
              <label className="form-label">Confirm new password</label>
              <input className="form-input" type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" />
            </div>
          </div>

          {err && <div style={{ fontSize: 12.5, color: '#b91c1c', marginTop: 6 }}>{err}</div>}
          {ok  && <div style={{ fontSize: 12.5, color: '#1A6640', marginTop: 6 }}>{ok}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || (!nameChanged && !wantsPwChange)}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
