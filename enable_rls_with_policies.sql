-- =====================================================
-- 啟用 RLS 並配置安全策略
-- 制宜電測校正系統 - Supabase RLS 設定腳本
-- =====================================================
-- 執行方式：複製此檔案內容，貼到 Supabase Dashboard > SQL Editor 中執行
-- 執行時間：約 2-3 秒
-- =====================================================

-- 第一步：啟用 RLS
-- =====================================================
ALTER TABLE cali_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cali_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cali_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cali_technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE ali_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cali_settings ENABLE ROW LEVEL SECURITY;

-- 第二步：刪除舊有策略（如果存在，避免衝突）
-- =====================================================
DROP POLICY IF EXISTS "Allow all for anon users" ON cali_orders;
DROP POLICY IF EXISTS "Allow all for anon users" ON cali_products;
DROP POLICY IF EXISTS "Allow all for anon users" ON cali_customers;
DROP POLICY IF EXISTS "Allow all for anon users" ON cali_technicians;
DROP POLICY IF EXISTS "Allow all for anon users" ON ali_settings;
DROP POLICY IF EXISTS "Allow all for anon users" ON cali_settings;

-- 第三步：創建新策略（允許所有 anon 和 authenticated 用戶）
-- =====================================================
CREATE POLICY "Allow all for anon users" ON cali_orders
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow all for anon users" ON cali_products
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow all for anon users" ON cali_customers
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow all for anon users" ON cali_technicians
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow all for anon users" ON ali_settings
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow all for anon users" ON cali_settings
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- =====================================================
-- 驗證設定
-- =====================================================
-- 檢查所有表的 RLS 狀態（應全部為 true）
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
    AND (tablename LIKE 'cali_%' OR tablename LIKE 'ali_%')
ORDER BY tablename;

-- 檢查所有策略（應看到 6 條策略）
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
    AND (tablename LIKE 'cali_%' OR tablename LIKE 'ali_%')
ORDER BY tablename;

-- =====================================================
-- 完成！
-- =====================================================
-- ✅ RLS 已啟用
-- ✅ 所有表都配置了允許 anon 用戶的策略
-- ✅ 您的應用現在可以正常讀取所有數據了
-- 
-- 注意事項：
-- 1. 此配置適合內部系統使用
-- 2. 任何擁有 anon key 的用戶都能訪問數據
-- 3. 若需更嚴格的權限控制，請考慮遷移到 Supabase Auth
-- =====================================================
