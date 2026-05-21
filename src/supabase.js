import { createClient } from '@supabase/supabase-js'
const SUPABASE_URL = 'https://zzpxcjmvyimwziqljlmb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6cHhjam12eWltd3ppcWxqbG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMTU5NjYsImV4cCI6MjA5NDg5MTk2Nn0.Hqt0uW-Kz4Wm-JaN_FaEtG5KYyVM430KVWPS8890P58'
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
