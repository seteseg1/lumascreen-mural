import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yxjafnicgkansgbhrgrp.supabase.co'; 
const supabaseAnonKey = 'sb_publishable_TG5NWPw3g4kJzVeJ-4KjEA_Hef7Tx7s'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);