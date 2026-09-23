import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const backendConfigured = typeof url === 'string' && /^https?:\/\//.test(url) && typeof key === 'string' && key.length > 20;
export const supabase = createClient<Database>(backendConfigured ? url : 'https://unconfigured.invalid', backendConfigured ? key : 'unconfigured-publishable-key', {
  auth: { persistSession: backendConfigured, autoRefreshToken: backendConfigured, detectSessionInUrl: backendConfigured },
});
