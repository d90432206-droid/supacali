
const { createClient } = require('@supabase/supabase-js');

const URL = 'https://fbpdjnreljhfgmdflfjl.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZicGRqbnJlbGpoZmdtZGZsZmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NjY1OTUsImV4cCI6MjA4MDM0MjU5NX0.Ocy7vUZ3tURpPC2t7PQ4062r_zxtVSNehiYN2nT6blQ';

const supabase = createClient(URL, KEY);

async function verifyFix() {
    console.log('🔍 Verifying Supabase Schema Fix...');

    // 1. Test Insert with Technicians (The column that was missing)
    const testId = crypto.randomUUID();
    const payload = {
        id: testId,
        order_number: 'TEST-VERIFY-' + Date.now(),
        equipment_number: 'TEST-EQ-001',
        equipment_name: 'Test Equipment',
        customer_name: 'Test Customer',
        technicians: ['Test Tech 1', 'Test Tech 2'], // This triggered the error before
        status: 'Pending',
        create_date: new Date().toISOString()
    };

    console.log('Attempting to insert order with technicians...');
    const { data, error } = await supabase.from('cali_orders').insert(payload).select();

    if (error) {
        console.error('❌ Insert Failed:', error.message);
        console.error('Details:', error);
        process.exit(1);
    } else {
        console.log('✅ Insert Successful! "technicians" column exists and is writable.');

        // 2. Clean up
        console.log('🧹 Cleaning up test data...');
        const { error: delError } = await supabase.from('cali_orders').delete().eq('id', testId);
        if (delError) console.warn('⚠️ Cleanup failed:', delError.message);
        else console.log('✅ Cleanup successful.');
    }
}

verifyFix();
