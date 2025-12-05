
// src/config.ts

// 環境變數讀取
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const CONFIG = {
  SUPABASE: {
// Supabase URL (從您的截圖與之前的檔案取得)
    URL: 'https://fbpdjnreljhfgmdflfjl.supabase.co',
    
    // Supabase Anon Key
    KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZicGRqbnJlbGpoZmdtZGZsZmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NjY1OTUsImV4cCI6MjA4MDM0MjU5NX0.Ocy7vUZ3tURpPC2t7PQ4062r_zxtVSNehiYN2nT6blQ',  },
  // 資料表名稱對應設定 (Table Name Mapping)
  TABLES: {
    ORDERS: 'cali_orders',
    PRODUCTS: 'cali_products',
    CUSTOMERS: 'cali_customers',
    TECHNICIANS: 'cali_technicians',
    // 依據架構需求，區分不同的設定表
    ADMIN_SETTINGS: 'ali_settings', 
    USER_SETTINGS: 'cali_settings', 
  },
  // 系統常數
  CONSTANTS: {
    ADMIN_PWD_KEY: 'AdminPassword',
    USER_PWD_PREFIX: 'User:',
    BATCH_SIZE: 1000, // Supabase fetch limit
  }
};
