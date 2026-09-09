import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://myllrhcgbrwfvtqxgkcb.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Rs03JEyGR0ZRUByacZwIpw_4PfRcyKQ';
export const SUPABASE_PROJECT_REF = 'myllrhcgbrwfvtqxgkcb';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
