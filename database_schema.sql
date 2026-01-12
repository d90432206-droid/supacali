-- =====================================================
-- 制宜電測校正系統 - Supabase 資料庫架構
-- Database Schema for CHUYI Calibration System
-- =====================================================

-- 清理現有表格（謹慎使用！）
-- DROP TABLE IF EXISTS cali_orders CASCADE;
-- DROP TABLE IF EXISTS cali_products CASCADE;
-- DROP TABLE IF EXISTS cali_customers CASCADE;
-- DROP TABLE IF EXISTS cali_technicians CASCADE;
-- DROP TABLE IF EXISTS cali_settings CASCADE;
-- DROP TABLE IF EXISTS ali_settings CASCADE;

-- =====================================================
-- 1. 校正產品/服務項目表 (Calibration Products/Services)
-- =====================================================
CREATE TABLE IF NOT EXISTS cali_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                      -- 產品/服務名稱
    specification TEXT,                      -- 規格
    category TEXT,                           -- 類別（長度、壓力、電量等）
    standard_price NUMERIC(10,2) NOT NULL,   -- 標準價格
    last_updated TIMESTAMPTZ DEFAULT NOW(),  -- 最後更新時間
    
    CONSTRAINT cali_products_name_check CHECK (length(name) > 0),
    CONSTRAINT cali_products_price_check CHECK (standard_price >= 0)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_cali_products_name ON cali_products(name);
CREATE INDEX IF NOT EXISTS idx_cali_products_category ON cali_products(category);

-- =====================================================
-- 2. 客戶表 (Customers)
-- =====================================================
CREATE TABLE IF NOT EXISTS cali_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,               -- 客戶名稱（唯一）
    contact_person TEXT,                     -- 聯絡人
    phone TEXT,                              -- 電話
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT cali_customers_name_check CHECK (length(name) > 0)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_cali_customers_name ON cali_customers(name);

-- =====================================================
-- 3. 技術人員表 (Technicians)
-- =====================================================
CREATE TABLE IF NOT EXISTS cali_technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,               -- 技術人員姓名（唯一）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT cali_technicians_name_check CHECK (length(name) > 0)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_cali_technicians_name ON cali_technicians(name);

-- =====================================================
-- 4. 校正訂單表 (Calibration Orders)
-- =====================================================
CREATE TABLE IF NOT EXISTS cali_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 訂單資訊 (Order Information)
    order_number TEXT NOT NULL,              -- 校正訂單編號（可重複，同一訂單可有多筆明細）
    create_date TIMESTAMPTZ DEFAULT NOW(),   -- 建立日期
    target_date TIMESTAMPTZ,                 -- 預定完成日期
    
    -- 設備資訊 (Equipment Information)
    equipment_number TEXT NOT NULL,          -- 設備案號
    equipment_name TEXT NOT NULL,            -- 設備名稱
    customer_name TEXT NOT NULL,             -- 客戶名稱
    
    -- 校正服務明細 (Calibration Service Details)
    product_id UUID,                         -- 關聯到 cali_products.id（可為 NULL）
    product_name TEXT NOT NULL,              -- 校正品項名稱
    product_spec TEXT,                       -- 產品規格
    category TEXT,                           -- 類別
    calibration_type TEXT NOT NULL,          -- 校正類型：Internal/External（內校/委外）
    
    -- 數量與金額 (Quantity & Pricing)
    quantity INTEGER NOT NULL DEFAULT 1,     -- 數量
    unit_price NUMERIC(10,2) NOT NULL,       -- 單價
    discount_rate NUMERIC(5,2) DEFAULT 100,  -- 折扣率（%）
    total_amount NUMERIC(10,2) NOT NULL,     -- 總金額
    
    -- 狀態與備註
    status TEXT NOT NULL DEFAULT 'Pending',  -- 狀態：Pending/Calibrating/Completed
    is_archived BOOLEAN DEFAULT FALSE,       -- 是否已歸檔
    resurrect_reason TEXT,                   -- 復活原因（解除歸檔時填寫）
    notes TEXT,                              -- 備註
    
    -- 技術人員（陣列）
    technicians TEXT[] DEFAULT '{}',         -- 負責技術人員名稱陣列
    
    -- 外鍵約束
    CONSTRAINT fk_cali_orders_product 
        FOREIGN KEY (product_id) 
        REFERENCES cali_products(id) 
        ON DELETE SET NULL,
    
    -- 檢查約束
    CONSTRAINT cali_orders_quantity_check CHECK (quantity > 0),
    CONSTRAINT cali_orders_unit_price_check CHECK (unit_price >= 0),
    CONSTRAINT cali_orders_discount_check CHECK (discount_rate >= 0 AND discount_rate <= 100),
    CONSTRAINT cali_orders_total_check CHECK (total_amount >= 0),
    CONSTRAINT cali_orders_status_check CHECK (status IN ('Pending', 'Calibrating', 'Completed')),
    CONSTRAINT cali_orders_type_check CHECK (calibration_type IN ('Internal', 'External'))
);

