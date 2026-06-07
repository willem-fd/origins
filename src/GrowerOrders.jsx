import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { flag, STATUS_LABELS, STATUS_BADGE } from './constants'

const STATE_LABEL = { pending: 'Pending', active: 'Confirmed', cancelled: 'Cancelled' }
const STATE_BADGE = { pending: 'badge-pending', active: 'badge-active', cancelled: 'badge-completed' }

// Top-level page: routes between list and detail
export default function GrowerOrdersPage({ companyId, profile }) {
  const [selectedId, setSelectedId] = useState(null)
  if (selectedId) {
    return <GrowerShipmentDetail
      shipmentId={selectedId}
      companyId={companyId}
      profile={profile}
      onBack={() => setSelectedId(null)}
    />
  }
  return <GrowerShipmentsList companyId={companyId} onOpen={setSelectedId} />
}

// ── List of shipments where this grower has lines ───────────────────────────
function GrowerShipmentsList({ companyId, onOpen }) {
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')

  const refresh = async () => {
    setErr('')
    if (!companyId) { setList([]); return }

    // 1. Grower's lines (RLS already hides draft-shipment lines)
    const { data: pos, error: poErr } = await supabase
      .from('purchase_orders')
      .select('shipment_id, state')
      .eq('grower_company_id', companyId)
    if (poErr) { setErr(poErr.message); setList([]); return }
    if (!pos || pos.length === 0) { setList([]); return }

    // 2. Count totals + pending per shipment
    const counts = new Map()
    pos.forEach(p => {
      if (!counts.has(p.shipment_id)) counts.set(p.shipment_id, { total: 0, pending: 0 })
      const c = counts.get(p.shipment_id)
      c.total += 1
      if (p.state === 'pending') c.pending += 1
    })

    // 3. Fetch shipments (non-draft)
    const ids = [...counts.keys()]
    const { data: ships, error: shErr } = await supabase
      .from('shipments')
      .select('id, status, reference, origin_country, origin_airport, destination_airport, departure_date, drop_date, mawb, buyer_company_id')
      .in('id', ids).neq('status', 'draft')
      .order('departure_date', { ascending: false })
    if (shErr) { setErr(shErr.message); setList([]); return }
    if (!ships || ships.length === 0) { setList([]); return }

    // 4. Buyer companies
    const buyerIds = [...new Set(ships.map(s => s.buyer_company_id).filter(Boolean))]
    const { data: buyers } = buyerIds.length
      ? await supabase.from('companies').select('id, name, brand_name').in('id', buyerIds)
      : { data: [] }
    const buyerMap = Object.fromEntries((buyers || []).map(b => [b.id, b]))

    setList(ships.map(s => ({
      ...s,
      buyer: buyerMap[s.buyer_company_id] || null,
      counts: counts.get(s.id) || { total: 0, pending: 0 },
    })))
  }

  useEffect(() => { refresh() }, [companyId])
  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [companyId])

  if (!companyId) {
    return <div className="empty"><i className="ti ti-plant" /><div className="empty-title">No company</div></div>
  }
  if (list === null) {
    return <div className="empty"><i className="ti ti-loader" /><div className="empty-title">Loading…</div></div>
  }
  if (list.length === 0) {
    return (
      <div className="empty">
        <i className="ti ti-plant" />
        <div className="empty-title">No orders yet</div>
        <div className="empty-sub">When a buyer places an order with you, it'll show up here.</div>
      </div>
    )
  }

  return (
    <div>
      {err && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 7, fontSize: 13, marginBottom: 14 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={refresh} title="Refresh">
          <i className="ti ti-refresh" aria-hidden="true" /> Refresh
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Buyer</th><th>Reference</th><th>Route</th><th>Drop Date</th><th>AWB</th><th>Status</th><th>Order Lines</th><th></th>
            </tr></thead>
            <tbody>
              {list.map(s => {
                const buyerName = s.buyer?.brand_name || s.buyer?.name || '—'
                return (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(s.id)}>
                    <td>{buyerName}</td>
                    <td className="td-mono">{s.reference || '—'}</td>
                    <td className="td-mono">{flag(s.origin_country)} {s.origin_airport || '—'} → {s.destination_airport || '—'}</td>
                    <td className="td-mono">{s.drop_date ? new Date(s.drop_date).toLocaleDateString() : '—'}</td>
                    <td className="td-mono">{s.mawb || '—'}</td>
                    <td><span className={`badge ${STATUS_BADGE[s.status] || 'badge-draft'}`}>{STATUS_LABELS[s.status] || s.status}</span></td>
                    <td>
                      {s.counts.pending > 0
                        ? <span className="badge badge-pending">{s.counts.pending} pending</span>
                        : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.counts.total} line{s.counts.total === 1 ? '' : 's'}</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}><i className="ti ti-chevron-right" aria-hidden="true" style={{ color: 'var(--text-3)' }} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Shipment Detail (grower side) ───────────────────────────────────────────
function GrowerShipmentDetail({ shipmentId, companyId, profile, onBack }) {
  const [shipment, setShipment] = useState(null)
  const [lines, setLines] = useState([])
  const [tab, setTab] = useState('orders')
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState('')
  const isAdmin = !!profile?.is_super_admin || profile?.role === 'admin'

  const refresh = async () => {
    setErr('')
    const { data: s, error: shErr } = await supabase
      .from('shipments')
      .select('id, status, reference, origin_country, origin_airport, destination_airport, drop_date, departure_date, arrival_date, mawb, hawb, cargo_agent_id, airline_id, customs_agent_id, chargeable_weight, gross_weight, notes, buyer_company_id')
      .eq('id', shipmentId).single()
    if (shErr) { setErr(shErr.message); return }

    const partnerIds = [s.buyer_company_id, s.cargo_agent_id, s.airline_id, s.customs_agent_id].filter(Boolean)
    const { data: partners } = partnerIds.length
      ? await supabase.from('companies').select('id, name, brand_name').in('id', partnerIds)
      : { data: [] }
    const pmap = Object.fromEntries((partners || []).map(p => [p.id, p]))

    setShipment({
      ...s,
      buyer: pmap[s.buyer_company_id] || null,
      cargo_agent: pmap[s.cargo_agent_id] || null,
      airline: pmap[s.airline_id] || null,
      customs_agent: pmap[s.customs_agent_id] || null,
    })

    const { data: pos, error: poErr } = await supabase
      .from('purchase_orders')
      .select('id, state, price_ordered, stems_ordered, stems_per_bunch, length_cm, notes_buyer, order_type, box_type, box_nr, boxmark, sort_order, products(name, vbn_code)')
      .eq('grower_company_id', companyId)
      .eq('shipment_id', shipmentId)
      .order('box_nr').order('sort_order')
    if (poErr) { setErr(poErr.message); return }
    setLines(pos || [])
  }
  useEffect(() => { refresh() }, [shipmentId, companyId])
  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [shipmentId, companyId])

  const act = async (poId, fn) => {
    setBusy(poId); setErr('')
    const { data, error } = await supabase.rpc(fn, { p_po_id: poId })
    setBusy(null)
    if (error || !data?.ok) { setErr(error?.message || data?.error || 'Action failed'); return }
    refresh()
  }

  if (!shipment) {
    return <div className="empty"><i className="ti ti-loader" /><div className="empty-title">Loading…</div></div>
  }

  const buyerName = shipment.buyer?.brand_name || shipment.buyer?.name || '—'
  const fmt = d => d ? new Date(d).toLocaleDateString() : '—'

  return (
    <>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}><i className="ti ti-arrow-left" /> Shipments</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={refresh} title="Refresh">
          <i className="ti ti-refresh" /> Refresh
        </button>
        <span className={`badge ${STATUS_BADGE[shipment.status] || 'badge-draft'}`}>{STATUS_LABELS[shipment.status] || shipment.status}</span>
      </div>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
        <h1 style={{ fontSize: 21, fontWeight: 400, color: 'var(--text-1)' }}>
          {shipment.mawb ? `AWB ${shipment.mawb}` : 'Shipment — AWB pending'}
        </h1>
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
          {flag(shipment.origin_country)} {shipment.origin_airport} → {shipment.destination_airport}
          {shipment.airline?.name && ` · ${shipment.airline.name}`}
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2, marginBottom: 12 }}>
        Buyer: <strong style={{ color: 'var(--text-2)' }}>{buyerName}</strong>
        {shipment.reference && <span> · {shipment.reference}</span>}
      </div>

      {/* Meta grid */}
      <div className="meta-grid">
        {[
          { label: 'Drop date',         value: shipment.drop_date || '—',      mono: true },
          { label: 'Departure',         value: shipment.departure_date || '—', mono: true },
          { label: 'Est. arrival',      value: shipment.arrival_date || '—',   mono: true },
          { label: 'AWB',               value: shipment.mawb || '—',           mono: true },
          { label: 'HAWB',              value: shipment.hawb || '—',           mono: true },
          { label: 'Cargo agent',       value: shipment.cargo_agent?.name || '—' },
          { label: 'Airline',           value: shipment.airline?.name || '—' },
        ].map(m => (
          <div className="meta-item" key={m.label}>
            <div className="meta-label">{m.label}</div>
            <div className={`meta-value${m.mono ? ' mono' : ''}`}>{m.value}</div>
          </div>
        ))}
        {shipment.notes && (
          <div className="meta-item" style={{ gridColumn: '1 / -1' }}>
            <div className="meta-label">Buyer notes</div>
            <div className="meta-value" style={{ whiteSpace: 'pre-wrap' }}>{shipment.notes}</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="tabs" style={{ padding: '0 20px' }}>
          <div className={`tab${tab === 'orders' ? ' active' : ''}`} onClick={() => setTab('orders')}>Order Lines</div>
          <div className={`tab${tab === 'docs' ? ' active' : ''}`} onClick={() => setTab('docs')}>Documents</div>
        </div>

        {err && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', margin: 16, borderRadius: 7, fontSize: 13 }}>{err}</div>}

        {tab === 'orders' && (
          <div style={{ padding: 16 }}>
            {lines.length === 0 ? (
              <div className="empty"><i className="ti ti-plant" /><div className="empty-title">No lines for you on this shipment</div></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>Box</th><th>Mark</th><th>Type</th><th>Product</th><th>Length</th><th>Stems</th><th>St/B</th><th>Price</th><th>Notes</th><th>State</th><th></th>
                  </tr></thead>
                  <tbody>
                    {lines.map(l => (
                      <tr key={l.id}>
                        <td className="td-mono">{l.box_nr ? `#${l.box_nr}` : '—'}</td>
                        <td className="td-mono" style={{ color: 'var(--text-2)' }}>{l.boxmark || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                        <td className="td-mono">{l.box_type || '—'}</td>
                        <td>{l.products?.name || '—'}{l.products?.vbn_code && <span style={{ color: 'var(--text-3)', marginLeft: 6, fontSize: 11.5 }}>{l.products.vbn_code}</span>}</td>
                        <td className="td-mono">{l.length_cm ?? '—'}</td>
                        <td className="td-mono">{l.stems_ordered ?? '—'}</td>
                        <td className="td-mono">{l.stems_per_bunch ?? '—'}</td>
                        <td className="td-mono">{l.price_ordered != null ? `$${Number(l.price_ordered).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
                        <td style={{ fontSize: 12.5, color: 'var(--text-2)', maxWidth: 200 }}>{l.notes_buyer || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                        <td>
                          <span className={`badge ${STATE_BADGE[l.state] || 'badge-draft'}`} style={{ minWidth: 78, textAlign: 'center', justifyContent: 'center', display: 'inline-flex' }}>
                            {STATE_LABEL[l.state] || l.state}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {isAdmin && l.state === 'pending' && (
                            <>
                              <button className="btn btn-ghost btn-sm" disabled={busy === l.id} onClick={() => act(l.id, 'po_cancel')}>
                                <i className="ti ti-x" aria-hidden="true" /> Cancel
                              </button>
                              <button className="btn btn-primary btn-sm" disabled={busy === l.id} onClick={() => act(l.id, 'po_confirm')}>
                                <i className="ti ti-check" aria-hidden="true" /> Confirm
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'docs' && (
          <div style={{ padding: 24 }}>
            <div className="empty">
              <i className="ti ti-file" />
              <div className="empty-title">Documents</div>
              <div className="empty-sub">Upload your invoices here — coming next in W3.</div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
