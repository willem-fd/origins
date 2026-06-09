import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// Display labels for actions in the thread
const ACTION_LABEL = {
  ask:     'Ask',
  confirm: 'Confirmed',
  cancel:  'Cancelled',
  counter: 'Counter offer',
}
const ACTION_ICON = {
  ask:     'send',
  confirm: 'check',
  cancel:  'x',
  counter: 'arrows-exchange',
}
const ACTION_COLOR = {
  ask:     'var(--text-2)',
  confirm: '#15803d',
  cancel:  '#b91c1c',
  counter: 'var(--brown-dark)',
}
const FRIENDLY_ERR = {
  price_required:      'Cannot confirm — the buyer left the price open. Counter with a price first.',
  line_not_pending:    'This line is no longer pending.',
  shipment_not_active: 'Shipment is not in an active state.',
  not_authorized:      'You are not authorised to do that.',
  line_cancelled:      'This line is cancelled.',
}

const STATE_LABEL = { pending: 'Pending', active: 'Confirmed', cancelled: 'Cancelled' }
const STATE_BADGE = { pending: 'badge-pending', active: 'badge-active', cancelled: 'badge-completed' }

const fmtPrice = (v) => v == null ? '—' : `$${Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtInt   = (v) => v == null ? '—' : Number(v).toLocaleString('de-DE')
const fmtDate  = (s) => new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// LineDrawer — slides in from the right; shows current values + the
// immutable thread of asks / counters / confirms / cancels for one line.
// Hosts the Counter form for grower-side admins on pending lines.
export default function LineDrawer({ poId, onClose, onActionTaken }) {
  const [line, setLine] = useState(null)
  const [actions, setActions] = useState([])
  const [companyMap, setCompanyMap] = useState({})
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [counterMode, setCounterMode] = useState(false)
  const [counterForm, setCounterForm] = useState({ price: '', stems: '', stpb: '' })
  const [submitting, setSubmitting] = useState(false)

  const reload = useCallback(async () => {
    if (!poId) return
    try {
      const [lRes, aRes, pRes] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select('id, state, price_ordered, stems_ordered, stems_per_bunch, length_cm, notes_buyer, order_type, box_type, box_nr, boxmark, grower_company_id, shipment_id, products(name, vbn_code)')
          .eq('id', poId).single(),
        supabase
          .from('po_actions')
          .select('id, action, actor_company_id, fields_json, created_at')
          .eq('po_id', poId)
          .order('created_at', { ascending: false }),
        (async () => {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return { data: null }
          return supabase.from('users').select('id, company_id, role, is_super_admin').eq('id', user.id).single()
        })()
      ])
      if (lRes.error) throw lRes.error
      if (aRes.error) throw aRes.error

      const l = lRes.data
      const a = aRes.data || []
      const p = pRes.data

      const companyIds = [...new Set(a.map(x => x.actor_company_id).filter(Boolean))]
      if (l.grower_company_id) companyIds.push(l.grower_company_id)
      const uniq = [...new Set(companyIds)]
      const { data: cs } = uniq.length
        ? await supabase.from('companies').select('id, name, brand_name, type').in('id', uniq)
        : { data: [] }

      setLine(l)
      setActions(a)
      setProfile(p)
      setCompanyMap(Object.fromEntries((cs || []).map(c => [c.id, c])))
      setLoading(false)
    } catch (e) {
      setErr(e.message || 'Failed to load line history')
      setLoading(false)
    }
  }, [poId])

  useEffect(() => {
    if (!poId) return
    setLoading(true); setErr('')
    setCounterMode(false)
    reload()
  }, [poId, reload])

  if (!poId) return null

  const isAdmin       = profile && (profile.is_super_admin || profile.role === 'admin')
  const isGrowerSide  = profile && line && profile.company_id === line.grower_company_id
  const canCounter    = isAdmin && isGrowerSide && line?.state === 'pending'

  const closeOnBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }
  const companyName = (id) => {
    const c = companyMap[id]
    if (!c) return '—'
    return c.brand_name || c.name
  }

  const beginCounter = () => {
    setCounterForm({
      price: line.price_ordered != null ? String(line.price_ordered).replace('.', ',') : '',
      stems: line.stems_ordered != null ? String(line.stems_ordered) : '',
      stpb:  line.stems_per_bunch != null ? String(line.stems_per_bunch) : '',
    })
    setErr('')
    setCounterMode(true)
  }

  const submitCounter = async () => {
    setErr('')
    const priceStr = (counterForm.price || '').replace(',', '.')
    const priceNum = priceStr === '' ? null : Number(priceStr)
    if (priceNum === null || isNaN(priceNum) || priceNum <= 0) {
      setErr('Set a price greater than 0')
      return
    }
    const stemsNum = counterForm.stems ? parseInt(counterForm.stems, 10) : null
    const stpbNum  = counterForm.stpb  ? parseInt(counterForm.stpb,  10) : null
    if (stemsNum != null && (isNaN(stemsNum) || stemsNum <= 0)) { setErr('Stems must be a positive number'); return }
    if (stpbNum  != null && (isNaN(stpbNum)  || stpbNum  <= 0)) { setErr('Stems per bunch must be a positive number'); return }

    setSubmitting(true)
    const { data, error } = await supabase.rpc('po_counter', {
      p_po_id: poId,
      p_fields: {
        price_ordered:   priceNum,
        stems_ordered:   stemsNum,
        stems_per_bunch: stpbNum,
      }
    })
    setSubmitting(false)
    if (error || !data?.ok) {
      const code = data?.error || error?.message || 'Failed to submit counter'
      setErr(FRIENDLY_ERR[code] || code)
      return
    }
    setCounterMode(false)
    onActionTaken?.()
    await reload()
  }

  return (
    <div className="drawer-backdrop" onClick={closeOnBackdrop}>
      <div className="drawer" role="dialog" aria-label="Line history">
        <div className="drawer-header">
          <div className="drawer-title">Line history</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {err && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', fontSize: 13, margin: 16, borderRadius: 7 }}>{err}</div>}

        {loading ? (
          <div className="empty"><i className="ti ti-loader" /><div className="empty-title">Loading…</div></div>
        ) : line ? (
          <>
            <div className="drawer-section">
              <div className="drawer-section-title">Current</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                {line.products?.name || '—'}
                {line.products?.vbn_code && <span style={{ marginLeft: 6, color: 'var(--text-3)', fontSize: 12 }}>{line.products.vbn_code}</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12, fontFamily: 'var(--mono)' }}>
                Box {line.box_nr ?? '—'} · {line.box_type || '—'} · MARK {line.boxmark || '—'}
                <span style={{ marginLeft: 10 }}>· grower {companyName(line.grower_company_id)}</span>
              </div>
              <div className="kv-grid">
                <KV label="Length"   value={line.length_cm == null ? '—' : `${line.length_cm} cm`} />
                <KV label="Stems"    value={fmtInt(line.stems_ordered)} />
                <KV label="St/Bunch" value={fmtInt(line.stems_per_bunch)} />
                <KV label="Price"    value={fmtPrice(line.price_ordered)} />
                <KV label="Order type" value={({ open_market: 'Open Market', standing: 'Standing', repeating: 'Repeating' })[line.order_type] || '—'} />
                <KV label="State">
                  <span className={`badge ${STATE_BADGE[line.state] || 'badge-draft'}`} style={{ minWidth: 78, textAlign: 'center', justifyContent: 'center', display: 'inline-flex' }}>
                    {STATE_LABEL[line.state] || line.state}
                  </span>
                </KV>
              </div>
              {line.notes_buyer && (
                <div style={{ marginTop: 10, padding: 10, background: 'var(--surface-2)', borderRadius: 6, fontSize: 12.5 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-3)', marginBottom: 4 }}>Buyer note</div>
                  {line.notes_buyer}
                </div>
              )}
            </div>

            {canCounter && (
              <div className="drawer-section" style={{ background: 'var(--surface-2)' }}>
                {!counterMode ? (
                  <>
                    <div className="drawer-section-title">Counter offer</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>
                      Propose different values to the buyer. The line stays pending — the buyer will see your counter and can confirm or counter back.
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={beginCounter}>
                      <i className="ti ti-arrows-exchange" aria-hidden="true" /> Counter
                    </button>
                  </>
                ) : (
                  <>
                    <div className="drawer-section-title">Your counter offer</div>
                    <div className="counter-form">
                      <label>
                        <span>Price $</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={counterForm.price}
                          onChange={e => setCounterForm({ ...counterForm, price: e.target.value.replace('.', ',') })}
                          autoFocus
                        />
                      </label>
                      <label>
                        <span>Stems</span>
                        <input
                          type="number"
                          placeholder="100"
                          value={counterForm.stems}
                          onChange={e => setCounterForm({ ...counterForm, stems: e.target.value })}
                        />
                      </label>
                      <label>
                        <span>St/Bunch</span>
                        <input
                          type="number"
                          placeholder="25"
                          value={counterForm.stpb}
                          onChange={e => setCounterForm({ ...counterForm, stpb: e.target.value })}
                        />
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setCounterMode(false); setErr('') }} disabled={submitting}>
                        Cancel
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={submitCounter} disabled={submitting}>
                        <i className="ti ti-send" aria-hidden="true" /> {submitting ? 'Sending…' : 'Send counter'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="drawer-section">
              <div className="drawer-section-title">Thread <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>· newest first</span></div>
              {actions.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>No actions recorded yet.</div>
              ) : (
                <div className="thread">
                  {actions.map(a => (
                    <ThreadItem key={a.id} action={a} who={companyName(a.actor_company_id)} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function KV({ label, value, children }) {
  return (
    <div className="kv">
      <div className="kv-label">{label}</div>
      <div className="kv-value">{children ?? value}</div>
    </div>
  )
}

function ThreadItem({ action, who }) {
  const f = action.fields_json || {}
  const showValues = action.action !== 'cancel'
  const hasPrice = f.price_ordered != null
  return (
    <div className="thread-item">
      <div className="thread-item-icon" style={{ color: ACTION_COLOR[action.action] || 'var(--text-2)' }}>
        <i className={`ti ti-${ACTION_ICON[action.action] || 'circle'}`} aria-hidden="true" />
      </div>
      <div className="thread-item-body">
        <div className="thread-item-head">
          <span style={{ fontWeight: 600, color: ACTION_COLOR[action.action] }}>{ACTION_LABEL[action.action] || action.action}</span>
          <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}>· {who}</span>
        </div>
        {showValues && (
          <div className="thread-item-fields">
            <span>Price <strong style={{ color: hasPrice ? 'var(--text-1)' : 'var(--text-3)' }}>{hasPrice ? fmtPrice(f.price_ordered) : 'not set'}</strong></span>
            {f.stems_ordered != null && <span>· Stems <strong>{fmtInt(f.stems_ordered)}</strong></span>}
            {f.stems_per_bunch != null && <span>· St/B <strong>{fmtInt(f.stems_per_bunch)}</strong></span>}
          </div>
        )}
        <div className="thread-item-time">{fmtDate(action.created_at)}</div>
      </div>
    </div>
  )
}
