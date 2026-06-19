import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ylcpizjfwupfvffsbjmz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase.from('usuarios').select('count', { count: 'exact', head: true });
    if (error) {
        console.error('❌ Connection failed:', error.message);
    } else {
        console.log('✅ Connection successful. User count:', data);
    }
}

test();
