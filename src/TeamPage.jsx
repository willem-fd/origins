import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const ROLE_LABELS = { admin: 'Admin', regular: 'Member' }
const ROLE_DESCRIPTIONS = {
  admin:   'Full access — can invite teammates, edit company, manage partners.',
  regular: 'Standard access — uses the app, no admin actions.',
}

// Team page for a company.
// Lists current users; admins can invite teammates.
// Super admin (no view-as) sees a ComingSoon scaffold — global users page TBD.
export default function TeamPage({ companyId, profile }) {
  const [users, setUsers] = useState(null)
  const [showInvite, setShowInvite] = useState(false)
  const isAdmin = !!profile?.is_super_admin || profile?.role === 'admin'

  const refresh = async () => {
    if (!companyId) { setUsers([]); return }
    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, role, email')
      .eq('company_id', companyId)
      .order('role', { ascending: true })
    if (error) { setUsers([]); return }
    setUsers(data || [])
  }
  useEffect(() => { refresh() }, [companyId])

  if (!companyId) {
    return <div className="card" style={{ padding: '80px 20px' }}><div className="empty"><i className="ti ti-users" /><div className="empty-title">Users</div><div className="empty-sub">Global users page — coming next</div></div></div>
  }
  if (users === null) {
    return <div className="empty"><i className="ti ti-loader" /><div className="empty-title">Loading…</div></div>
  }

  return (
    <div>
      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
            {users.length} member{users.length === 1 ? '' : 's'} on your team.
          </div>
          <button className="btn btn-primary" onClick={() => setShowInvite(true)}>
            <i className="ti ti-mail-forward" aria-hidden="true" /> Invite teammate
          </button>
        </div>
      )}

      {users.length === 0 ? (
        <div className="empty">
          <i className="ti ti-users" />
          <div className="empty-title">No teammates yet</div>
          {isAdmin && <div className="empty-sub">Click "Invite teammate" to add your first one.</div>}
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                          {((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div>{`${u.first_name || ''} ${u.last_name || ''}`.trim() || '(no name)'}</div>
                          {u.id === profile?.id && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>you</div>}
                        </div>
                      </div>
                    </td>
                    <td className="td-mono" style={{ fontSize: 12.5 }}>{u.email || '—'}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-active' : 'badge-pending'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showInvite && (
        <InviteTeammateModal
          companyId={companyId}
          inviterUserId={profile?.id}
          onClose={() => setShowInvite(false)}
          onSent={() => { setShowInvite(false); refresh() }}
        />
      )}
    </div>
  )
}

function InviteTeammateModal({ companyId, inviterUserId, onClose, onSent }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('regular')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  const send = async () => {
    setErr('')
    if (!email.trim()) { setErr('Email is required.'); return }
    setSaving(true)
    const { data, error } = await supabase.from('company_invitations').insert([{
      email: email.trim(),
      company_id: companyId,
      inviter_user_id: inviterUserId,
      inviter_company_id: companyId,
      target_role: role,
    }]).select().single()
    setSaving(false)
    if (error) { setErr(error.message); return }
    const link = `${window.location.origin}/?invite=${data.token}`
    setResult({ link })
    onSent?.(data)
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(result.link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  if (result) {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 520 }}>
          <div className="modal-header">
            <div className="modal-title"><i className="ti ti-mail-forward" aria-hidden="true" /> Invitation created</div>
            <div className="btn-icon" onClick={onClose}><i className="ti ti-x" aria-hidden="true" /></div>
          </div>
          <div className="modal-body">
            <div style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
              Send this link to <strong>{email}</strong>. They'll set a password and join your team as <strong>{ROLE_LABELS[role]}</strong>.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" readOnly value={result.link} style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }} onFocus={e => e.target.select()} />
              <button className="btn btn-primary" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
              Link expires in 14 days.
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title"><i className="ti ti-user-plus" aria-hidden="true" /> Invite teammate</div>
          <div className="btn-icon" onClick={onClose}><i className="ti ti-x" aria-hidden="true" /></div>
        </div>
        <div className="modal-body">
          <div>
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="them@yourcompany.com" autoFocus />
          </div>
          <div>
            <label className="form-label">Role</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['regular', 'admin'].map(r => (
                <div key={r} className={`filter-chip${role === r ? ' active' : ''}`} onClick={() => setRole(r)}>{ROLE_LABELS[r]}</div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>{ROLE_DESCRIPTIONS[role]}</div>
          </div>
          {err && <div style={{ fontSize: 12.5, color: '#b91c1c' }}>{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={send} disabled={saving || !email.trim()}>
            {saving ? 'Creating…' : 'Create invitation'}
          </button>
        </div>
      </div>
    </div>
  )
}
