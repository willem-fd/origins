import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { Field, eyeOn, eyeOff } from './Auth'
import CountryCombobox from './CountryCombobox'

// ─────────────────────────────────────────────────────────────────────────────
// INVITATIONS — Wave 2
// Two surfaces:
//   • InvitationsPage  → list + "Send invitation" (super admin sees all)
//   • AcceptInvitation → public /?invite=<token> flow (signup + onboarding)
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABELS = { buyer: 'Buyer', grower: 'Grower', logistics: 'Logistics' }
const acceptUrlFor = (token) => `${window.location.origin}/?invite=${token}`

// ─── Send invitation / connection-request modal ──────────────────────────────
// Two paths under one modal:
//   1. Super admin no view-as, type='buyer' → invite a new buyer (no lookup; needs email + company name)
//   2. Buyer admin OR super-in-view-as buyer, type='grower'|'logistics' →
//      look up by company name first; if a match exists, send a connection request;
//      if not, fall through to invitation.
export function SendInvitationModal({ realProfile, viewAs, onClose, onCreated }) {
  const realIsSuper = !!realProfile?.is_super_admin
  const availableTypes = (realIsSuper && !viewAs) ? ['buyer', 'grower', 'logistics'] : ['grower', 'logistics']
  const defaultType = availableTypes[0]
  const inviterCompanyId = viewAs ? viewAs.id : (realIsSuper ? null : realProfile?.company_id)

  const [phase, setPhase] = useState('form')      // form | matched | no-match | submitting | created | requested
  const [type, setType] = useState(defaultType)
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [match, setMatch] = useState(null)         // companies row when found
  const [err, setErr] = useState('')
  const [result, setResult] = useState(null)       // {token, link} after invitation is created
  const [copied, setCopied] = useState(false)

  const canChooseType    = availableTypes.length > 1
  const isInvitingBuyer  = type === 'buyer'        // buyer invites never look up — buyers are always net-new

  // Switching type resets back to form
  useEffect(() => { setPhase('form'); setMatch(null); setErr('') }, [type])

  const lookupOrInvite = async () => {
    setErr('')
    if (!companyName.trim()) { setErr('Company name is required.'); return }

    if (isInvitingBuyer) {
      // Buyer-type invites skip the lookup entirely
      if (!email.trim()) { setErr('Email is required.'); return }
      return sendInvitation()
    }

    // Grower/logistics: try lookup first
    setPhase('submitting')
    const { data, error } = await supabase.rpc('lookup_partner_by_name', {
      partner_name: companyName.trim(),
      partner_type: type,
    })
    if (error) { setPhase('form'); setErr(error.message); return }
    if (data && data.length > 0) {
      setMatch(data[0])
      setPhase('matched')
    } else {
      setPhase('no-match')
    }
  }

  const sendInvitation = async () => {
    setErr('')
    if (!email.trim()) { setErr('Email is required.'); return }
    setPhase('submitting')
    const payload = {
      email: email.trim(),
      new_company_name: companyName.trim(),
      new_company_type: type,
      inviter_user_id: realProfile?.id,
      inviter_company_id: inviterCompanyId,
    }
    const { data, error } = await supabase.from('company_invitations').insert([payload]).select().single()
    if (error) {
      setPhase(isInvitingBuyer ? 'form' : 'no-match')
      setErr(error.message)
      return
    }
    setResult({ token: data.token, link: acceptUrlFor(data.token) })
    setPhase('created')
    onCreated?.(data)
  }

  const sendConnectionRequest = async () => {
    setErr(''); setPhase('submitting')
    const { data, error } = await supabase.rpc('create_partner_connection_request', {
      target_partner_id: match.id,
    })
    if (error || !data?.ok) {
      setPhase('matched')
      setErr(error?.message || data?.error || 'Could not create connection request.')
      return
    }
    setPhase('requested')
    onCreated?.()
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(result.link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  // ── Phase: created (invitation link to share) ──
  if (phase === 'created') {
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

  // ── Phase: requested (connection request sent) ──
  if (phase === 'requested') {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 480 }}>
          <div className="modal-header">
            <div className="modal-title"><i className="ti ti-check" aria-hidden="true" /> Connection request sent</div>
            <div className="btn-icon" onClick={onClose}><i className="ti ti-x" aria-hidden="true" /></div>
          </div>
          <div className="modal-body">
            <div style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
              We've sent a connection request to <strong>{match?.name}</strong>. Once they accept, they'll appear in your {TYPE_LABELS[match?.type]}s list.
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Phases: form | matched | no-match | submitting ──
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div className="modal-title"><i className="ti ti-user-plus" aria-hidden="true" /> Add partner</div>
          <div className="btn-icon" onClick={onClose}><i className="ti ti-x" aria-hidden="true" /></div>
        </div>
        <div className="modal-body">
          {canChooseType && phase === 'form' && (
            <div>
              <label className="form-label">Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {availableTypes.map(t => (
                  <div key={t} className={`filter-chip${type === t ? ' active' : ''}`} onClick={() => setType(t)}>{TYPE_LABELS[t]}</div>
                ))}
              </div>
            </div>
          )}

          {phase === 'form' && (
            <>
              <div>
                <label className="form-label">{TYPE_LABELS[type]} company name *</label>
                <input
                  className="form-input"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder={type === 'buyer' ? 'e.g. Farm Direct' : type === 'logistics' ? 'e.g. KLM Cargo' : 'e.g. Joygardens'}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookupOrInvite() } }}
                />
                {!isInvitingBuyer && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>
                    We'll check if they're already on Origins. If not, you can invite them.
                  </div>
                )}
              </div>
              {isInvitingBuyer && (
                <div>
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="them@company.com" />
                </div>
              )}
            </>
          )}

          {phase === 'matched' && match && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Match found</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{match.brand_name || match.name}</div>
              {match.brand_name && match.brand_name !== match.name && (
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Legal name: {match.name}</div>
              )}
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>
                {TYPE_LABELS[match.type]}{match.country ? ` · ${match.country}` : ''}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
                They'll receive a notification and must accept before you can place orders with them.
              </div>
            </div>
          )}

          {phase === 'no-match' && (
            <>
              <div style={{ padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 7, fontSize: 13, color: 'var(--text-2)' }}>
                <strong>{companyName}</strong> isn't on Origins yet. Send them an invitation to onboard.
              </div>
              <div>
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="them@company.com" autoFocus />
              </div>
            </>
          )}

          {phase === 'submitting' && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Working…</div>
          )}

          {err && <div style={{ fontSize: 12.5, color: '#b91c1c' }}>{err}</div>}
        </div>
        <div className="modal-footer">
          {(phase === 'matched' || phase === 'no-match') && (
            <button className="btn btn-ghost" onClick={() => { setPhase('form'); setMatch(null); setEmail(''); setErr('') }}>← Try different name</button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {phase === 'form' && (
            <button className="btn btn-primary" onClick={lookupOrInvite} disabled={!companyName.trim() || (isInvitingBuyer && !email.trim())}>
              {isInvitingBuyer ? 'Create invitation' : 'Continue'}
            </button>
          )}
          {phase === 'matched' && (
            <button className="btn btn-primary" onClick={sendConnectionRequest}>Send connection request</button>
          )}
          {phase === 'no-match' && (
            <button className="btn btn-primary" onClick={sendInvitation} disabled={!email.trim()}>Send invitation</button>
          )}
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

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [password, setPassword]   = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [companyName, setCompanyName] = useState('')
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
      // Pre-populate company name from the inviter's value (invitee can confirm/edit)
      if (row.new_company_name) setCompanyName(row.new_company_name)
      setPhase('form')
    })()
    return () => { cancelled = true }
  }, [token])

  const submit = async (e) => {
    e?.preventDefault?.()
    setErrMsg('')
    if (!firstName.trim() || !lastName.trim()) { setErrMsg('Please enter your first and last name.'); return }
    if (password.length < 8) { setErrMsg('Password must be at least 8 characters.'); return }
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
      const { error: siErr } = await supabase.auth.signInWithPassword({ email: invite.email, password })
      if (siErr) { setPhase('form'); setErrMsg(siErr.message); return }
    }

    // 2. Accept invitation (creates company + user row, plus relationship if applicable)
    const { data: res, error: acErr } = await supabase.rpc('accept_invitation', {
      t: token,
      first_name:   firstName.trim(),
      last_name:    lastName.trim(),
      company_name: companyName.trim() || null,
      country:      country.trim()  || null,
      city:         city.trim()     || null,
      brand_name:   brandName.trim() || null,
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
              {invite.new_company_name
                ? <> as <strong>{invite.new_company_name}</strong> ({TYPE_LABELS[invite.new_company_type]})</>
                : invite.target_role
                  ? <> as a <strong>{invite.target_role === 'admin' ? 'team admin' : 'team member'}</strong></>
                  : null
              }.
            </div>

            {errMsg && <div className="auth-alert" role="alert">{errMsg}</div>}

            <Field label="Your email" type="email" value={invite.email} onChange={() => {}} />
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field label="First name *" type="text" value={firstName} onChange={setFirstName} required placeholder="First name" />
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Last name *" type="text" value={lastName} onChange={setLastName} required placeholder="Last name" />
              </div>
            </div>
            <Field
              label="Choose a password (min. 8 chars)" type={showPw ? 'text' : 'password'}
              value={password} onChange={setPassword} required placeholder="••••••••" autoComplete="new-password"
              trailing={<button type="button" className="auth-eye" onClick={() => setShowPw(s => !s)} tabIndex={-1} aria-label={showPw ? 'Hide password' : 'Show password'}>{showPw ? eyeOff : eyeOn}</button>}
            />

            {invite.company_id == null && (
              <>
                <Field label="Company name *"             type="text" value={companyName} onChange={setCompanyName} required placeholder={invite.new_company_name} />
                <Field label="Brand name (if different)"  type="text" value={brandName}   onChange={setBrandName}   placeholder="Optional" />
                <label className="auth-field">
                  <span className="auth-field-label">Country</span>
                  <span className="auth-field-wrap">
                    <CountryCombobox value={country} onChange={setCountry} className="auth-input" placeholder="Type to search…" />
                  </span>
                </label>
                <Field label="City"                       type="text" value={city}        onChange={setCity}        placeholder="e.g. Aalsmeer" />
              </>
            )}

            <button type="submit" className="auth-submit" disabled={phase === 'accepting' || !firstName.trim() || !lastName.trim() || password.length < 8}>
              {phase === 'accepting' ? <span className="auth-spinner" /> : "Let's go!"}
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
    </div>
  )
}

