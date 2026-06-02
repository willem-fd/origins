import { useState, useRef, useEffect, useMemo } from 'react'
import { COUNTRIES } from './constants'

// Searchable country selector.
// Type to filter (case-insensitive on name or code), click or press Enter to pick.
// Reusable across the app — pass `className` to match the surrounding form style
// (e.g. 'auth-input' inside the auth shell, 'form-input' inside form cards).
export default function CountryCombobox({ value, onChange, className = 'form-input', placeholder = 'Select country…' }) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef  = useRef(null)
  const inputRef = useRef(null)

  const selected = useMemo(() => COUNTRIES.find(c => c.code === value), [value])
  const filtered = useMemo(() => {
    if (!query.trim()) return COUNTRIES
    const q = query.trim().toLowerCase()
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
  }, [query])

  // Outside click closes
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = (c) => {
    onChange(c.code)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  // Closed: show flag + name of selected country (or empty)
  // Open: input is the search box; show whatever the user typed
  const display = open ? query : (selected ? `${selected.flag} ${selected.name}` : '')

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        className={className}
        value={display}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true) }}
        onFocus={() => { setOpen(true); setQuery('') }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur() }
          if (e.key === 'Enter' && filtered.length > 0) { e.preventDefault(); pick(filtered[0]) }
        }}
        autoComplete="off"
        spellCheck={false}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          maxHeight: 240, overflowY: 'auto',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100,
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', color: 'var(--text-3)', fontSize: 13 }}>No matches</div>
          ) : filtered.map(c => (
            <div
              key={c.code}
              onMouseDown={(e) => { e.preventDefault(); pick(c) }}
              style={{
                padding: '8px 12px', fontSize: 13.5, cursor: 'pointer',
                background: c.code === value ? 'var(--surface-2)' : 'transparent',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = c.code === value ? 'var(--surface-2)' : 'transparent' }}
            >
              {c.flag} {c.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
