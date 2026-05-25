// ── Shipment statuses ─────────────────────────────────────────────────────────
export const SHIP_STATUSES = ['draft', 'active', 'in_transit', 'departed', 'arrived', 'completed']

export const STATUS_LABELS = {
  draft:      'Draft',
  active:     'Active',
  in_transit: 'In Transit',
  departed:   'Departed',
  arrived:    'Arrived',
  completed:  'Completed',
}

export const STATUS_BADGE = {
  draft:      'badge-draft',
  active:     'badge-active',
  in_transit: 'badge-transit',
  departed:   'badge-departed',
  arrived:    'badge-arrived',
  completed:  'badge-completed',
}

// ── Countries ─────────────────────────────────────────────────────────────────
export const COUNTRIES = [
  { code: 'EC', name: 'Ecuador',      flag: '🇪🇨' },
  { code: 'CO', name: 'Colombia',     flag: '🇨🇴' },
  { code: 'KE', name: 'Kenya',        flag: '🇰🇪' },
  { code: 'ET', name: 'Ethiopia',     flag: '🇪🇹' },
  { code: 'ZW', name: 'Zimbabwe',     flag: '🇿🇼' },
  { code: 'TZ', name: 'Tanzania',     flag: '🇹🇿' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'MX', name: 'Mexico',       flag: '🇲🇽' },
  { code: 'IN', name: 'India',        flag: '🇮🇳' },
  { code: 'CN', name: 'China',        flag: '🇨🇳' },
  { code: 'NL', name: 'Netherlands',  flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium',      flag: '🇧🇪' },
  { code: 'DE', name: 'Germany',      flag: '🇩🇪' },
  { code: 'FR', name: 'France',       flag: '🇫🇷' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'AE', name: 'UAE',          flag: '🇦🇪' },
]

export const FLAGS = Object.fromEntries(COUNTRIES.map(c => [c.code, c.flag]))
export const flag = c => FLAGS[c] || '🌐'

// ── Helpers ───────────────────────────────────────────────────────────────────
export const fmt = (n, d = 2) => n == null || n === '' ? '—' :
  Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

export const validateEmail = e => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
export const validatePhone = p => !p || /^[\+\d\s\-\(\)]{6,20}$/.test(p)
