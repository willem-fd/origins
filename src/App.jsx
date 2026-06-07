import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { CSS } from './styles'
import POEditor from './POEditor'
import CompaniesPage from './CompaniesPage'
import CompanyProfile from './CompanyProfile'
import TemplatesPage from './Templates'
import InvitationsPage, { AcceptInvitation, ConnectionRequestsPage } from './Invitations'
import MyProfile from './MyProfile'
import TeamPage from './TeamPage'
import GrowerOrdersPage from './GrowerOrders'
import CountryCombobox from './CountryCombobox'
import Auth from './Auth'
import { COUNTRIES, SHIP_STATUSES, STATUS_LABELS, STATUS_BADGE, flag, fmt, validateEmail, validatePhone } from './constants'

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_BADGE[status] || 'badge-draft'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

// ── Account-type navigation ───────────────────────────────────────────────────
// Each account type sees a different app. Super admin sees everything; buyer,
// grower and logistics each get their own tailored navigation.
const ACCOUNT_LABELS = { super: 'Super admin', buyer: 'Buyer', grower: 'Grower', logistics: 'Logistics' }

const NAV = {
  super: [
    { label: 'Overview',   items: [['dashboard', 'layout-dashboard', 'Dashboard']] },
    { label: 'Purchasing', items: [['shipments', 'plane', 'Shipments'], ['templates', 'template', 'PO Templates']] },
    { label: 'Relations',  items: [['growers', 'plant', 'Growers'], ['logistics', 'truck', 'Logistics'], ['companies', 'building', 'Companies']] },
    { label: 'Finance',    items: [['statements', 'file-invoice', 'Account Statements'], ['claims', 'alert-triangle', 'Claims']] },
    { label: 'Admin',      items: [['products', 'flower', 'Products'], ['users', 'users', 'Users'], ['invitations', 'mail', 'Invitations'], ['settings', 'settings', 'Settings']] },
  ],
  buyer: [
    { label: 'Overview',   items: [['dashboard', 'layout-dashboard', 'Dashboard']] },
    { label: 'Purchasing', items: [['shipments', 'plane', 'Shipments'], ['templates', 'template', 'PO Templates']] },
    { label: 'Relations',  items: [['growers', 'plant', 'Growers'], ['logistics', 'truck', 'Logistics']] },
    { label: 'Finance',    items: [['statements', 'file-invoice', 'Account Statements'], ['claims', 'alert-triangle', 'Claims']] },
    { label: 'Account',    items: [['users', 'users', 'Team'], ['invitations', 'mail', 'Invitations'], ['settings', 'settings', 'Settings']] },
  ],
  grower: [
    { label: 'Overview', items: [['dashboard', 'layout-dashboard', 'Dashboard']] },
    { label: 'Orders',   items: [['shipments', 'plane', 'Orders']] },
    { label: 'Finance',  items: [['invoices', 'file-invoice', 'Invoices'], ['statements', 'file-invoice', 'Statements']] },
    { label: 'Account',  items: [['connections', 'link', 'Connection Requests'], ['settings', 'settings', 'Settings']] },
  ],
  logistics: [
    { label: 'Overview',   items: [['dashboard', 'layout-dashboard', 'Dashboard']] },
    { label: 'Logistics',  items: [['shipments', 'plane', 'Assigned Shipments'], ['documents', 'file', 'Documents']] },
    { label: 'Account',    items: [['connections', 'link', 'Connection Requests'], ['settings', 'settings', 'Settings']] },
  ],
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
const ADMIN_ONLY_ITEMS = new Set(['invitations', 'connections'])
function Sidebar({ page, setPage, profile, accountType, pendingCount, pendingConnections, onSignOut, showViewAs, onOpenViewAs, onOpenProfile }) {
  const isAdmin = !!profile?.is_super_admin || profile?.role === 'admin'
  const sections = (NAV[accountType] || NAV.buyer)
    .map(sec => ({ ...sec, items: sec.items.filter(([id]) => isAdmin || !ADMIN_ONLY_ITEMS.has(id)) }))
    .filter(sec => sec.items.length > 0)
  const [menuOpen, setMenuOpen] = useState(false)
  const ni = (id, icon, label) => (
    <div key={id} className={`nav-item${page === id ? ' active' : ''}`} onClick={() => setPage(id)}>
      <i className={`ti ti-${icon}`} aria-hidden="true" />{label}
      {id === 'shipments' && pendingCount ? <span className="nav-badge">{pendingCount}</span> : null}
      {id === 'connections' && pendingConnections ? <span className="nav-badge">{pendingConnections}</span> : null}
    </div>
  )
  const roleText = profile?.is_super_admin ? 'Super admin'
    : (profile?.role === 'admin' ? 'Admin' : 'Member')

  // Close popover on outside click
  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e) => {
      if (!e.target.closest?.('.user-menu-wrap')) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  return (
    <div className="sidebar">
      <div className="sidebar-logo" onClick={() => setPage('dashboard')}>
        <img src="/origins-logo.svg" alt="Origins" style={{ width: 130, height: 'auto' }} />
      </div>
      <div className="sidebar-nav">
        {sections.map(sec => (
          <div className="nav-section" key={sec.label}>
            <div className="nav-label">{sec.label}</div>
            {sec.items.map(([id, icon, label]) => ni(id, icon, label))}
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        {showViewAs && (
          <div className="nav-item" style={{ marginBottom: 6 }} onClick={onOpenViewAs}>
            <i className="ti ti-eye" aria-hidden="true" />View as company…
          </div>
        )}
        <div className="user-menu-wrap" style={{ position: 'relative' }}>
          {menuOpen && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6,
              background: 'var(--green-dark)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.24)', padding: 4, zIndex: 10
            }}>
              <div className="nav-item" style={{ margin: 0 }} onClick={() => { setMenuOpen(false); onOpenProfile?.() }}>
                <i className="ti ti-user" aria-hidden="true" />My profile
              </div>
              <div className="nav-item" style={{ margin: 0 }} onClick={() => { setMenuOpen(false); onSignOut() }}>
                <i className="ti ti-logout" aria-hidden="true" />Sign out
              </div>
            </div>
          )}
          <div className="user-row" onClick={() => setMenuOpen(o => !o)} style={{ cursor: 'pointer' }}>
            <div className="avatar">{((profile?.first_name?.[0] || '') + (profile?.last_name?.[0] || '') || 'U').toUpperCase()}</div>
            <div>
              <div className="user-name">{`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'User'}</div>
              <div className="user-role">{roleText}</div>
            </div>
            <i className="ti ti-chevron-up" style={{ marginLeft: 'auto', fontSize: 16, color: 'var(--text-3)' }} aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── View-as: company picker (super admin only) ────────────────────────────────
function ViewAsModal({ companies, onPick, onClose }) {
  const [q, setQ] = useState('')
  const [tf, setTf] = useState('all')
  const list = companies.filter(c => {
    const ql = q.toLowerCase()
    const mq = !q || c.name.toLowerCase().includes(ql) || (c.brand_name || '').toLowerCase().includes(ql)
    const mt = tf === 'all' || c.type === tf
    return mq && mt
  })
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title"><i className="ti ti-eye" aria-hidden="true" /> View as company</div>
          <div className="btn-icon" onClick={onClose}><i className="ti ti-x" aria-hidden="true" /></div>
        </div>
        <div className="modal-body">
          <input className="form-input" placeholder="Search companies…" value={q} onChange={e => setQ(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['all', 'buyer', 'grower', 'logistics'].map(t => (
              <div key={t} className={`filter-chip${tf === t ? ' active' : ''}`} onClick={() => setTf(t)}>
                {t === 'all' ? 'All' : ACCOUNT_LABELS[t]}
              </div>
            ))}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto', margin: '0 -4px' }}>
            {list.length === 0 && <div className="empty-sub" style={{ padding: '20px 4px', color: 'var(--text-3)' }}>No companies found.</div>}
            {list.map(c => (
              <div
                key={c.id}
                onClick={() => onPick(c)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{c.brand_name || c.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{ACCOUNT_LABELS[c.type] || c.type}</div>
                </div>
                <i className="ti ti-arrow-right" style={{ color: 'var(--text-3)' }} aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── View-as: persistent banner while impersonating ────────────────────────────
function ViewAsBanner({ company, onSwitch, onExit }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px',
      background: 'var(--brown)', color: '#fff', fontSize: 13, fontWeight: 500,
    }}>
      <i className="ti ti-eye" aria-hidden="true" />
      <span>Viewing as <strong>{company.brand_name || company.name}</strong> · {ACCOUNT_LABELS[company.type] || company.type}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <button className="btn btn-xs" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }} onClick={onSwitch}>Switch</button>
        <button className="btn btn-xs" style={{ background: '#fff', color: 'var(--brown-dark)' }} onClick={onExit}>Exit view</button>
      </div>
    </div>
  )
}

// ── Shipment Form (shared by New + Edit) ──────────────────────────────────────
function ShipmentForm({ initial, logistics, buyerCompanyId, onClose, onSave, title }) {
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
      ;({ data, error } = await supabase.from('shipments')
          .insert([{ ...payload, status: 'draft', buyer_company_id: buyerCompanyId || null }])
          .select().single())
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
              <CountryCombobox value={f.origin_country} onChange={v => { set('origin_country', v); set('origin_airport', airports[v]?.[0] || '') }} />
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
function ShipmentDetail({ shipment, growers, products, logistics, allShipments, companyId, onBack, onUpdate, onDelete }) {
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
              companyId={companyId}
              status={s.status}
              growers={growers}
              products={products}
              onStartPurchasing={s.status === 'draft' ? () => updateStatus('active') : null}
              onClosePurchasing={s.status === 'active' ? () => setConfirmClose(true) : null}
              onReopenPurchasing={s.status === 'in_transit' ? () => {
                if (window.confirm('This will reopen the PO list for editing. Growers will see the shipment is back in Active. Continue?')) {
                  updateStatus('active')
                }
              } : null}
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
          buyerCompanyId={s.buyer_company_id}
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
function ShipmentsPage({ shipments, logistics, companies, showBuyer, onSelect, onNew }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = shipments.filter(s => {
    const q = search.toLowerCase()
    const ms = !q || (s.mawb || '').toLowerCase().includes(q) || (s.origin_airport || '').toLowerCase().includes(q) || (s.destination_airport || '').toLowerCase().includes(q)
    const mf = filter === 'all' || s.status === filter
    return ms && mf
  })

  const airline = id => logistics.find(l => l.id === id)?.name || '—'
  const buyer   = id => {
    if (!id) return <span style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 12 }}>untagged</span>
    const c = (companies || []).find(c => c.id === id)
    return c ? (c.brand_name || c.name) : '—'
  }

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
              <tr><th>Route</th>{showBuyer && <th>Buyer</th>}<th>AWB</th><th>Airline</th><th>Drop date</th><th>Departure</th><th>Est. Arrival</th><th>Status</th></tr>
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
                  {showBuyer && <td className="td-muted">{buyer(s.buyer_company_id)}</td>}
                  <td><span className="td-brown">{s.mawb || <span style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 12 }}>pending</span>}</span></td>
                  <td className="td-muted">{airline(s.airline_id)}</td>
                  <td className="td-mono">{s.drop_date || '—'}</td>
                  <td className="td-mono">{s.departure_date || '—'}</td>
                  <td className="td-mono">{s.arrival_date || '—'}</td>
                  <td><StatusBadge status={s.status} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={showBuyer ? 8 : 7}>
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

// Settings page = embedded CompanyProfile for the effective company.
// Admins can edit, non-admins see the same UI but RLS will block writes.
function CompanySettingsPage({ companyId }) {
  const [company, setCompany] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (!companyId) { setCompany(null); return }
    ;(async () => {
      const { data } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle()
      if (!cancelled) setCompany(data || null)
    })()
    return () => { cancelled = true }
  }, [companyId])
  if (!companyId) return <ComingSoon icon="settings" title="Settings" sub="Global settings — coming next" />
  if (!company) return <div className="empty"><i className="ti ti-loader" /><div className="empty-title">Loading…</div></div>
  return <CompanyProfile company={company} embedded onUpdate={c => setCompany(c)} />
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [inviteToken, setInviteToken] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('invite') } catch { return null }
  })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('shipments')
  const [shipments, setShipments] = useState([])
  const [growers, setGrowers] = useState([])
  const [products, setProducts] = useState([])
  const [logistics, setLogistics] = useState([])
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [showNewShipment, setShowNewShipment] = useState(false)
  const [companies, setCompanies] = useState([])   // all companies, for the super-admin "view as" picker
  const [viewAs, setViewAs] = useState(null)        // company being impersonated (null = real super-admin)
  const [showViewAs, setShowViewAs] = useState(false)
  const [showMyProfile, setShowMyProfile] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setUser(session?.user ?? null); setLoading(false) })
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      setUser(session?.user ?? null)
    })
  }, [])

  // Load the user's row from public.users (links the auth login to a company + role + super-admin flag).
  // Company type is fetched in a separate query so a missing/inaccessible company can't null the whole profile.
  useEffect(() => {
    if (!user) { setProfile(null); return }
    let cancelled = false
    ;(async () => {
      const { data: prof, error } = await supabase
        .from('users').select('*').eq('id', user.id).maybeSingle()
      if (cancelled) return
      if (error || !prof) { setProfile(null); return }
      let account_type = null
      if (prof.company_id) {
        const { data: comp } = await supabase
          .from('companies').select('type').eq('id', prof.company_id).maybeSingle()
        if (cancelled) return
        account_type = comp?.type || null
      }
      setProfile({ ...prof, account_type })
    })()
    return () => { cancelled = true }
  }, [user])

  // Load shipments/companies/products. When viewAs is set we filter the same way RLS would for that
  // user, so the experience mirrors what the impersonated buyer/grower/logistics would actually see.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      let shipmentsData = []
      let growersData = []
      let logisticsData = []

      // ── Shipments ──
      let q = supabase.from('shipments').select('*').order('created_at', { ascending: false })
      if (viewAs?.type === 'buyer') {
        q = q.eq('buyer_company_id', viewAs.id)
        const { data } = await q
        if (cancelled) return
        shipmentsData = data || []
      } else if (viewAs?.type === 'grower') {
        const { data: lines } = await supabase.from('purchase_orders')
          .select('shipment_id').eq('grower_company_id', viewAs.id)
        if (cancelled) return
        const sIds = [...new Set((lines || []).map(l => l.shipment_id))]
        if (sIds.length) {
          const { data } = await q.in('id', sIds).neq('status', 'draft')
          if (cancelled) return
          shipmentsData = data || []
        }
      } else if (viewAs?.type === 'logistics') {
        const orExpr = ['cargo_agent_id','airline_id','customs_agent_id','trucking_id','handling_id']
          .map(c => `${c}.eq.${viewAs.id}`).join(',')
        const { data } = await q.or(orExpr)
        if (cancelled) return
        shipmentsData = data || []
      } else {
        const { data } = await q
        if (cancelled) return
        shipmentsData = data || []
      }

      // ── Growers + Logistics lists ──
      if (viewAs?.type === 'buyer') {
        const { data: rels } = await supabase.from('company_relationships')
          .select('partner_company_id, partner_type')
          .eq('buyer_company_id', viewAs.id).eq('status', 'active')
        if (cancelled) return
        const gIds = (rels || []).filter(r => r.partner_type === 'grower').map(r => r.partner_company_id)
        const lIds = (rels || []).filter(r => r.partner_type === 'logistics').map(r => r.partner_company_id)
        if (gIds.length) {
          const { data } = await supabase.from('companies').select('*').eq('type', 'grower').in('id', gIds).order('name')
          if (cancelled) return
          growersData = data || []
        }
        if (lIds.length) {
          const { data } = await supabase.from('companies').select('*').eq('type', 'logistics').in('id', lIds).order('name')
          if (cancelled) return
          logisticsData = data || []
        }
      } else if (viewAs) {
        // Grower / logistics portals don't use the buyer-style growers/logistics lists yet
        growersData = []
        logisticsData = []
      } else {
        // Super admin (no view-as) sees everything
        const [gRes, lRes] = await Promise.all([
          supabase.from('companies').select('*').eq('type', 'grower').order('name'),
          supabase.from('companies').select('*').eq('type', 'logistics').order('name'),
        ])
        if (cancelled) return
        growersData = gRes.data || []
        logisticsData = lRes.data || []
      }

      // ── Products + companies-for-picker ──
      const [pRes, cRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('companies').select('id, name, brand_name, type').order('name'),
      ])
      if (cancelled) return

      setShipments(shipmentsData)
      setGrowers(growersData)
      setLogistics(logisticsData)
      setProducts(pRes.data || [])
      setCompanies(cRes.data || [])
    })()
    return () => { cancelled = true }
  }, [user, viewAs])

  const handleSignOut = async () => { await supabase.auth.signOut(); setUser(null); setProfile(null) }

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

  // Pending connection requests addressed to the currently-viewed company (grower/logistics).
  const [pendingConnections, setPendingConnections] = useState(0)
  const refreshPendingConnections = async () => {
    const cid = viewAs ? viewAs.id : profile?.company_id
    const accountTypeNow = viewAs ? viewAs.type : profile?.account_type
    if (!cid || (accountTypeNow !== 'grower' && accountTypeNow !== 'logistics')) { setPendingConnections(0); return }
    const { count } = await supabase
      .from('company_relationships')
      .select('id', { count: 'exact', head: true })
      .eq('partner_company_id', cid)
      .eq('status', 'pending')
    setPendingConnections(count || 0)
  }
  useEffect(() => { refreshPendingConnections() }, [profile?.company_id, viewAs?.id])

  // ── Effective identity ──────────────────────────────────────────────────────
  // Super admin can "view as" any company. While impersonating, the whole app
  // behaves as that company's account type. realIsSuper stays true so the exit
  // controls remain available.
  const realIsSuper = !!profile?.is_super_admin
  const effectiveProfile = viewAs
    ? { first_name: viewAs.brand_name || viewAs.name, last_name: '', role: 'admin', is_super_admin: false, company_id: viewAs.id }
    : profile
  const accountType = viewAs ? viewAs.type : (realIsSuper ? 'super' : (profile?.account_type || 'buyer'))

  const enterViewAs = c => { setViewAs(c); setShowViewAs(false); setSelectedShipment(null); setPage('dashboard') }
  const exitViewAs = () => { setViewAs(null); setSelectedShipment(null); setPage('shipments') }

  const topTitles = {
    dashboard: 'Dashboard', shipments: 'Shipments', templates: 'PO Templates',
    growers: 'Growers', logistics: 'Logistics Partners',
    statements: 'Account Statements', claims: 'Claims & Credit Notes',
    products: 'Product Catalogue', users: 'Users', invitations: 'Invitations',
    connections: 'Connection Requests',
    settings: 'Settings', companies: 'Companies'
  }

  // Tailored grower/logistics portal pages. These are scaffolds until Wave 3/4 and
  // the RLS pass are done — they intentionally do NOT show buyer-wide data.
  const PORTAL = {
    grower: {
      title: { dashboard: 'Dashboard', shipments: 'Orders', invoices: 'Invoices', statements: 'Statements', settings: 'Settings' },
      page: {
        dashboard:  { icon: 'layout-dashboard', title: 'Grower Dashboard', sub: 'Your orders, confirmations and statements at a glance' },
        shipments:  { icon: 'plane', title: 'Your Orders', sub: 'Purchase orders from your buyers — confirm, counter or cancel each line (Wave 3)' },
        invoices:   { icon: 'file-invoice', title: 'Invoices', sub: 'Upload your invoices; Origins extracts the data automatically (Wave 3)' },
        statements: { icon: 'file-invoice', title: 'Statements', sub: 'Your account statement per buyer (Wave 3)' },
        settings:   { icon: 'settings', title: 'Settings', sub: 'Your company profile and team' },
      },
    },
    logistics: {
      title: { dashboard: 'Dashboard', shipments: 'Assigned Shipments', documents: 'Documents', settings: 'Settings' },
      page: {
        dashboard: { icon: 'layout-dashboard', title: 'Logistics Dashboard', sub: 'Shipments assigned to you, at a glance' },
        shipments: { icon: 'plane', title: 'Assigned Shipments', sub: "Shipments you're handling — box and grower counts, drop dates (Wave 4)" },
        documents: { icon: 'file', title: 'Documents', sub: 'Upload AWBs and shipping docs; Origins extracts AWB, weights and costs (Wave 4)' },
        settings:  { icon: 'settings', title: 'Settings', sub: 'Your company profile and team' },
      },
    },
  }
  const isPortal = accountType === 'grower' || accountType === 'logistics'
  const pageTitle = (isPortal && PORTAL[accountType].title[page]) || topTitles[page] || page

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--green-deep)', color: '#996633', fontSize: 20, letterSpacing: '0.24em' }}>
      ORIGINS
    </div>
  )
  if (inviteToken) return <><style>{CSS}</style><AcceptInvitation token={inviteToken} onDone={() => { window.history.replaceState({}, '', '/'); setInviteToken(null) }} /></>
  if (recoveryMode) return <><style>{CSS}</style><Auth forceMode="reset" onResetDone={() => setRecoveryMode(false)} onLogin={setUser} /></>
  if (!user) return <><style>{CSS}</style><Auth onLogin={setUser} /></>

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <Sidebar
          page={selectedShipment ? 'shipments' : page}
          setPage={navPage}
          profile={effectiveProfile}
          accountType={accountType}
          pendingCount={isPortal ? 0 : pendingCount}
          pendingConnections={pendingConnections}
          onSignOut={handleSignOut}
          showViewAs={realIsSuper && !viewAs}
          onOpenViewAs={() => setShowViewAs(true)}
          onOpenProfile={() => setShowMyProfile(true)}
        />
        <div className="main">
          {viewAs && <ViewAsBanner company={viewAs} onSwitch={() => setShowViewAs(true)} onExit={exitViewAs} />}
          <div className="topbar">
            <div className="topbar-title">
              {!isPortal && selectedShipment
                ? <>{selectedShipment.mawb || 'Shipment'} <span className="topbar-sub">{selectedShipment.origin_airport} → {selectedShipment.destination_airport}</span></>
                : pageTitle}
            </div>
          </div>
          <div className="page">
            {/* Pages available to every account type (incl. grower/logistics portals) */}
            {page === 'connections' && <ConnectionRequestsPage companyId={effectiveProfile?.company_id || null} onRespond={refreshPendingConnections} />}
            {page === 'settings'    && <CompanySettingsPage companyId={effectiveProfile?.company_id || null} />}
            {page === 'users'       && <TeamPage companyId={effectiveProfile?.company_id || null} profile={effectiveProfile} />}
            {accountType === 'grower' && page === 'shipments' && <GrowerOrdersPage companyId={effectiveProfile?.company_id || null} profile={effectiveProfile} />}

            {!['connections', 'settings', 'users'].includes(page) && !(accountType === 'grower' && page === 'shipments') && (isPortal ? (
              <ComingSoon {...(PORTAL[accountType].page[page] || PORTAL[accountType].page.dashboard)} />
            ) : (
            <>
            {page === 'dashboard' && !selectedShipment && <DashboardPage shipments={shipments} logistics={logistics} />}
            {page === 'shipments' && !selectedShipment && <ShipmentsPage shipments={shipments} logistics={logistics} companies={companies} showBuyer={realIsSuper && !viewAs} onSelect={s => { setSelectedShipment(s); setPage('shipments') }} onNew={() => setShowNewShipment(true)} />}
            {page === 'shipments' && selectedShipment && (
              <ShipmentDetail
                shipment={selectedShipment}
                growers={growers}
                products={products}
                logistics={logistics}
                allShipments={shipments}
                companyId={effectiveProfile?.company_id || null}
                onBack={() => setSelectedShipment(null)}
                onUpdate={handleShipmentUpdate}
                onDelete={handleShipmentDelete}
              />
            )}
            {page === 'growers' && <CompaniesPage initialType="grower" viewAsBuyerId={viewAs?.type === 'buyer' ? viewAs.id : null} />}
            {page === 'logistics' && <CompaniesPage initialType="logistics" viewAsBuyerId={viewAs?.type === 'buyer' ? viewAs.id : null} />}
            {page === 'companies' && <CompaniesPage />}
            {page === 'products' && <ProductsPage products={products} />}
            {page === 'templates' && <TemplatesPage companyId={effectiveProfile?.company_id || null} adminAll={realIsSuper && !viewAs} />}
            {page === 'invitations' && <InvitationsPage realProfile={profile} viewAs={viewAs} />}
            {page === 'statements' && <ComingSoon icon="file-invoice" title="Account Statements" sub="Monthly grower payment reconciliation — coming next" />}
            {page === 'claims' && <ComingSoon icon="alert-triangle" title="Claims & Credit Notes" sub="Quality claims management — coming next" />}
            </>
            ))}
          </div>
        </div>
      </div>
      {showViewAs && (
        <ViewAsModal companies={companies} onPick={enterViewAs} onClose={() => setShowViewAs(false)} />
      )}
      {showMyProfile && (
        <MyProfile profile={profile} onClose={() => setShowMyProfile(false)} onUpdated={updated => setProfile(updated)} />
      )}
      {showNewShipment && (
        <ShipmentForm
          title="New Shipment"
          logistics={logistics}
          buyerCompanyId={effectiveProfile?.company_id || null}
          onClose={() => setShowNewShipment(false)}
          onSave={handleNewShipment}
        />
      )}
    </>
  )
}
// cache bust Mon May 25 20:15:43 UTC 2026
