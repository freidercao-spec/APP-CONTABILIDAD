import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const supabaseAnonKey = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    console.log("Checking table descargos...");
    const { data: desc, error: descErr } = await supabase.from('descargos').select('*').limit(1);
    if (descErr) {
        console.error("❌ DESCARGOS SELECT ERROR:", descErr);
    } else {
        console.log("✅ DESCARGOS SELECT SUCCESS, columns:", Object.keys(desc[0] || {}));
    }

    console.log("Checking table vacaciones...");
    const { data: vac, error: vacErr } = await supabase.from('vacaciones').select('*').limit(1);
    if (vacErr) {
        console.error("❌ VACACIONES SELECT ERROR:", vacErr);
    } else {
        console.log("✅ VACACIONES SELECT SUCCESS, columns:", Object.keys(vac[0] || {}));
    }
}

run();
