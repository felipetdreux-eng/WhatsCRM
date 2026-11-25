import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://khdqisojedaalystpdah.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_DB-cxgfSTjDwWiKnUI-c2A_ZASN6KZ1';
export const SUPABASE_PROJECT_REF = 'khdqisojedaalystpdah';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