// ─── Connection Requests page (partner side: grower / logistics) ─────────────
export function ConnectionRequestsPage({ companyId, onRespond }) {
  const [requests, setRequests] = useState(null)
  const [actionId, setActionId] = useState(null)
  const [err, setErr] = useState('')

  const refresh = async () => {
    if (!companyId) { setRequests([]); return }
    const { data, error } = await supabase
      .from('company_relationships')
      .select('id, partner_type, created_at, buyer:companies!company_relationships_buyer_company_id_fkey(id, name, brand_name, country)')
      .eq('partner_company_id', companyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) setErr(error.message)
    setRequests(data || [])
  }
  useEffect(() => { refresh() }, [companyId])

  const respond = async (id, accept) => {
    setErr(''); setActionId(id)
    const { data, error } = await supabase.rpc('respond_to_connection_request', { request_id: id, accept })
    setActionId(null)
    if (error || !data?.ok) { setErr(error?.message || data?.error || 'Could not update.'); return }
    refresh(); onRespond?.()
  }

  return (
    <div>
      <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 16 }}>
        Buyers who want to work with you. Accept to start trading; decline to refuse the connection.
      </div>

      {err && <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#b91c1c', borderRadius: 7, fontSize: 13, marginBottom: 12 }}>{err}</div>}

      {requests === null && <div className="empty"><i className="ti ti-loader" /><div className="empty-title">Loading…</div></div>}
      {requests && requests.length === 0 && (
        <div className="empty">
          <i className="ti ti-mail" />
          <div className="empty-title">No pending connection requests</div>
          <div className="empty-sub">When a buyer adds you as a partner, you'll see them here.</div>
        </div>
      )}

      {requests && requests.map(req => (
        <div className="card" key={req.id} style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{req.buyer?.brand_name || req.buyer?.name}</div>
              {req.buyer?.brand_name && req.buyer?.brand_name !== req.buyer?.name && (
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Legal name: {req.buyer.name}</div>
              )}
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                Buyer{req.buyer?.country ? ` · ${req.buyer.country}` : ''}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                Requested {new Date(req.created_at).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" disabled={actionId === req.id} onClick={() => respond(req.id, false)}>Decline</button>
              <button className="btn btn-primary" disabled={actionId === req.id} onClick={() => respond(req.id, true)}>
                {actionId === req.id ? 'Saving…' : 'Accept'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
