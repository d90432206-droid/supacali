
import { createClient } from '@supabase/supabase-js';

// Hardcoding config from config.ts for the script
const URL = 'https://fbpdjnreljhfgmdflfjl.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZicGRqbnJlbGpoZmdtZGZsZmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NjY1OTUsImV4cCI6MjA4MDM0MjU5NX0.Ocy7vUZ3tURpPC2t7PQ4062r_zxtVSNehiYN2nT6blQ';

const supabase = createClient(URL, KEY);

async function checkSchema() {
    console.log('Checking cali_orders schema...');

    // Try to insert a dummy row with minimal data to see if it works, or inspect errors
    // But inserting bad data might corrupt DB.
    // Instead, select * limit 1 and inspect keys if data exists? 
    // If no data exists, we can't see keys from REST API easily without metadata endpoint (which requires admin usually).

    // Better: Try to SELECT from specific columns we suspect are missing.
    // If specific column select fails, it throws "column does not exist".

    const columnsToCheck = [
        'technicians',
        'product_name',
        'product_spec',
        'category',
        'calibration_type',
        'target_date',
        'create_date',
        'status',
        'unit_price',
        'quantity',
        'discount_rate',
        'total_amount',
        'is_archived',
        'resurrect_reason',
        'notes'
    ];

    for (const col of columnsToCheck) {
        const { error } = await supabase.from('cali_orders').select(col).limit(1);
        if (error) {
            console.log(`❌ Column '${col}' check failed:`, error.message);
        } else {
            console.log(`✅ Column '${col}' exists.`);
        }
    }
}

checkSchema();
