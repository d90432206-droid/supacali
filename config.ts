
// Safely access environment variables
const getEnv = (key: string) => {
  try {
    return (import.meta as any).env?.[key] || '';
  } catch {
    return '';
  }
};

export const CONFIG = {
  SUPABASE: {
    // 預設值僅供 Demo 使用，建議使用環境變數覆寫
    URL: getEnv('VITE_SUPABASE_URL') || 'https://wcgdapjjzpzvjprzudyq.supabase.co',
    KEY: getEnv('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZ2RhcGpqenB6dmpwcnp1ZHlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NTc4ODEsImV4cCI6MjA4MzUzMzg4MX0._Nn91KgZjMCZfvr6189RY-GIy_l-PwZSAIrQ06SYJNY',
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
