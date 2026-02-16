
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://srsnjifezttivawxnndu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyc25qaWZlenR0aXZhd3hubmR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNzY1MjcsImV4cCI6MjA3OTY1MjUyN30.5RmDp3QgAYX7yDS39KwoRtHc6c9Kp-wGKGYeJctoY7w';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
