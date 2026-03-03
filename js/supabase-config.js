export const SUPABASE_URL = 'https://srsnjifezttivawxnndu.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI...'; // Je volledige key

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
