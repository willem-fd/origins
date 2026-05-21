// Country list
export const COUNTRIES = [
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹' },
  { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
]

export const FLAGS = Object.fromEntries(COUNTRIES.map(c => [c.code, c.flag]))
export const flag = c => FLAGS[c] || '🌐'

export const SHIP_STATUSES = ['draft','active','dropped','in_transit','arrived','completed']

export const fmt = (n, d=2) => n == null || n === '' ? '—' :
  Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})

// Validation helpers
export const validateEmail = e => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
export const validatePhone = p => !p || /^[\+\d\s\-\(\)]{6,20}$/.test(p)
