import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { flag, STATUS_LABELS, STATUS_BADGE } from './constants'

const STATE_LABEL = { pending: 'Pending', active: 'Confirmed', cancelled: 'Cancelled' }
const STATE_BADGE = { pending: 'badge-pending', active: 'badge-active', cancelled: 'badge-completed' }

// Grower's view of their PO lines. Shows lines across all non-draft shipments
// where the grower is a recipient. Each line can be Confirmed or Cancelled
// while it's still in 'pending' state.
export default function GrowerOrdersPage({ companyId, profile }) {
  const [shipments, setShipments] = useState(null)
  const [busy, setBusy] = useState(null)         // po_id currently being acted on
  const [err, setErr] = useState('')
  const isAdmin = !!profile?.is_super_admin || profile?.role === 'admin'

  const refresh = async () => {
    setErr('')
    if (!companyId) { setShipments([]); return }
    // 1. Lines for this grower (RLS already hides draft-shipment lines)
    const { data: pos, error: poErr } = await supabase
      .from('purchase_orders')
      .select('id, state, price_ordered, stems_ordered, stems_per_bunch, order_type, box_type, box_nr, boxmark, shipment_id, sort_order, products(name, vbn_code)')
      .eq('grower_company_id', companyId)
      .order('shipment_id').order('box_nr').order('sort_order')
    if (poErr) { setErr(poErr.message); setShipments([]); return }
    if (!pos || pos.length === 0) { setShipments([]); return }

    // 2. Fetch the parent shipments (filter out drafts explicitly as well)
    const shipmentIds = [...new Set(pos.map(p => p.shipment_id))]
    const { data: ships } = await supabase
      .from('shipments')
      .select('id, status, origin_country, origin_airport, destination_airport, dep_date, buyer_company_id')
      .in('id', shipmentIds)
      .neq('status', 'draft')
    if (!ships || ships.length === 0) { setShipments([]); return }

    // 3. Fetch the buyer companies
    const buyerIds = [...new Set(ships.map(s => s.buyer_company_id).filter(Boolean))]
    const { data: buyers } = buyerIds.length
      ? await supabase.from('companies').select('id, name, brand_name').in('id', buyerIds)
      : { data: [] }
    const buyerMap = Object.fromEntries((buyers || []).map(b => [b.id, b]))

    // 4. Group lines under their shipment, attach buyer info
    const shipmentMap = new Map()
    ships.forEach(s => shipmentMap.set(s.id, { shipment: { ...s, buyer: buyerMap[s.buyer_company_id] || null }, lines: [] }))
    pos.forEach(po => { if (shipmentMap.has(po.shipment_id)) shipmentMap.get(po.shipment_id).lines.push(po) })
    setShipments(Array.from(shipmentMap.values()))
  }
  useEffect(() => { refresh() }, [companyId])

  const act = async (poId, fn) => {
    setBusy(poId); setErr('')
    const { data, error } = await supabase.rpc(fn, { p_po_id: poId })
    setBusy(null)
    if (error || !data?.ok) {
      setErr(error?.message || data?.error || 'Action failed')
      return
    }
    refresh()
  }

  if (!companyId) {
    return <div className="empty"><i className="ti ti-plant" /><div className="empty-title">No company</div></div>
  }
  if (shipments === null) {
    return <div className="empty"><i className="ti ti-loader" /><div className="empty-title">Loading…</div></div>
  }
  if (shipments.length === 0) {
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {shipments.map(({ shipment, lines }) => {
          const buyerName = shipment.buyer?.brand_name || shipment.buyer?.name || '—'
          const depDate = shipment.dep_date ? new Date(shipment.dep_date).toLocaleDateString() : '—'
          const route = `${shipment.origin_airport || '—'} → ${shipment.destination_airport || '—'}`
          const pending = lines.filter(l => l.state === 'pending').length
          return (
            <div key={shipment.id} className="card">
              <div style={{ padding: '14px 18px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{buyerName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    {flag(shipment.origin_country)} {route} · Departs {depDate}
                  </div>
                </div>
                <span className={`badge ${STATUS_BADGE[shipment.status] || 'badge-draft'}`}>{STATUS_LABELS[shipment.status] || shipment.status}</span>
                {pending > 0 && (
                  <span className="badge badge-pending">{pending} pending</span>
                )}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Box</th><th>Product</th><th>Stems</th><th>St/B</th><th>Type</th><th>Price</th><th>State</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(l => (
                      <tr key={l.id}>
                        <td className="td-mono">{l.box_nr ? `#${l.box_nr}` : '—'}{l.boxmark ? <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>{l.boxmark}</span> : null}</td>
                        <td>{l.products?.name || '—'}{l.products?.vbn_code && <span style={{ color: 'var(--text-3)', marginLeft: 6, fontSize: 11.5 }}>{l.products.vbn_code}</span>}</td>
                        <td className="td-mono">{l.stems_ordered ?? '—'}</td>
                        <td className="td-mono">{l.stems_per_bunch ?? '—'}</td>
                        <td className="td-mono">{l.box_type || '—'}</td>
                        <td className="td-mono">{l.price_ordered != null ? `$${Number(l.price_ordered).toFixed(2)}` : '—'}</td>
                        <td><span className={`badge ${STATE_BADGE[l.state] || 'badge-draft'}`}>{STATE_LABEL[l.state] || l.state}</span></td>
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
