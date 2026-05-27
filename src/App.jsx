import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { CSS } from './styles'
import POEditor from './POEditor'
import CompaniesPage from './CompaniesPage'
import { COUNTRIES, SHIP_STATUSES, STATUS_LABELS, STATUS_BADGE, flag, fmt, validateEmail, validatePhone } from './constants'

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_BADGE[status] || 'badge-draft'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

// ── Country Select ────────────────────────────────────────────────────────────
function CountrySelect({ value, onChange, className = 'form-select', placeholder = '— Select country —' }) {
  return (
    <select className={className} value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
    </select>
  )
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const submit = async e => {
    e.preventDefault(); setLoading(true); setErr('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) setErr(error.message)
    else onLogin(data.user)
    setLoading(false)
  }
  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/origins-logo.svg" alt="Origins" style={{ width: 160, marginBottom: 32, display: 'block' }} />
        {err && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 7, fontSize: 13, marginBottom: 14 }}>{err}</div>}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@farmdirect.nl" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={pw} onChange={e => setPw(e.target.value)} required placeholder="••••••••" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 6, justifyContent: 'center', padding: 11 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ page, setPage, user, pendingCount, onSignOut }) {
  const ni = (id, icon, label, badge) => (
    <div className={`nav-item${page === id ? ' active' : ''}`} onClick={() => setPage(id)}>
      <i className={`ti ti-${icon}`} aria-hidden="true" />{label}
      {badge != null && <span className="nav-badge">{badge}</span>}
    </div>
  )
  return (
    <div className="sidebar">
      <div className="sidebar-logo" onClick={() => setPage('dashboard')}>
        <img src="/origins-logo.svg" alt="Origins" style={{ width: 130, height: 'auto' }} />
      </div>
      <div className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-label">Overview</div>
          {ni('dashboard', 'layout-dashboard', 'Dashboard')}
        </div>
        <div className="nav-section">
          <div className="nav-label">Purchasing</div>
          {ni('shipments', 'plane', 'Shipments', pendingCount || undefined)}
          {ni('templates', 'template', 'PO Templates')}
        </div>
        <div className="nav-section">
          <div className="nav-label">Relations</div>
          {ni('growers', 'plant', 'Growers')}
          {ni('logistics', 'truck', 'Logistics')}
          {ni('companies', 'building', 'Companies')}
        </div>
        <div className="nav-section">
          <div className="nav-label">Finance</div>
          {ni('statements', 'file-invoice', 'Account Statements')}
          {ni('claims', 'alert-triangle', 'Claims')}
        </div>
        <div className="nav-section">
          <div className="nav-label">Admin</div>
          {ni('products', 'flower', 'Products')}
          {ni('users', 'users', 'Users')}
          {ni('settings', 'settings', 'Settings')}
        </div>
      </div>
      <div className="sidebar-footer">
        <div className="user-row" onClick={onSignOut}>
          <div className="avatar">{(user?.email || 'U').slice(0, 2).toUpperCase()}</div>
          <div>
            <div className="user-name">{user?.email?.split('@')[0]}</div>
            <div className="user-role">Admin · sign out</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shipment Form (shared by New + Edit) ──────────────────────────────────────
function ShipmentForm({ initial, logistics, onClose, onSave, title }) {
  const airlines     = logistics.filter(l => l.type === 'airline')
  const cargoAgents  = logistics.filter(l => l.type === 'cargo_agent')
  const customsAgents= logistics.filter(l => l.type === 'customs_agent')
  const handling     = logistics.filter(l => l.type === 'handling')
  const trucking     = logistics.filter(l => l.type === 'trucking')

  const airports = { EC: ['UIO', 'GYE'], CO: ['BOG', 'MDE'], KE: ['NBO'], ET: ['ADD'], ZW: ['HRE'], TZ: ['DAR'], ZA: ['JNB', 'CPT'] }

  const [f, setF] = useState({
    origin_country: 'EC', origin_airport: 'UIO', destination_airport: 'AMS',
    airline_id: '', cargo_agent_id: '', customs_agent_id: '', handling_id: '', trucking_id: '',
    drop_date: '', departure_date: '', arrival_date: '', notes: '',
    ...initial
  })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!f.drop_date) { setErr('Drop date is required to save a shipment.'); return }
    setSaving(true)
    const payload = {
      ...f,
      airline_id:       f.airline_id || null,
      cargo_agent_id:   f.cargo_agent_id || null,
      customs_agent_id: f.customs_agent_id || null,
      handling_id:      f.handling_id || null,
      trucking_id:      f.trucking_id || null,
      departure_date:   f.departure_date || null,
      arrival_date:     f.arrival_date || null,
    }
    let data, error
    if (initial?.id) {
      ;({ data, error } = await supabase.from('shipments').update(payload).eq('id', initial.id).select().single())
    } else {
      ;({ data, error } = await supabase.from('shipments').insert([{ ...payload, status: 'draft' }]).select().single())
    }
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSave(data)
  }

  const originAirports = airports[f.origin_country] || [f.origin_airport]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <i className="ti ti-plane" style={{ fontSize: 17, color: 'var(--green)' }} aria-hidden="true" />
          <div className="modal-title">{title}</div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          {err && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 7, fontSize: 13 }}>{err}</div>}

          <div className="form-section-label">Route</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Origin country</label>
              <CountrySelect value={f.origin_country} onChange={v => { set('origin_country', v); set('origin_airport', airports[v]?.[0] || '') }} />
            </div>
            <div className="form-group">
              <label className="form-label">Departure airport</label>
              <select className="form-select" value={f.origin_airport} onChange={e => set('origin_airport', e.target.value)}>
                {originAirports.map(a => <option key={a}>{a}</option>)}
                {!originAirports.includes(f.origin_airport) && f.origin_airport &&
                  <option value={f.origin_airport}>{f.origin_airport}</option>}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Destination airport</label>
              <input className="form-input" value={f.destination_airport} onChange={e => set('destination_airport', e.target.value.toUpperCase())} maxLength={4} />
            </div>
          </div>

          <div className="form-section-label" style={{ marginTop: 4 }}>Dates</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Drop date *</label>
              <input
                className={`form-input${err && !f.drop_date ? ' error' : ''}`}
                type="date"
                value={f.drop_date}
                min={initial?.id ? undefined : new Date().toISOString().split('T')[0]}
                onChange={e => set('drop_date', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Departure date</label>
              <input className="form-input" type="date" value={f.departure_date} onChange={e => set('departure_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Est. arrival date</label>
              <input className="form-input" type="date" value={f.arrival_date} onChange={e => set('arrival_date', e.target.value)} />
            </div>
          </div>

          <div className="form-section-label" style={{ marginTop: 4 }}>Logistics partners</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cargo agent</label>
              <select className="form-select" value={f.cargo_agent_id} onChange={e => set('cargo_agent_id', e.target.value)}>
                <option value="">— Select —</option>
                {cargoAgents.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Airline</label>
              <select className="form-select" value={f.airline_id} onChange={e => set('airline_id', e.target.value)}>
                <option value="">— Select —</option>
                {airlines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Customs agent</label>
              <select className="form-select" value={f.customs_agent_id} onChange={e => set('customs_agent_id', e.target.value)}>
                <option value="">— Select —</option>
                {customsAgents.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Handling company</label>
              <select className="form-select" value={f.handling_id} onChange={e => set('handling_id', e.target.value)}>
                <option value="">— None —</option>
                {handling.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Trucking company</label>
              <select className="form-select" value={f.trucking_id} onChange={e => set('trucking_id', e.target.value)}>
                <option value="">— None —</option>
                {trucking.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-group" />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={f.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Any notes…" style={{ minHeight: 56 }} />
          </div>
        </div>
        <div className="modal-footer">
          {initial?.id && (
            <button className="btn btn-danger btn-sm" style={{ marginRight: 'auto' }} onClick={async () => {
              if (!window.confirm(`⚠️ Permanently delete this shipment and all its PO lines? This cannot be undone.`)) return
              await supabase.from('purchase_orders').delete().eq('shipment_id', initial.id)
              await supabase.from('shipments').delete().eq('id', initial.id)
              onSave(null) // signal deletion
            }}>
              <i className="ti ti-trash" /> Delete shipment permanently
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <i className="ti ti-check" aria-hidden="true" />{saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Create shipment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Split Shipment Modal ──────────────────────────────────────────────────────
function SplitShipmentModal({ shipmentId, shipments, onClose, onSplit }) {
  const [targetId, setTargetId] = useState('')
  const [splitting, setSplitting] = useState(false)
  const others = shipments.filter(s => s.id !== shipmentId && ['draft', 'active'].includes(s.status))

  const handleSplit = async () => {
    if (!targetId) return
    setSplitting(true)
    onSplit(targetId)
    setSplitting(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <i className="ti ti-git-branch" style={{ fontSize: 17, color: 'var(--green)' }} aria-hidden="true" />
          <div className="modal-title">Split — Move boxes to another shipment</div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Select boxes in the PO list first, then choose a destination shipment. The selected boxes and all their PO lines will be moved completely.
          </div>
          <div className="form-group">
            <label className="form-label">Move selected boxes to</label>
            <select className="form-select" value={targetId} onChange={e => setTargetId(e.target.value)}>
              <option value="">— Select shipment —</option>
              {others.map(s => (
                <option key={s.id} value={s.id}>
                  {s.origin_airport} → {s.destination_airport} · {s.drop_date || 'no date'} {s.mawb ? `· AWB ${s.mawb}` : ''}
                </option>
              ))}
            </select>
            {others.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>No other draft/active shipments found. Create one first.</div>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSplit} disabled={!targetId || splitting}>
            <i className="ti ti-transfer" aria-hidden="true" />{splitting ? 'Moving…' : 'Move boxes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shipment Detail ───────────────────────────────────────────────────────────
function ShipmentDetail({ shipment, growers, products, logistics, allShipments, onBack, onUpdate, onDelete }) {
  const [tab, setTab] = useState('orders')
  const [s, setS] = useState(shipment)
  const [showEdit, setShowEdit] = useState(false)
  const [showSplit, setShowSplit] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [confirmReceived, setConfirmReceived] = useState(false)

  const airline     = logistics.find(l => l.id === s.airline_id)
  const cargoAgent  = logistics.find(l => l.id === s.cargo_agent_id)
  const customsAgent= logistics.find(l => l.id === s.customs_agent_id)

  const updateStatus = async status => {
    const { data } = await supabase.from('shipments').update({ status }).eq('id', s.id).select().single()
    if (data) { setS(data); onUpdate(data) }
  }

  const updateField = async (field, value) => {
    const { data } = await supabase.from('shipments').update({ [field]: value }).eq('id', s.id).select().single()
    if (data) { setS(data); onUpdate(data) }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this draft shipment? This cannot be undone.')) return
    await supabase.from('purchase_orders').delete().eq('shipment_id', s.id)
    await supabase.from('shipments').delete().eq('id', s.id)
    onDelete(s.id)
  }

  const handleEdit = updated => {
    if (updated === null) { onDelete(s.id); return } // hard delete
    setS(updated); onUpdate(updated); setShowEdit(false)
  }

  const handleClosePurchasing = async () => {
    await updateStatus('in_transit')
    setConfirmClose(false)
  }

  const handleMarkReceived = async () => {
    await updateStatus('completed')
    setConfirmReceived(false)
  }

  // Action buttons based on current status
  const actionButtons = () => {
    switch (s.status) {
      case 'draft':
        return <button className="btn btn-danger btn-sm" onClick={handleDelete}><i className="ti ti-trash" /> Delete draft</button>
      case 'active':
        return (
          <button className="btn btn-primary btn-sm" onClick={() => setConfirmClose(true)}>
            <i className="ti ti-lock" /> Close purchasing
          </button>
        )
      case 'arrived':
        return (
          <button className="btn btn-brown btn-sm" onClick={() => setConfirmReceived(true)}>
            <i className="ti ti-check" /> Mark as received
          </button>
        )
      default:
        return null
    }
  }

  return (
    <>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}><i className="ti ti-arrow-left" /> Shipments</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => setShowSplit(true)}>
          <i className="ti ti-git-branch" /> Split shipment
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(true)}>
          <i className="ti ti-edit" /> Edit shipment
        </button>
        {s.status === 'draft' && (
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>
            <i className="ti ti-trash" /> Delete draft
          </button>
        )}
        {s.status === 'arrived' && (
          <button className="btn btn-brown btn-sm" onClick={() => setConfirmReceived(true)}>
            <i className="ti ti-check" /> Mark as received
          </button>
        )}
        <StatusBadge status={s.status} />
      </div>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 21, fontWeight: 400, color: 'var(--text-1)' }}>
          {s.mawb ? `AWB ${s.mawb}` : 'Shipment — AWB pending'}
        </h1>
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
          {flag(s.origin_country)} {s.origin_airport} → {s.destination_airport}
          {airline && ` · ${airline.name}`}
        </span>
      </div>

      {/* Meta grid */}
      <div className="meta-grid">
        {[
          { label: 'Drop date',         value: s.drop_date || '—',             mono: true },
          { label: 'Departure',         value: s.departure_date || '—',        mono: true },
          { label: 'Est. arrival',      value: s.arrival_date || '—',          mono: true },
          { label: 'AWB',               value: s.mawb || '—',                  mono: true },
          { label: 'HAWB',              value: s.hawb || '—',                  mono: true },
          { label: 'Cargo agent',       value: cargoAgent?.name || '—' },
          { label: 'Airline',           value: airline?.name || '—' },
          { label: 'Customs agent',     value: customsAgent?.name || '—' },
          { label: 'Chargeable weight', value: s.chargeable_weight ? `${s.chargeable_weight} kg` : '—', mono: true },
        ].map(m => (
          <div className="meta-item" key={m.label}>
            <div className="meta-label">{m.label}</div>
            <div className={`meta-value${m.mono ? ' mono' : ''}`}>{m.value}</div>
          </div>
        ))}
        {/* Notes — full width */}
        <div className="meta-item" style={{ gridColumn: '1 / -1' }}>
          <div className="meta-label">Notes</div>
          <textarea
            className="meta-notes-input"
            defaultValue={s.notes || ''}
            placeholder="Add shipment notes…"
            onBlur={e => updateField('notes', e.target.value || null)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="tabs" style={{ padding: '0 20px' }}>
          <div className={`tab${tab === 'orders' ? ' active' : ''}`} onClick={() => setTab('orders')}>Purchase Order List</div>
          <div className={`tab${tab === 'costs' ? ' active' : ''}`} onClick={() => setTab('costs')}>Costs & AWB</div>
          <div className={`tab${tab === 'docs' ? ' active' : ''}`} onClick={() => setTab('docs')}>Documents</div>
        </div>

        {tab === 'orders' && (
          <div style={{ padding: 16 }}>
            <POEditor
              shipmentId={s.id}
              farms={growers}
              products={products}
              onFirstLineAdded={() => s.status === 'draft' && updateStatus('active')}
              onClosePurchasing={s.status === 'active' ? () => setConfirmClose(true) : null}
            />
          </div>
        )}

        {tab === 'costs' && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Enter AWB details once received. Used to calculate landed cost per stem.</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">MAWB number</label>
                <input className="form-input" defaultValue={s.mawb || ''} onBlur={e => updateField('mawb', e.target.value || null)} placeholder="e.g. 5Y-12345678" />
              </div>
              <div className="form-group">
                <label className="form-label">HAWB number</label>
                <input className="form-input" defaultValue={s.hawb || ''} onBlur={e => updateField('hawb', e.target.value || null)} placeholder="optional" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Gross weight (kg)</label>
                <input className="form-input" type="number" defaultValue={s.gross_weight || ''} onBlur={e => updateField('gross_weight', e.target.value || null)} />
              </div>
              <div className="form-group">
                <label className="form-label">Chargeable weight (kg)</label>
                <input className="form-input" type="number" defaultValue={s.chargeable_weight || ''} onBlur={e => updateField('chargeable_weight', e.target.value || null)} />
              </div>
              <div className="form-group">
                <label className="form-label">AWB total cost (USD)</label>
                <input className="form-input" type="number" step="0.01" defaultValue={s.awb_total_cost || ''} onBlur={e => updateField('awb_total_cost', e.target.value || null)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Customs cost (EUR)</label>
                <input className="form-input" type="number" step="0.01" defaultValue={s.customs_cost || ''} onBlur={e => updateField('customs_cost', e.target.value || null)} />
              </div>
              <div className="form-group">
                <label className="form-label">Handling cost (EUR)</label>
                <input className="form-input" type="number" step="0.01" defaultValue={s.handling_cost || ''} onBlur={e => updateField('handling_cost', e.target.value || null)} />
              </div>
              <div className="form-group">
                <label className="form-label">Other costs (EUR)</label>
                <input className="form-input" type="number" step="0.01" defaultValue={s.other_costs || ''} onBlur={e => updateField('other_costs', e.target.value || null)} />
              </div>
            </div>
          </div>
        )}

        {tab === 'docs' && (
          <div className="empty" style={{ padding: '48px 20px' }}>
            <i className="ti ti-file-upload" />
            <div className="empty-title">Document vault</div>
            <div className="empty-sub">Invoice upload, AWB, phytosanitary — coming next</div>
          </div>
        )}
      </div>

      {/* Close purchasing confirm */}
      {confirmClose && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <i className="ti ti-lock" style={{ fontSize: 17, color: 'var(--green)' }} />
              <div className="modal-title">Close purchasing?</div>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                This marks purchasing as closed. The shipment will move to <strong>In Transit</strong> status.
                No more PO changes should be made after this point.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmClose(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleClosePurchasing}>
                <i className="ti ti-lock" /> Confirm — close purchasing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark received confirm */}
      {confirmReceived && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <i className="ti ti-check" style={{ fontSize: 17, color: 'var(--green)' }} />
              <div className="modal-title">Mark as received?</div>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                Confirm that this shipment has been received in Aalsmeer. The shipment will be marked <strong>Completed</strong>.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmReceived(false)}>Cancel</button>
              <button className="btn btn-brown" onClick={handleMarkReceived}>
                <i className="ti ti-check" /> Confirm — mark received
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit shipment modal */}
      {showEdit && (
        <ShipmentForm
          title="Edit Shipment"
          initial={s}
          logistics={logistics}
          onClose={() => setShowEdit(false)}
          onSave={handleEdit}
        />
      )}

      {/* Split shipment modal */}
      {showSplit && (
        <SplitShipmentModal
          shipmentId={s.id}
          shipments={allShipments}
          onClose={() => setShowSplit(false)}
          onSplit={targetId => { setShowSplit(false); alert(`Split feature: select boxes in the PO list, then use this to move them. Full box-selection UI coming next.`) }}
        />
      )}
    </>
  )
}

// ── Shipments List ────────────────────────────────────────────────────────────
function ShipmentsPage({ shipments, logistics, onSelect, onNew }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = shipments.filter(s => {
    const q = search.toLowerCase()
    const ms = !q || (s.mawb || '').toLowerCase().includes(q) || (s.origin_airport || '').toLowerCase().includes(q) || (s.destination_airport || '').toLowerCase().includes(q)
    const mf = filter === 'all' || s.status === filter
    return ms && mf
  })

  const airline = id => logistics.find(l => l.id === id)?.name || '—'

  const counts = SHIP_STATUSES.reduce((acc, st) => {
    acc[st] = shipments.filter(s => s.status === st).length
    return acc
  }, {})

  return (
    <>
      <div className="kpi-grid">
        {[
          { label: 'Draft', value: counts.draft },
          { label: 'Active', value: counts.active, gold: true },
          { label: 'In Transit / Departed', value: (counts.in_transit || 0) + (counts.departed || 0) },
          { label: 'Arrived / Completed', value: (counts.arrived || 0) + (counts.completed || 0) },
        ].map(k => (
          <div className="kpi-card" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value${k.gold ? ' brown' : ''}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">All shipments</div>
          <input className="search-input" placeholder="Search AWB, airport…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select" style={{ width: 'auto', fontSize: 12 }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {SHIP_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <button className="btn btn-primary" onClick={onNew}><i className="ti ti-plus" aria-hidden="true" /> New shipment</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Route</th><th>AWB</th><th>Airline</th><th>Drop date</th><th>Departure</th><th>Est. Arrival</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => onSelect(s)}>
                  <td>
                    <span className="route-cell">
                      <span className="flag">{flag(s.origin_country)}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.origin_airport}</span>
                      <span className="arrow">→</span>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.destination_airport}</span>
                    </span>
                  </td>
                  <td><span className="td-brown">{s.mawb || <span style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 12 }}>pending</span>}</span></td>
                  <td className="td-muted">{airline(s.airline_id)}</td>
                  <td className="td-mono">{s.drop_date || '—'}</td>
                  <td className="td-mono">{s.departure_date || '—'}</td>
                  <td className="td-mono">{s.arrival_date || '—'}</td>
                  <td><StatusBadge status={s.status} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty"><i className="ti ti-plane" /><div className="empty-title">No shipments found</div></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── Products Page ─────────────────────────────────────────────────────────────
function ProductsPage({ products }) {
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('all')
  const [page, setPage] = useState(1)
  const PER_PAGE = 50

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    const ms = !q || (p.name || '').toLowerCase().includes(q) || (p.vbn_code || '').includes(q)
    const mc = countryFilter === 'all' || p.country === countryFilter
    return ms && mc
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const countries = [...new Set(products.map(p => p.country).filter(Boolean))].sort()

  return (
    <div className="card" style={{ overflow: 'visible' }}>
      <div className="card-header">
        <div className="card-title">Product Catalogue <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 12 }}>({filtered.length} of {products.length})</span></div>
        <input className="search-input" placeholder="Search by name, VBN code…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }} />
        <div className="product-catalogue-filters">
          <div className={`filter-chip${countryFilter === 'all' ? ' active' : ''}`} onClick={() => { setCountryFilter('all'); setPage(1) }}>All</div>
          {countries.map(c => (
            <div key={c} className={`filter-chip${countryFilter === c ? ' active' : ''}`} onClick={() => { setCountryFilter(c); setPage(1) }}>
              {flag(c)} {c}
            </div>
          ))}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>VBN Code</th><th>Name</th><th>VBN Name</th><th>Country</th><th>BKH</th><th>Ripeness</th><th>Quality</th></tr></thead>
          <tbody>
            {paged.map(p => (
              <tr key={p.id} style={{ cursor: 'default' }}>
                <td className="td-mono">{p.vbn_code || '—'}</td>
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td className="td-muted" style={{ fontSize: 12 }}>{p.vbn_name || '—'}</td>
                <td>{p.country ? `${flag(p.country)} ${p.country}` : '—'}</td>
                <td className="td-mono">{p.bkh || '—'}</td>
                <td className="td-muted">{p.ripeness || '—'}</td>
                <td className="td-muted">{p.quality || '—'}</td>
              </tr>
            ))}
            {paged.length === 0 && <tr><td colSpan={7}><div className="empty"><i className="ti ti-flower" /><div className="empty-title">No products found</div></div></td></tr>}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '0.5px solid var(--border)', background: 'var(--surface)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Page {page} of {totalPages} · {filtered.length} products</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardPage({ shipments, logistics }) {
  const airline = id => logistics.find(l => l.id === id)?.name || '—'
  const active = shipments.filter(s => ['active', 'in_transit', 'departed', 'arrived'].includes(s.status))
  return (
    <>
      <div className="kpi-grid">
        {[
          { label: 'Active shipments', value: shipments.filter(s => s.status === 'active').length },
          { label: 'In transit / Departed', value: shipments.filter(s => ['in_transit', 'departed'].includes(s.status)).length, gold: true },
          { label: 'Arrived', value: shipments.filter(s => s.status === 'arrived').length },
          { label: 'Completed', value: shipments.filter(s => s.status === 'completed').length },
        ].map(k => (
          <div className="kpi-card" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value${k.gold ? ' brown' : ''}`}>{k.value}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Active & in-progress shipments</div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Route</th><th>AWB</th><th>Airline</th><th>Drop date</th><th>Departure</th><th>Status</th></tr></thead>
            <tbody>
              {active.slice(0, 8).map(s => (
                <tr key={s.id}>
                  <td><span className="route-cell"><span className="flag">{flag(s.origin_country)}</span><span style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.origin_airport}</span><span className="arrow">→</span><span style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.destination_airport}</span></span></td>
                  <td className="td-brown">{s.mawb || '—'}</td>
                  <td className="td-muted">{airline(s.airline_id)}</td>
                  <td className="td-mono">{s.drop_date || '—'}</td>
                  <td className="td-mono">{s.departure_date || '—'}</td>
                  <td><StatusBadge status={s.status} /></td>
                </tr>
              ))}
              {active.length === 0 && <tr><td colSpan={6}><div className="empty"><i className="ti ti-plane" /><div className="empty-title">No active shipments</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function ComingSoon({ icon, title, sub }) {
  return <div className="card" style={{ padding: '80px 20px' }}><div className="empty"><i className={`ti ti-${icon}`} /><div className="empty-title">{title}</div><div className="empty-sub">{sub}</div></div></div>
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('shipments')
  const [shipments, setShipments] = useState([])
  const [growers, setGrowers] = useState([])
  const [products, setProducts] = useState([])
  const [logistics, setLogistics] = useState([])
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [showNewShipment, setShowNewShipment] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setUser(session?.user ?? null); setLoading(false) })
    supabase.auth.onAuthStateChange((_, session) => setUser(session?.user ?? null))
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('shipments').select('*').order('created_at', { ascending: false }).then(({ data }) => setShipments(data || []))
    supabase.from('companies').select('*').eq('type', 'grower').order('name').then(({ data }) => setGrowers(data || []))
    supabase.from('products').select('*').order('name').then(({ data }) => setProducts(data || []))
    supabase.from('companies').select('*').eq('type', 'logistics').order('name').then(({ data }) => setLogistics(data || []))
  }, [user])

  const handleSignOut = async () => { await supabase.auth.signOut(); setUser(null) }

  const handleNewShipment = s => {
    setShipments(p => [s, ...p])
    setShowNewShipment(false)
    setSelectedShipment(s)
  }

  const handleShipmentUpdate = u => {
    setShipments(p => p.map(s => s.id === u.id ? u : s))
    setSelectedShipment(u)
  }

  const handleShipmentDelete = id => {
    setShipments(p => p.filter(s => s.id !== id))
    setSelectedShipment(null)
  }

  const navPage = p => { setPage(p); setSelectedShipment(null) }
  const pendingCount = shipments.filter(s => ['draft', 'active', 'in_transit'].includes(s.status)).length

  const topTitles = {
    dashboard: 'Dashboard', shipments: 'Shipments', templates: 'PO Templates',
    growers: 'Growers', logistics: 'Logistics Partners',
    statements: 'Account Statements', claims: 'Claims & Credit Notes',
    products: 'Product Catalogue', users: 'Users', settings: 'Settings', companies: 'Companies'
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--green-deep)', color: '#996633', fontSize: 20, letterSpacing: '0.24em' }}>
      ORIGINS
    </div>
  )
  if (!user) return <><style>{CSS}</style><LoginPage onLogin={setUser} /></>

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <Sidebar page={selectedShipment ? 'shipments' : page} setPage={navPage} user={user} pendingCount={pendingCount} onSignOut={handleSignOut} />
        <div className="main">
          <div className="topbar">
            <div className="topbar-title">
              {selectedShipment
                ? <>{selectedShipment.mawb || 'Shipment'} <span className="topbar-sub">{selectedShipment.origin_airport} → {selectedShipment.destination_airport}</span></>
                : topTitles[page]}
            </div>
          </div>
          <div className="page">
            {page === 'dashboard' && !selectedShipment && <DashboardPage shipments={shipments} logistics={logistics} />}
            {page === 'shipments' && !selectedShipment && <ShipmentsPage shipments={shipments} logistics={logistics} onSelect={s => { setSelectedShipment(s); setPage('shipments') }} onNew={() => setShowNewShipment(true)} />}
            {page === 'shipments' && selectedShipment && (
              <ShipmentDetail
                shipment={selectedShipment}
                growers={growers}
                products={products}
                logistics={logistics}
                allShipments={shipments}
                onBack={() => setSelectedShipment(null)}
                onUpdate={handleShipmentUpdate}
                onDelete={handleShipmentDelete}
              />
            )}
            {page === 'growers' && <CompaniesPage initialType="grower" />}
            {page === 'logistics' && <CompaniesPage initialType="logistics" />}
            {page === 'companies' && <CompaniesPage />}
            {page === 'products' && <ProductsPage products={products} />}
            {page === 'templates' && <ComingSoon icon="template" title="PO Templates" sub="Save and reuse purchase order lists — coming next" />}
            {page === 'statements' && <ComingSoon icon="file-invoice" title="Account Statements" sub="Monthly farm payment reconciliation — coming next" />}
            {page === 'claims' && <ComingSoon icon="alert-triangle" title="Claims & Credit Notes" sub="Quality claims management — coming next" />}
            {page === 'users' && <ComingSoon icon="users" title="Users" sub="User management — coming next" />}
            {page === 'settings' && <ComingSoon icon="settings" title="Settings" sub="Global settings — coming next" />}
          </div>
        </div>
      </div>
      {showNewShipment && (
        <ShipmentForm
          title="New Shipment"
          logistics={logistics}
          onClose={() => setShowNewShipment(false)}
          onSave={handleNewShipment}
        />
      )}
    </>
  )
}
// cache bust Mon May 25 20:15:43 UTC 2026
