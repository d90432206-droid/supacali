
// config.ts

// Safely access environment variables
const getEnv = (key: string) => {
  try {
    return (import.meta as any).env?.[key] || '';
  } catch {
    return '';
  }
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
const SUPABASE_KEY = getEnv('VITE_SUPABASE_ANON_KEY');

export const CONFIG = {
  SUPABASE: {
    // 預設值僅供 Demo 使用，建議使用環境變數覆寫
    URL: SUPABASE_URL || 'https://fbpdjnreljhfgmdflfjl.supabase.co',
    KEY: SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZicGRqbnJlbGpoZmdtZGZsZmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NjY1OTUsImV4cCI6MjA4MDM0MjU5NX0.Ocy7vUZ3tURpPC2t7PQ4062r_zxtVSNehiYN2nT6blQ',
  },
  // 資料表名稱對應設定
  TABLES: {
    ORDERS: 'cali_orders',
    PRODUCTS: 'cali_products',
    CUSTOMERS: 'cali_customers',
    TECHNICIANS: 'cali_technicians',
    ADMIN_SETTINGS: 'ali_settings', 
    USER_SETTINGS: 'cali_settings', 
  },
  // 系統常數
  CONSTANTS: {
    ADMIN_PWD_KEY: 'AdminPassword',
    USER_PWD_PREFIX: 'User:',
    BATCH_SIZE: 1000,
  }
};
