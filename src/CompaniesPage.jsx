import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { flag, COUNTRIES } from './constants'
import CompanyProfile from './CompanyProfile'
import CountryCombobox from './CountryCombobox'
import { alertDialog } from './Dialog'

const TYPE_LABELS = { buyer: 'Buyer', grower: 'Grower', logistics: 'Logistics' }
const TYPE_COLORS = { buyer: 'var(--green)', grower: 'var(--brown)', logistics: '#2563EB' }

export default function CompaniesPage({ initialType = 'all', viewAsBuyerId = null }) {
  const [companies, setCompanies] = useState([])
  const [selected, setSelected] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState(initialType)
  const [f, setF] = useState({ name: '', brand_name: '', type: initialType === 'all' ? 'grower' : initialType, country: '', city: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  useEffect(() => {
    setTypeFilter(initialType)
    setF(p => ({ ...p, type: initialType === 'all' ? 'grower' : initialType }))
  }, [initialType])

  // Load companies. When viewing-as a buyer, filter to that buyer's list (relationships + self).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: all } = await supabase.from('companies').select('*').order('name')
      if (cancelled) return
      if (!viewAsBuyerId) { setCompanies(all || []); return }
      const { data: rels } = await supabase
        .from('company_relationships')
        .select('partner_company_id')
        .eq('buyer_company_id', viewAsBuyerId)
        .eq('status', 'active')
      if (cancelled) return
      const allowed = new Set([viewAsBuyerId, ...(rels || []).map(r => r.partner_company_id)])
      setCompanies((all || []).filter(c => allowed.has(c.id)))
    })()
    return () => { cancelled = true }
  }, [viewAsBuyerId])

  const filtered = companies.filter(c => {
    const q = search.toLowerCase()
    const ms = !q || c.name.toLowerCase().includes(q) || (c.brand_name || '').toLowerCase().includes(q)
    const mt = typeFilter === 'all' || c.type === typeFilter
    return ms && mt
  })

  const handleSave = async () => {
    if (!f.name) return
    setSaving(true)
    const { data, error } = await supabase.from('companies').insert([f]).select().single()
    if (error) { setSaving(false); alertDialog({ title: 'Could not save', body: error.message }); return }
    // When viewing-as a buyer, auto-link the new grower/logistics to that buyer's list
    if (viewAsBuyerId && (data.type === 'grower' || data.type === 'logistics')) {
      await supabase.from('company_relationships').insert([{
        buyer_company_id: viewAsBuyerId,
        partner_company_id: data.id,
        partner_type: data.type,
      }])
    }
    setSaving(false)
    setCompanies(p => [...p, data].sort((a, b) => a.name.localeCompare(b.name)))
    setShowNew(false)
    setF({ name: '', brand_name: '', type: 'grower', country: '', city: '', email: '', phone: '' })
    setSelected(data)
  }

  if (selected) {
    return (
      <CompanyProfile
        company={selected}
        onBack={() => setSelected(null)}
        onUpdate={updated => {
          setCompanies(p => p.map(c => c.id === updated.id ? updated : c))
          setSelected(updated)
        }}
      />
    )
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Companies <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 12 }}>({companies.length})</span></div>
          <input className="search-input" placeholder="Search companies…" value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'buyer', 'grower', 'logistics'].map(t => (
              <div key={t} className={`filter-chip${typeFilter === t ? ' active' : ''}`} onClick={() => setTypeFilter(t)}>
                {t === 'all' ? 'All' : TYPE_LABELS[t]}
              </div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}><i className="ti ti-plus" /> Add company</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Company</th><th>Type</th><th>Country</th><th>Email</th><th>Phone</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} onClick={() => setSelected(c)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{c.brand_name || c.name}</div>
                    {c.brand_name && c.name !== c.brand_name && <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{c.name}</div>}
                  </td>
                  <td>
                    <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: (TYPE_COLORS[c.type] || '#6B7280') + '18', color: TYPE_COLORS[c.type] || '#6B7280' }}>
                      {TYPE_LABELS[c.type] || c.type}
                    </span>
                  </td>
                  <td className="td-muted">{c.country ? `${flag(c.country)} ${c.country}` : '—'}</td>
                  <td className="td-muted">{c.email || '—'}</td>
                  <td className="td-mono">{c.phone || '—'}</td>
                  <td>
                    <span className={`badge ${c.status === 'active' ? 'badge-active' : c.status === 'pending' ? 'badge-draft' : 'badge-completed'}`}>
                      {c.status || 'active'}
                    </span>
                  </td>
                  <td><span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 500 }}>Open →</span></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty"><i className="ti ti-building" /><div className="empty-title">No companies yet</div><div className="empty-sub">Add buyer, grower, or logistics companies</div></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <i className="ti ti-building" style={{ fontSize: 17, color: 'var(--green)' }} />
              <div className="modal-title">Add Company</div>
              <button className="btn-icon" onClick={() => setShowNew(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Official company name *</label>
                  <input className="form-input" value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Joygardens S.A." />
                </div>
                <div className="form-group">
                  <label className="form-label">Brand name</label>
                  <input className="form-input" value={f.brand_name} onChange={e => set('brand_name', e.target.value)} placeholder="If different" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Company type</label>
                  <select className="form-select" value={f.type} onChange={e => set('type', e.target.value)}>
                    <option value="buyer">Buyer</option>
                    <option value="grower">Grower</option>
                    <option value="logistics">Logistics</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <CountryCombobox value={f.country} onChange={v => set('country', v)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={f.email} onChange={e => set('email', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={f.phone} onChange={e => set('phone', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !f.name}>{saving ? 'Saving…' : 'Add company'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
