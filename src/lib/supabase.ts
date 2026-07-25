import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const fallbackUrl = 'https://cioggccobgnglprrvfpk.supabase.co'
const fallbackPublishableKey = 'sb_publishable_v_qzelV5YofpbQWaxf4wIw_mhKt-WOh'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackUrl
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || fallbackPublishableKey

export const supabase: SupabaseClient = createClient(supabaseUrl, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 4 },
  },
})
