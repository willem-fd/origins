import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// ── Converters ────────────────────────────────────────────────────────────────
// PO editor blocks (grower → boxes → rows) → flat template item rows.
export function blocksToTemplateItems(blocks) {
  const items = []
  blocks.forEach(block => {
    block.boxes.forEach(box => {
      box.rows.forEach((row, i) => {
        items.push({
          grower_company_id: block.growerId === 'open' ? null : block.growerId,
          box_nr:          box.boxNr,
          boxmark:         box.boxmark || null,
          box_type:        box.box_type,
          product_id:      row.product_id || null,
          order_type:      row.order_type,
          length_cm:       row.length_cm ? parseInt(row.length_cm) : null,
          stems_ordered:   row.stems_ordered ? parseInt(row.stems_ordered) : null,
          stems_per_bunch: row.stems_per_bunch ? parseInt(row.stems_per_bunch) : 25,
          price_ordered:   row.price_ordered ? parseFloat(row.price_ordered) : null,
          notes_buyer:     row.notes_buyer || null,
          sort_order:      i,
        })
      })
    })
  })
  return items
}

// Template item rows → purchase_orders payloads for a given shipment.
export function templateItemsToPOPayloads(items, shipmentId) {
  return items.map((it, i) => ({
    shipment_id:     shipmentId,
    grower_company_id: it.grower_company_id || null,
    product_id:      it.product_id || null,
    order_type:      it.order_type || 'open_market',
    status:          'pending',
    box_nr:          it.box_nr || 1,
    boxmark:         it.boxmark || null,
    box_type:        it.box_type || 'HB',
    length_cm:       it.length_cm ?? null,
    stems_ordered:   it.stems_ordered ?? null,
    stems_per_bunch: it.stems_per_bunch ?? 25,
    price_ordered:   it.price_ordered ?? null,
    notes_buyer:     it.notes_buyer || null,
    sort_order:      it.sort_order ?? i,
  }))
}

const scope = (q, companyId) => companyId ? q.eq('company_id', companyId) : q.is('company_id', null)

// Load templates for a company with line + grower counts. When adminAll is true,
// load every template across all companies (for super admin's own view) and include
// the owning company's name.
async function loadTemplatesWithCounts(companyId, adminAll = false) {
  let query = supabase.from('po_templates')
    .select(adminAll ? '*, companies(name, brand_name)' : '*')
    .order('created_at', { ascending: false })
  const { data: tpls } = adminAll ? await query : await scope(query, companyId)
  const list = tpls || []
  if (list.length === 0) return []
  const { data: items } = await supabase
    .from('po_template_items')
    .select('template_id, grower_company_id')
    .in('template_id', list.map(t => t.id))
  const byTpl = {}
  ;(items || []).forEach(it => {
    const e = byTpl[it.template_id] || (byTpl[it.template_id] = { lines: 0, growers: new Set() })
    e.lines++
    e.growers.add(it.grower_company_id || 'open')
  })
  return list.map(t => ({
    ...t,
    lineCount: byTpl[t.id]?.lines || 0,
    growerCount: byTpl[t.id]?.growers.size || 0,
    ownerName: t.companies?.brand_name || t.companies?.name || null,
  }))
}

