import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { COUNTRIES, flag, validateEmail, validatePhone } from './constants'

function CountrySelect({ value, onChange }) {
  return (
    <select className="form-select" value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">— Select country —</option>
      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
    </select>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>{title}</div>
      {children}
    </div>
  )
}

function AddrFields({ type, addr, setAddr }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label className="form-label">Street & number</label>
          <input className="form-input" value={addr?.street || ''} onChange={e => setAddr(type, 'street', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Postal code</label>
          <input className="form-input" value={addr?.postal_code || ''} onChange={e => setAddr(type, 'postal_code', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">City / Town</label>
          <input className="form-input" value={addr?.city || ''} onChange={e => setAddr(type, 'city', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Province / State</label>
          <input className="form-input" value={addr?.province || ''} onChange={e => setAddr(type, 'province', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Country</label>
          <CountrySelect value={addr?.country} onChange={v => setAddr(type, 'country', v)} />
        </div>
      </div>
    </div>
  )
}

// ── General Info Tab ──────────────────────────────────────────────────────────
function GeneralTab({ company, onSave }) {
  const [f, setF] = useState({
    name: company.name || '',
    brand_name: company.brand_name || '',
    phone: company.phone || '',
    email: company.email || '',
    website: company.website || '',
    registration_number: company.registration_number || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  // Addresses
  const [officeAddr, setOfficeAddr] = useState(null)
  const [prodAddr, setProdAddr] = useState(null)
  const [diffProd, setDiffProd] = useState(false)

  useEffect(() => {
    supabase.from('company_addresses').select('*').eq('company_id', company.id).then(({ data }) => {
      if (data) {
        const office = data.find(a => a.address_type === 'office')
        const prod = data.find(a => a.address_type === 'production')
        if (office) setOfficeAddr(office)
        else setOfficeAddr({ company_id: company.id, address_type: 'office', street: '', postal_code: '', city: '', province: '', country: '' })
        if (prod) { setProdAddr(prod); setDiffProd(true) }
        else setProdAddr({ company_id: company.id, address_type: 'production', street: '', postal_code: '', city: '', province: '', country: '' })
      }
    })
  }, [company.id])

  const saveAddress = async (addr) => {
    if (addr.id) {
      await supabase.from('company_addresses').update(addr).eq('id', addr.id)
    } else {
      const { data } = await supabase.from('company_addresses').insert([addr]).select().single()
      if (data) return data
    }
    return addr
  }

  const handleSave = async () => {
    setSaving(true)
    const { data } = await supabase.from('companies').update(f).eq('id', company.id).select().single()
    if (officeAddr) await saveAddress(officeAddr)
    if (diffProd && prodAddr) await saveAddress(prodAddr)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    if (data && onSave) onSave(data)
  }

  const setAddr = (type, k, v) => {
    if (type === 'office') setOfficeAddr(p => ({ ...p, [k]: v }))
    else setProdAddr(p => ({ ...p, [k]: v }))
  }


  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Section title="Company identity">
        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label">Official company name *</label>
            <input className="form-input" value={f.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Brand name</label>
            <input className="form-input" value={f.brand_name} onChange={e => set('brand_name', e.target.value)} placeholder="If different from official name" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 555 000 0000" />
          </div>
          <div className="form-group">
            <label className="form-label">General email</label>
            <input className="form-input" type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="info@company.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Website</label>
            <input className="form-input" value={f.website} onChange={e => set('website', e.target.value)} placeholder="www.company.com" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group" style={{ maxWidth: 280 }}>
            <label className="form-label">Company registration number</label>
            <input className="form-input" value={f.registration_number} onChange={e => set('registration_number', e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="Office address">
        <AddrFields type="office" addr={officeAddr} setAddr={setAddr} />
      </Section>

      <Section title="Production address">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={diffProd} onChange={e => setDiffProd(e.target.checked)} />
          Production address is different from office address
        </label>
        {diffProd && <AddrFields type="production" addr={prodAddr} setAddr={setAddr} />}
      </Section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <i className="ti ti-check" /> {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// ── Banking Tab ───────────────────────────────────────────────────────────────
function BankingTab({ company }) {
  const [accounts, setAccounts] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [f, setF] = useState({ bank_name: '', bank_address: '', account_holder: '', account_number: '', swift_bic: '', currency: 'USD', notes: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  useEffect(() => {
    supabase.from('company_bank_accounts').select('*').eq('company_id', company.id).then(({ data }) => setAccounts(data || []))
  }, [company.id])

  const handleSave = async () => {
    setSaving(true)
    const { data } = await supabase.from('company_bank_accounts').insert([{ ...f, company_id: company.id }]).select().single()
    if (data) setAccounts(p => [...p, data])
    setSaving(false)
    setShowNew(false)
    setF({ bank_name: '', bank_address: '', account_holder: '', account_number: '', swift_bic: '', currency: 'USD', notes: '' })
  }

  const remove = async (id) => {
    if (!window.confirm('Remove this bank account?')) return
    await supabase.from('company_bank_accounts').delete().eq('id', id)
    setAccounts(p => p.filter(a => a.id !== id))
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Bank account details shared with partner companies after handshake.</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><i className="ti ti-plus" /> Add bank account</button>
      </div>

      {accounts.map(a => (
        <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, position: 'relative' }}>
          <button className="btn-icon" onClick={() => remove(a.id)} style={{ position: 'absolute', top: 12, right: 12 }}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
          {[
            { label: 'Bank name', value: a.bank_name },
            { label: 'Account holder', value: a.account_holder },
            { label: 'Currency', value: a.currency },
            { label: 'Account number / IBAN', value: a.account_number },
            { label: 'SWIFT / BIC', value: a.swift_bic },
            { label: 'Bank address', value: a.bank_address },
          ].map(field => (
            <div key={field.label}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{field.label}</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-1)', fontFamily: field.label.includes('Account') || field.label.includes('SWIFT') ? 'var(--mono)' : 'inherit' }}>{field.value || '—'}</div>
            </div>
          ))}
          {a.notes && <div style={{ gridColumn: '1 / -1', fontSize: 12.5, color: 'var(--text-3)', fontStyle: 'italic' }}>{a.notes}</div>}
        </div>
      ))}

      {accounts.length === 0 && !showNew && (
        <div className="empty"><i className="ti ti-building-bank" /><div className="empty-title">No bank accounts yet</div><div className="empty-sub">Add banking details for payments and reconciliation</div></div>
      )}

      {showNew && (
        <div style={{ border: '1px solid var(--border-md)', borderRadius: 'var(--radius)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>New bank account</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Bank name</label><input className="form-input" value={f.bank_name} onChange={e => set('bank_name', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Account holder name</label><input className="form-input" value={f.account_holder} onChange={e => set('account_holder', e.target.value)} /></div>
            <div className="form-group" style={{ maxWidth: 120 }}><label className="form-label">Currency</label>
              <select className="form-select" value={f.currency} onChange={e => set('currency', e.target.value)}>
                {['USD','EUR','GBP','COP','KES','ETB'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Account number / IBAN</label><input className="form-input" style={{ fontFamily: 'var(--mono)' }} value={f.account_number} onChange={e => set('account_number', e.target.value)} /></div>
            <div className="form-group" style={{ maxWidth: 200 }}><label className="form-label">SWIFT / BIC code</label><input className="form-input" style={{ fontFamily: 'var(--mono)' }} value={f.swift_bic} onChange={e => set('swift_bic', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Full bank address</label><input className="form-input" value={f.bank_address} onChange={e => set('bank_address', e.target.value)} placeholder="Bank street, city, country" /></div>
          <div className="form-group"><label className="form-label">Notes</label><input className="form-input" value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional" /></div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save bank account'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Contacts Tab ──────────────────────────────────────────────────────────────
function ContactsTab({ company }) {
  const [contacts, setContacts] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [f, setF] = useState({ first_name: '', last_name: '', title: '', contact_type: 'management', email: '', phone: '', mobile: '', has_origins_login: false, origins_role: 'user', notes: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const TYPE_LABELS = { management: 'Management', sales: 'Sales', finance: 'Finance', logistics: 'Logistics', other: 'Other' }
  const TYPE_COLORS = { management: '#7C3AED', sales: '#059669', finance: '#D97706', logistics: '#2563EB', other: '#6B7280' }

  useEffect(() => {
    supabase.from('company_contacts').select('*').eq('company_id', company.id).order('contact_type').then(({ data }) => setContacts(data || []))
  }, [company.id])

  const handleSave = async () => {
    if (!f.first_name || !f.last_name) return
    setSaving(true)
    const { data } = await supabase.from('company_contacts').insert([{ ...f, company_id: company.id }]).select().single()
    if (data) setContacts(p => [...p, data])
    setSaving(false)
    setShowNew(false)
    setF({ first_name: '', last_name: '', title: '', contact_type: 'management', email: '', phone: '', mobile: '', has_origins_login: false, origins_role: 'user', notes: '' })
  }

  const remove = async (id) => {
    if (!window.confirm('Remove this contact?')) return
    await supabase.from('company_contacts').delete().eq('id', id)
    setContacts(p => p.filter(c => c.id !== id))
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><i className="ti ti-plus" /> Add contact</button>
      </div>

      {contacts.map(c => (
        <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 16, position: 'relative' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: TYPE_COLORS[c.contact_type] + '20', color: TYPE_COLORS[c.contact_type], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            {c.first_name[0]}{c.last_name[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{c.first_name} {c.last_name}</span>
              {c.title && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>· {c.title}</span>}
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: TYPE_COLORS[c.contact_type] + '18', color: TYPE_COLORS[c.contact_type] }}>{TYPE_LABELS[c.contact_type]}</span>
              {c.has_origins_login && <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'var(--green-light)', color: 'var(--green)' }}>Origins {c.origins_role}</span>}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-2)' }}>
              {c.email && <span><i className="ti ti-mail" style={{ marginRight: 4 }} />{c.email}</span>}
              {c.mobile && <span><i className="ti ti-device-mobile" style={{ marginRight: 4 }} />{c.mobile}</span>}
              {c.phone && <span><i className="ti ti-phone" style={{ marginRight: 4 }} />{c.phone}</span>}
            </div>
          </div>
          <button className="btn-icon" onClick={() => remove(c.id)}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
        </div>
      ))}

      {contacts.length === 0 && !showNew && (
        <div className="empty"><i className="ti ti-users" /><div className="empty-title">No contacts yet</div><div className="empty-sub">Add the people who represent this company</div></div>
      )}

      {showNew && (
        <div style={{ border: '1px solid var(--border-md)', borderRadius: 'var(--radius)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>New contact</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">First name *</label><input className="form-input" value={f.first_name} onChange={e => set('first_name', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Last name *</label><input className="form-input" value={f.last_name} onChange={e => set('last_name', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Title / Role at company</label><input className="form-input" value={f.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Sales Manager" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Contact type</label>
              <select className="form-select" value={f.contact_type} onChange={e => set('contact_type', e.target.value)}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={f.email} onChange={e => set('email', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Mobile</label><input className="form-input" value={f.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+1 555 000 0000" /></div>
            <div className="form-group"><label className="form-label">Phone (office)</label><input className="form-input" value={f.phone} onChange={e => set('phone', e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={f.has_origins_login} onChange={e => set('has_origins_login', e.target.checked)} />
              This person has Origins login access
            </label>
            {f.has_origins_login && (
              <select className="form-select" style={{ width: 'auto' }} value={f.origins_role} onChange={e => set('origins_role', e.target.value)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            )}
          </div>
          <div className="form-group"><label className="form-label">Notes</label><input className="form-input" value={f.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !f.first_name || !f.last_name}>{saving ? 'Saving…' : 'Add contact'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Product Catalogue Tab (growers only) ──────────────────────────────────────
function CatalogueTab({ company }) {
  const [products, setProducts] = useState([])
  const [catalogue, setCatalogue] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addSearch, setAddSearch] = useState('')
  const [addResults, setAddResults] = useState([])

  useEffect(() => {
    supabase.from('products').select('*').order('name').then(({ data }) => setProducts(data || []))
  }, [])

  useEffect(() => {
    setLoading(true)
    supabase
      .from('grower_products')
      .select('*, products(id, name, vbn_code, country, bkh)')
      .eq('company_id', company.id)
      .order('created_at')
      .then(({ data }) => { setCatalogue(data || []); setLoading(false) })
  }, [company.id])

  useEffect(() => {
    if (addSearch.length < 2) { setAddResults([]); return }
    const q = addSearch.toLowerCase()
    const existing = new Set(catalogue.map(gp => gp.product_id))
    setAddResults(products.filter(p => !existing.has(p.id) &&
      ((p.name || '').toLowerCase().includes(q) || (p.vbn_code || '').includes(q))).slice(0, 30))
  }, [addSearch, catalogue, products])

  const addProduct = async (product) => {
    const { data, error } = await supabase
      .from('grower_products')
      .insert([{ company_id: company.id, product_id: product.id }])
      .select('*, products(id, name, vbn_code, country, bkh)')
      .single()
    if (!error && data) { setCatalogue(prev => [...prev, data]); setAddSearch(''); setAddResults([]) }
  }

  const removeProduct = async (gpId) => {
    await supabase.from('grower_products').delete().eq('id', gpId)
    setCatalogue(prev => prev.filter(gp => gp.id !== gpId))
  }

  const filtered = catalogue.filter(gp =>
    !search || (gp.products?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (gp.products?.vbn_code || '').includes(search))

  return (
    <div>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input className="form-input" placeholder="Search and add a product to this grower's catalogue…"
            value={addSearch} onChange={e => setAddSearch(e.target.value)} />
          {addResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border-md)', borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 240, overflowY: 'auto' }}>
              {addResults.map(p => (
                <div key={p.id} onMouseDown={() => addProduct(p)} className="add-product-row"
                  style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid var(--border)' }}>
                  <span>{p.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{p.vbn_code}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <input className="search-input" placeholder="Filter catalogue…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Product</th><th>VBN Code</th><th>Country</th><th>BKH</th><th>Typical price</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6}><div className="empty"><i className="ti ti-loader" /><div className="empty-title">Loading…</div></div></td></tr>}
            {!loading && filtered.map(gp => (
              <tr key={gp.id} style={{ cursor: 'default' }}>
                <td style={{ fontWeight: 500 }}>{gp.products?.name || '—'}</td>
                <td className="td-mono">{gp.products?.vbn_code || '—'}</td>
                <td className="td-muted">{gp.products?.country ? `${flag(gp.products.country)} ${gp.products.country}` : '—'}</td>
                <td className="td-mono">{gp.products?.bkh || '—'}</td>
                <td className="td-brown">{gp.typical_price ? `$${Number(gp.typical_price).toFixed(2)}` : '—'}</td>
                <td style={{ width: 40 }}>
                  <button className="btn-icon" onClick={() => removeProduct(gp.id)} title="Remove from catalogue"><i className="ti ti-x" style={{ fontSize: 14 }} /></button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6}><div className="empty"><i className="ti ti-flower" /><div className="empty-title">No products in catalogue yet</div><div className="empty-sub">Search above to add the varieties this grower offers</div></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main CompanyProfile component ─────────────────────────────────────────────
export default function CompanyProfile({ company, onBack, onUpdate, embedded = false }) {
  const [tab, setTab] = useState('general')
  const [c, setC] = useState(company)

  const typeColors = { buyer: 'var(--green)', grower: 'var(--brown)', logistics: '#2563EB' }
  const typeLabels = { buyer: 'Buyer', grower: 'Grower', logistics: 'Logistics' }

  return (
    <>
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}><i className="ti ti-arrow-left" /> Companies</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 21, fontWeight: 400 }}>{c.brand_name || c.name}</h1>
        {c.brand_name && c.name !== c.brand_name && <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{c.name}</span>}
        <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: typeColors[c.type] + '18', color: typeColors[c.type] }}>
          {typeLabels[c.type]}
        </span>
      </div>

      <div className="card">
        <div className="tabs" style={{ padding: '0 20px' }}>
          <div className={`tab${tab === 'general' ? ' active' : ''}`} onClick={() => setTab('general')}>General info</div>
          <div className={`tab${tab === 'banking' ? ' active' : ''}`} onClick={() => setTab('banking')}>Banking</div>
          <div className={`tab${tab === 'contacts' ? ' active' : ''}`} onClick={() => setTab('contacts')}>Contacts & Users</div>
          {c.type === 'grower' && <div className={`tab${tab === 'catalogue' ? ' active' : ''}`} onClick={() => setTab('catalogue')}>Product catalogue</div>}
        </div>

        {tab === 'general' && <GeneralTab company={c} onSave={updated => { setC(updated); if (onUpdate) onUpdate(updated) }} />}
        {tab === 'banking' && <BankingTab company={c} />}
        {tab === 'contacts' && <ContactsTab company={c} />}
        {tab === 'catalogue' && c.type === 'grower' && <CatalogueTab company={c} />}
      </div>
    </>
  )
}