-- 索引（優化查詢效能）
CREATE INDEX IF NOT EXISTS idx_cali_orders_order_number ON cali_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_cali_orders_create_date ON cali_orders(create_date DESC);
CREATE INDEX IF NOT EXISTS idx_cali_orders_status ON cali_orders(status);
CREATE INDEX IF NOT EXISTS idx_cali_orders_customer ON cali_orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_cali_orders_archived ON cali_orders(is_archived);
CREATE INDEX IF NOT EXISTS idx_cali_orders_target_date ON cali_orders(target_date);

-- =====================================================
-- 5. 系統設定表 - 管理員 (Admin Settings)
-- =====================================================
CREATE TABLE IF NOT EXISTS ali_settings (
    key TEXT PRIMARY KEY,                    -- 設定鍵（例：AdminPassword）
    value TEXT NOT NULL,                     -- 設定值
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入預設管理員密碼（0000）
INSERT INTO ali_settings (key, value) 
VALUES ('AdminPassword', '0000')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 6. 系統設定表 - 使用者 (User Settings)
-- =====================================================
CREATE TABLE IF NOT EXISTS cali_settings (
    key TEXT PRIMARY KEY,                    -- 設定鍵（例：User:陳小明）
    value TEXT NOT NULL,                     -- 設定值（密碼）
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. 初始化範例資料 (Sample Data)
-- =====================================================

-- 插入範例產品
INSERT INTO cali_products (name, specification, category, standard_price) VALUES
    ('數位卡尺', '0-150mm', '長度', 500),
    ('壓力錶', '0-10kg/cm2', '壓力', 1200),
    ('三用電表', 'Fluke 179', '電量', 2500),
    ('溫度計', '-20~100°C', '溫度', 800),
    ('游標卡尺', '0-200mm', '長度', 600),
    ('扭力扳手', '0-100 N·m', '扭力', 1800)
ON CONFLICT DO NOTHING;

-- 插入範例客戶
INSERT INTO cali_customers (name, contact_person, phone) VALUES
    ('台積電', '張經理', '0912-345-678'),
    ('聯發科', '王工程師', '0987-654-321'),
    ('鴻海精密', '李先生', '0923-456-789'),
    ('友達光電', '陳小姐', '0934-567-890')
ON CONFLICT (name) DO NOTHING;

-- 插入範例技術人員
INSERT INTO cali_technicians (name) VALUES
    ('陳小明'),
    ('林大華'),
    ('王美玲'),
    ('張志豪')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 8. RLS (Row Level Security) 政策設定
-- =====================================================
-- 注意：由於您的系統使用自訂驗證（非 Supabase Auth），
-- 建議暫時停用 RLS 或設定允許所有操作的政策

-- 停用 RLS（開發階段）
ALTER TABLE cali_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE cali_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE cali_customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE cali_technicians DISABLE ROW LEVEL SECURITY;
ALTER TABLE ali_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE cali_settings DISABLE ROW LEVEL SECURITY;

-- 如果需要啟用 RLS，請使用以下政策範例：
/*
ALTER TABLE cali_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users" ON cali_orders
    FOR ALL USING (true) WITH CHECK (true);
*/

-- =====================================================
-- 9. 權限設定（確保 anon 角色可以存取）
-- =====================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- =====================================================
-- 10. 觸發器：自動更新時間戳記
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 應用到設定表
CREATE TRIGGER update_ali_settings_updated_at
    BEFORE UPDATE ON ali_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cali_settings_updated_at
    BEFORE UPDATE ON cali_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 完成！資料庫架構建立完成
-- =====================================================

-- 檢視表格清單
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'cali_%' OR table_name LIKE 'ali_%'
ORDER BY table_name;