// ── Save-as-template modal (new OR overwrite) ─────────────────────────────────
export function SaveTemplateModal({ companyId, blocks, onClose, onSaved }) {
  const [mode, setMode] = useState('new')       // 'new' | 'overwrite'
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [existing, setExisting] = useState([])
  const [overwriteId, setOverwriteId] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    scope(supabase.from('po_templates').select('id, name').order('name'), companyId)
      .then(({ data }) => setExisting(data || []))
  }, [companyId])

  const items = blocksToTemplateItems(blocks)
  const lineCount = items.length

  const handleSave = async () => {
    setErr('')
    if (lineCount === 0) { setErr('There are no order lines to save yet.'); return }

    if (mode === 'new') {
      const nm = name.trim()
      if (!nm) { setErr('Give the template a name.'); return }
      // Client-side unique check within this company (case-insensitive); DB enforces too.
      if (existing.some(t => t.name.toLowerCase() === nm.toLowerCase())) {
        setErr('You already have a template with that name. Pick another name or choose "Overwrite".'); return
      }
      setSaving(true)
      const { data: tpl, error } = await supabase.from('po_templates')
        .insert([{ company_id: companyId || null, name: nm, description: description.trim() || null }])
        .select().single()
      if (error || !tpl) {
        setSaving(false)
        setErr(error?.code === '23505' ? 'You already have a template with that name.' : (error?.message || 'Could not save template.'))
        return
      }
      const rows = items.map(it => ({ ...it, template_id: tpl.id }))
      const { error: ie } = await supabase.from('po_template_items').insert(rows)
      setSaving(false)
      if (ie) { setErr(ie.message); return }
      onSaved?.(`Saved "${nm}" (${lineCount} lines).`)
    } else {
      if (!overwriteId) { setErr('Choose which template to overwrite.'); return }
      setSaving(true)
      await supabase.from('po_template_items').delete().eq('template_id', overwriteId)
      const rows = items.map(it => ({ ...it, template_id: overwriteId }))
      const { error: ie } = await supabase.from('po_template_items').insert(rows)
      setSaving(false)
      if (ie) { setErr(ie.message); return }
      const nm = existing.find(t => t.id === overwriteId)?.name || 'template'
      onSaved?.(`Updated "${nm}" (${lineCount} lines).`)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title"><i className="ti ti-template" aria-hidden="true" /> Save as template</div>
          <div className="btn-icon" onClick={onClose}><i className="ti ti-x" aria-hidden="true" /></div>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
            Saving the current list: {blocks.length} growers · {lineCount} lines (structure + prices).
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className={`filter-chip${mode === 'new' ? ' active' : ''}`} onClick={() => setMode('new')}>Save as new</div>
            <div className={`filter-chip${mode === 'overwrite' ? ' active' : ''}`} onClick={() => setMode('overwrite')}>Overwrite existing</div>
          </div>

          {mode === 'new' ? (
            <>
              <div>
                <label className="form-label">Template name *</label>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Ecuador weekly" autoFocus />
              </div>
              <div>
                <label className="form-label">Description (optional)</label>
                <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="A note to remember what this is for" />
              </div>
            </>
          ) : (
            <div>
              <label className="form-label">Template to overwrite *</label>
              <select className="form-select" value={overwriteId} onChange={e => setOverwriteId(e.target.value)}>
                <option value="">— Choose a template —</option>
                {existing.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {existing.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>No templates yet — switch to "Save as new".</div>}
            </div>
          )}

          {err && <div style={{ fontSize: 12.5, color: '#b91c1c' }}>{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save template'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Load-template modal ───────────────────────────────────────────────────────
export function LoadTemplateModal({ companyId, onApply, onClose }) {
  const [list, setList] = useState(null)
  const [busy, setBusy] = useState('')

  useEffect(() => { loadTemplatesWithCounts(companyId).then(setList) }, [companyId])

  const pick = async (t) => {
    setBusy(t.id)
    await onApply(t.id)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title"><i className="ti ti-template" aria-hidden="true" /> Load a template</div>
          <div className="btn-icon" onClick={onClose}><i className="ti ti-x" aria-hidden="true" /></div>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>The template's lines are added to this shipment's order list. You can edit them after.</div>
          <div style={{ maxHeight: 380, overflowY: 'auto', margin: '0 -4px' }}>
            {list === null && <div className="empty-sub" style={{ padding: '20px 4px', color: 'var(--text-3)' }}>Loading…</div>}
            {list && list.length === 0 && <div className="empty-sub" style={{ padding: '20px 4px', color: 'var(--text-3)' }}>No templates saved yet.</div>}
            {list && list.map(t => (
              <div
                key={t.id}
                onClick={() => !busy && pick(t)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 12px', borderRadius: 8, cursor: busy ? 'default' : 'pointer', opacity: busy && busy !== t.id ? 0.5 : 1 }}
                onMouseEnter={e => !busy && (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{t.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                    {t.growerCount} growers · {t.lineCount} lines{t.description ? ` · ${t.description}` : ''}
                  </div>
                </div>
                {busy === t.id
                  ? <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading…</span>
                  : <i className="ti ti-arrow-right" style={{ color: 'var(--text-3)' }} aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Templates management page ─────────────────────────────────────────────────
export default function TemplatesPage({ companyId, adminAll = false }) {
  const [list, setList] = useState(null)
  const [editing, setEditing] = useState(null)   // template id being renamed
  const [editName, setEditName] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const [msg, setMsg] = useState('')

  const refresh = () => loadTemplatesWithCounts(companyId, adminAll).then(setList)
  useEffect(() => { refresh() }, [companyId, adminAll])

  const startRename = (t) => { setEditing(t.id); setEditName(t.name) }
  const saveRename = async (t) => {
    const nm = editName.trim()
    if (!nm || nm === t.name) { setEditing(null); return }
    const { error } = await supabase.from('po_templates').update({ name: nm }).eq('id', t.id)
    setEditing(null)
    if (error) { setMsg(error.code === '23505' ? 'You already have a template with that name.' : error.message); return }
    refresh()
  }
  const doDelete = async (t) => {
    await supabase.from('po_templates').delete().eq('id', t.id)   // items cascade
    setConfirmDel(null)
    refresh()
  }

  return (
    <div style={{ maxWidth: 760 }}>
      {msg && <div style={{ fontSize: 12.5, color: '#b91c1c', marginBottom: 10 }}>{msg}</div>}
      {list === null && <div className="empty"><i className="ti ti-loader" /><div className="empty-title">Loading templates…</div></div>}
      {list && list.length === 0 && (
        <div className="empty">
          <i className="ti ti-template" />
          <div className="empty-title">No templates yet</div>
          <div className="empty-sub">Build a Purchase Order List inside a shipment, then use “Save as template” to reuse it.</div>
        </div>
      )}
      {list && list.length > 0 && (
        <div className="card">
          {list.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderTop: i ? '0.5px solid var(--border)' : 'none' }}>
              <i className="ti ti-template" style={{ color: 'var(--brown)', fontSize: 18 }} aria-hidden="true" />
              <div style={{ flex: 1, minWidth: 0 }}>
                {editing === t.id ? (
                  <input
                    className="form-input" value={editName} autoFocus
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveRename(t); if (e.key === 'Escape') setEditing(null) }}
                    onBlur={() => saveRename(t)}
                    style={{ maxWidth: 320 }}
                  />
                ) : (
                  <>
                    <div style={{ fontWeight: 500 }}>
                      {t.name}
                      {adminAll && t.ownerName && (
                        <span style={{ marginLeft: 8, fontSize: 11.5, color: 'var(--brown)', fontWeight: 400 }}>
                          · {t.ownerName}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                      {t.growerCount} growers · {t.lineCount} lines{t.description ? ` · ${t.description}` : ''}
                    </div>
                  </>
                )}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => startRename(t)}><i className="ti ti-pencil" aria-hidden="true" /> Rename</button>
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(t)}><i className="ti ti-trash" aria-hidden="true" /> Delete</button>
            </div>
          ))}
        </div>
      )}

      {confirmDel && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header"><div className="modal-title">Delete template</div></div>
            <div className="modal-body">
              <div style={{ fontSize: 13.5 }}>Delete “{confirmDel.name}”? This removes the template and its {confirmDel.lineCount} saved lines. It does not affect any shipments.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => doDelete(confirmDel)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
