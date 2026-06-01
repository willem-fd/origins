import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { Field } from './Auth'

// ─────────────────────────────────────────────────────────────────────────────
// INVITATIONS — Wave 2
// Two surfaces:
//   • InvitationsPage  → list + "Send invitation" (super admin sees all)
//   • AcceptInvitation → public /?invite=<token> flow (signup + onboarding)
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABELS = { buyer: 'Buyer', grower: 'Grower', logistics: 'Logistics' }
const acceptUrlFor = (token) => `${window.location.origin}/?invite=${token}`

// ─── Send invitation modal ───────────────────────────────────────────────────
export function SendInvitationModal({ realProfile, viewAs, onClose, onCreated }) {
  const realIsSuper = !!realProfile?.is_super_admin
  // Available invitation types based on who's inviting:
  //  - super admin, no view-as: can invite a new Buyer (or Grower/Logistics for completeness)
  //  - super admin in view-as buyer, OR buyer admin: invite Grower / Logistics
  const availableTypes = (realIsSuper && !viewAs) ? ['buyer', 'grower', 'logistics'] : ['grower', 'logistics']
  const defaultType = availableTypes[0]
  const inviterCompanyId = viewAs ? viewAs.id : (realIsSuper ? null : realProfile?.company_id)

  const [type, setType] = useState(defaultType)
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)  // {token, link} after creation
  const [copied, setCopied] = useState(false)

  const canChooseType = availableTypes.length > 1
  const send = async () => {
    setErr('')
    if (!email.trim() || !companyName.trim()) { setErr('Email and company name are required.'); return }
    setSaving(true)
    const payload = {
      email: email.trim(),
      new_company_name: companyName.trim(),
      new_company_type: type,
      inviter_user_id: realProfile?.id,
      inviter_company_id: inviterCompanyId,
    }
    const { data, error } = await supabase.from('company_invitations').insert([payload]).select().single()
    setSaving(false)
    if (error) { setErr(error.message); return }
    setResult({ token: data.token, link: acceptUrlFor(data.token) })
    onCreated?.(data)
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(result.link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  if (result) {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 540 }}>
          <div className="modal-header">
            <div className="modal-title"><i className="ti ti-mail-forward" aria-hidden="true" /> Invitation created</div>
            <div className="btn-icon" onClick={onClose}><i className="ti ti-x" aria-hidden="true" /></div>
          </div>
          <div className="modal-body">
            <div style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
              Send this link to <strong>{email}</strong>. They'll set a password and finish onboarding.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" readOnly value={result.link} style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }} onFocus={e => e.target.select()} />
              <button className="btn btn-primary" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
              Link expires in 14 days. Email delivery (Resend) lands later — for now, send this manually.
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
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div className="modal-title"><i className="ti ti-mail" aria-hidden="true" /> Send invitation</div>
          <div className="btn-icon" onClick={onClose}><i className="ti ti-x" aria-hidden="true" /></div>
        </div>
        <div className="modal-body">
          {canChooseType && (
            <div>
              <label className="form-label">Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {availableTypes.map(t => (
                  <div key={t} className={`filter-chip${type === t ? ' active' : ''}`} onClick={() => setType(t)}>{TYPE_LABELS[t]}</div>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="them@company.com" autoFocus />
          </div>
          <div>
            <label className="form-label">{TYPE_LABELS[type]} company name *</label>
            <input className="form-input" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder={type === 'buyer' ? 'e.g. Farm Direct' : type === 'logistics' ? 'e.g. KLM Cargo' : 'e.g. Joygardens'} />
          </div>
          {err && <div style={{ fontSize: 12.5, color: '#b91c1c' }}>{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={send} disabled={saving || !email.trim() || !companyName.trim()}>
            {saving ? 'Creating…' : 'Create invitation'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Invitations management page ─────────────────────────────────────────────
export default function InvitationsPage({ realProfile, viewAs }) {
  const [list, setList] = useState(null)
  const [showSend, setShowSend] = useState(false)
  const [copiedFor, setCopiedFor] = useState(null)

  const refresh = async () => {
    const { data } = await supabase
      .from('company_invitations')
      .select('*, inviter:companies!company_invitations_inviter_company_id_fkey(name, brand_name)')
      .order('created_at', { ascending: false })
    setList(data || [])
  }
  useEffect(() => { refresh() }, [])

  const copyLink = async (token) => {
    try { await navigator.clipboard.writeText(acceptUrlFor(token)); setCopiedFor(token); setTimeout(() => setCopiedFor(null), 1500) } catch {}
  }
  const cancel = async (id) => {
    await supabase.from('company_invitations').update({ status: 'cancelled' }).eq('id', id)
    refresh()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
          Each invitation produces a shareable link. Send it to the invitee manually — email delivery comes when we add Resend on the new domain.
        </div>
        <button className="btn btn-primary" onClick={() => setShowSend(true)}>
          <i className="ti ti-mail-forward" aria-hidden="true" /> Send invitation
        </button>
      </div>

      {list === null && <div className="empty"><i className="ti ti-loader" /><div className="empty-title">Loading…</div></div>}
      {list && list.length === 0 && (
        <div className="empty">
          <i className="ti ti-mail" />
          <div className="empty-title">No invitations yet</div>
          <div className="empty-sub">Hit "Send invitation" to create your first one.</div>
        </div>
      )}

      {list && list.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Email</th><th>Company</th><th>Type</th><th>Sent</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {list.map(inv => {
                  const expired = inv.status === 'pending' && new Date(inv.expires_at) < new Date()
                  const effectiveStatus = expired ? 'expired' : inv.status
                  const badgeClass = effectiveStatus === 'pending' ? 'badge-pending'
                    : effectiveStatus === 'accepted' ? 'badge-active'
                    : 'badge-draft'
                  return (
                    <tr key={inv.id}>
                      <td>{inv.email}</td>
                      <td>{inv.new_company_name || '(existing)'}</td>
                      <td><span className="td-muted">{TYPE_LABELS[inv.new_company_type] || '—'}</span></td>
                      <td className="td-mono">{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td><span className={`badge ${badgeClass}`} style={{ textTransform: 'capitalize' }}>{effectiveStatus}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        {inv.status === 'pending' && !expired && (
                          <>
                            <button className="btn btn-ghost btn-sm" onClick={() => copyLink(inv.token)}>
                              <i className="ti ti-link" aria-hidden="true" /> {copiedFor === inv.token ? 'Copied!' : 'Copy link'}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => cancel(inv.id)}>
                              <i className="ti ti-x" aria-hidden="true" /> Cancel
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showSend && (
        <SendInvitationModal
          realProfile={realProfile}
          viewAs={viewAs}
          onClose={() => setShowSend(false)}
          onCreated={() => { setShowSend(false); refresh() }}
        />
      )}
    </div>
  )
}

// ─── Accept invitation: public /?invite=<token> flow ─────────────────────────
export function AcceptInvitation({ token, onDone }) {
  const [phase, setPhase] = useState('loading')   // loading | form | accepting | done | error
  const [invite, setInvite] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.rpc('get_invitation_by_token', { t: token })
      if (cancelled) return
      const row = Array.isArray(data) ? data[0] : data
      if (error || !row) { setPhase('error'); setErrMsg('This invitation link is invalid or has expired.'); return }
      setInvite(row)
      setPhase('form')
    })()
    return () => { cancelled = true }
  }, [token])

  const submit = async (e) => {
    e?.preventDefault?.()
    setErrMsg('')
    if (!fullName.trim() || password.length < 8) { setErrMsg('Please enter your name and a password of at least 8 characters.'); return }
    setPhase('accepting')

    // 1. Sign up (email confirmation is off in dev — we'll be auto-signed-in)
    const { error: suErr } = await supabase.auth.signUp({ email: invite.email, password })
    if (suErr) {
      setPhase('form')
      setErrMsg(suErr.message.includes('already') ? 'An account with this email already exists. Please log in instead.' : suErr.message)
      return
    }

    // Make sure we're authenticated before calling the accept RPC
    const { data: session } = await supabase.auth.getSession()
    if (!session?.session) {
      // Try explicit sign in as a fallback
      const { error: siErr } = await supabase.auth.signInWithPassword({ email: invite.email, password })
      if (siErr) { setPhase('form'); setErrMsg(siErr.message); return }
    }

    // 2. Accept invitation (creates company + user row, plus relationship if applicable)
    const { data: res, error: acErr } = await supabase.rpc('accept_invitation', {
      t: token,
      full_name: fullName.trim(),
      country: country.trim() || null,
      city: city.trim() || null,
      brand_name: brandName.trim() || null,
    })
    if (acErr || !res?.ok) {
      setPhase('form')
      setErrMsg(acErr?.message || res?.error || 'Could not accept the invitation.')
      return
    }
    setPhase('done')
    setTimeout(() => onDone?.(), 1500)
  }

  return (
    <div className="auth-shell">
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-bg-orb auth-bg-orb-a" />
        <div className="auth-bg-orb auth-bg-orb-b" />
        <div className="auth-bg-grain" />
      </div>
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <div className="auth-brand">
          <img src="/origins-logo.svg" alt="Origins" className="auth-logo" />
        </div>

        {phase === 'loading' && (
          <div className="auth-form"><div className="auth-spinner" /></div>
        )}

        {phase === 'error' && (
          <div className="auth-form">
            <div className="auth-alert" role="alert">{errMsg}</div>
          </div>
        )}

        {(phase === 'form' || phase === 'accepting') && invite && (
          <form onSubmit={submit} className="auth-form" noValidate>
            <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 4 }}>
              You've been invited to join <strong>Origins</strong>
              {invite.inviter_company_name ? <> by <strong>{invite.inviter_company_name}</strong></> : null}
              {invite.new_company_name ? <> as <strong>{invite.new_company_name}</strong> ({TYPE_LABELS[invite.new_company_type]})</> : null}.
            </div>

            {errMsg && <div className="auth-alert" role="alert">{errMsg}</div>}

            <Field label="Your email" type="email" value={invite.email} onChange={() => {}} />
            <Field label="Your full name" type="text" value={fullName} onChange={setFullName} required placeholder="First and last name" />
            <Field
              label="Choose a password (min. 8 chars)" type={showPw ? 'text' : 'password'}
              value={password} onChange={setPassword} required placeholder="••••••••" autoComplete="new-password"
              trailing={<button type="button" className="auth-eye" onClick={() => setShowPw(s => !s)} tabIndex={-1}>{showPw ? '🙈' : '👁'}</button>}
            />

            {invite.new_company_id == null && (
              <>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4 }}>Tell us a little about <strong>{invite.new_company_name}</strong> (optional now — you can fill in later):</div>
                <Field label="Brand name (if different)" type="text" value={brandName} onChange={setBrandName} placeholder={invite.new_company_name} />
                <Field label="Country"                   type="text" value={country}   onChange={setCountry}   placeholder="e.g. Netherlands" />
                <Field label="City"                      type="text" value={city}      onChange={setCity}      placeholder="e.g. Aalsmeer" />
              </>
            )}

            <button type="submit" className="auth-submit" disabled={phase === 'accepting' || !fullName || password.length < 8}>
              {phase === 'accepting' ? <span className="auth-spinner" /> : 'Create my account'}
            </button>
          </form>
        )}

        {phase === 'done' && (
          <div className="auth-form" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            <div style={{ fontWeight: 500 }}>Welcome to Origins!</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Taking you in…</div>
          </div>
        )}
      </div>
      <footer className="auth-foot"><span>© Origins · A platform for flower trade</span></footer>
    </div>
  )
}
