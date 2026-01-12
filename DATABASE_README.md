# 制宜電測校正系統 - 資料庫架構說明

## 📋 系統概述

這是一個校正服務管理系統，用於管理**校正訂單**、**客戶資料**、**產品庫存**和**技術人員**等核心業務流程。

---

## 🗂️ 資料表架構

### 1. **cali_products** - 校正產品/服務項目表

**用途**：儲存可提供的校正服務項目清單（例如：數位卡尺校正、壓力錶校正等）

| 欄位名稱 | 資料型別 | 說明 | 約束 |
|---------|---------|------|------|
| `id` | UUID | 主鍵 | PRIMARY KEY, 自動生成 |
| `name` | TEXT | 產品/服務名稱 | NOT NULL |
| `specification` | TEXT | 規格（例：0-150mm） | - |
| `category` | TEXT | 類別（長度、壓力、電量等） | - |
| `standard_price` | NUMERIC(10,2) | 標準價格 | NOT NULL, >= 0 |
| `last_updated` | TIMESTAMPTZ | 最後更新時間 | 自動填入 NOW() |

**索引**：
- `name`：加速名稱搜尋
- `category`：加速分類篩選

---

### 2. **cali_customers** - 客戶表

**用途**：儲存客戶基本資料

| 欄位名稱 | 資料型別 | 說明 | 約束 |
|---------|---------|------|------|
| `id` | UUID | 主鍵 | PRIMARY KEY, 自動生成 |
| `name` | TEXT | 客戶名稱 | NOT NULL, UNIQUE |
| `contact_person` | TEXT | 聯絡人 | - |
| `phone` | TEXT | 電話 | - |
| `created_at` | TIMESTAMPTZ | 建立時間 | 自動填入 NOW() |

**索引**：
- `name`：加速客戶查詢（UNIQUE 索引）

---

### 3. **cali_technicians** - 技術人員表

**用途**：儲存負責校正工作的技術人員名單

| 欄位名稱 | 資料型別 | 說明 | 約束 |
|---------|---------|------|------|
| `id` | UUID | 主鍵 | PRIMARY KEY, 自動生成 |
| `name` | TEXT | 技術人員姓名 | NOT NULL, UNIQUE |
| `created_at` | TIMESTAMPTZ | 建立時間 | 自動填入 NOW() |

**索引**：
- `name`：加速人員查詢（UNIQUE 索引）

---

### 4. **cali_orders** - 校正訂單表（核心表）

**用途**：儲存所有校正訂單及明細（一筆訂單可包含多筆校正項目）

#### 訂單資訊
| 欄位名稱 | 資料型別 | 說明 | 約束 |
|---------|---------|------|------|
| `id` | UUID | 主鍵 | PRIMARY KEY, 自動生成 |
| `order_number` | TEXT | 校正訂單編號 | NOT NULL（可重複） |
| `create_date` | TIMESTAMPTZ | 建立日期 | 自動填入 NOW() |
| `target_date` | TIMESTAMPTZ | 預定完成日期 | - |

#### 設備資訊
| 欄位名稱 | 資料型別 | 說明 | 約束 |
|---------|---------|------|------|
| `equipment_number` | TEXT | 設備案號 | NOT NULL |
| `equipment_name` | TEXT | 設備名稱 | NOT NULL |
| `customer_name` | TEXT | 客戶名稱 | NOT NULL |

#### 校正服務明細
| 欄位名稱 | 資料型別 | 說明 | 約束 |
|---------|---------|------|------|
| `product_id` | UUID | 關聯到產品表 | FOREIGN KEY → cali_products(id) |
| `product_name` | TEXT | 校正品項名稱 | NOT NULL |
| `product_spec` | TEXT | 產品規格 | - |
| `category` | TEXT | 類別 | - |
| `calibration_type` | TEXT | 校正類型 | NOT NULL, 限 Internal/External |

#### 數量與金額
| 欄位名稱 | 資料型別 | 說明 | 約束 |
|---------|---------|------|------|
| `quantity` | INTEGER | 數量 | NOT NULL, > 0 |
| `unit_price` | NUMERIC(10,2) | 單價 | NOT NULL, >= 0 |
| `discount_rate` | NUMERIC(5,2) | 折扣率（%） | 預設 100, 範圍 0-100 |
| `total_amount` | NUMERIC(10,2) | 總金額 | NOT NULL, >= 0 |

#### 狀態與其他
| 欄位名稱 | 資料型別 | 說明 | 約束 |
|---------|---------|------|------|
| `status` | TEXT | 狀態 | NOT NULL, 限 Pending/Calibrating/Completed |
| `is_archived` | BOOLEAN | 是否已歸檔 | 預設 FALSE |
| `resurrect_reason` | TEXT | 復活原因 | - |
| `notes` | TEXT | 備註 | - |
| `technicians` | TEXT[] | 負責技術人員陣列 | 預設 {} |

**索引**（高效查詢）：
- `order_number`：訂單編號查詢
- `create_date DESC`：按建立日期排序（最新在前）
- `status`：狀態篩選
- `customer_name`：客戶篩選
- `is_archived`：歸檔狀態篩選
- `target_date`：預定日期排序

---

### 5. **ali_settings** - 管理員設定表

**用途**：儲存系統管理員設定（如管理員密碼）

| 欄位名稱 | 資料型別 | 說明 | 約束 |
|---------|---------|------|------|
| `key` | TEXT | 設定鍵 | PRIMARY KEY |
| `value` | TEXT | 設定值 | NOT NULL |
| `updated_at` | TIMESTAMPTZ | 更新時間 | 自動更新 |

**預設資料**：
```sql
AdminPassword = '0000'
```

---

### 6. **cali_settings** - 使用者設定表

**用途**：儲存各技術人員的登入密碼

| 欄位名稱 | 資料型別 | 說明 | 約束 |
|---------|---------|------|------|
| `key` | TEXT | 設定鍵（格式：User:姓名） | PRIMARY KEY |
| `value` | TEXT | 密碼 | NOT NULL |
| `updated_at` | TIMESTAMPTZ | 更新時間 | 自動更新 |

**範例**：
```
key: "User:陳小明"
value: "1234"
```

---

## 📊 資料關聯圖

```
cali_customers ──┐
                 │
cali_technicians │
                 │
cali_products ───┼───> cali_orders (訂單明細)
                 │       ├── order_number (可重複，代表同一訂單)
                 │       ├── equipment_number (設備案號)
                 │       ├── customer_name (客戶)
                 │       ├── product_id → cali_products
                 │       ├── technicians[] (技術人員陣列)
                 │       ├── status (狀態)
                 │       └── total_amount (金額)
                 │
ali_settings ────┤ (管理員密碼)
                 │
cali_settings ───┘ (使用者密碼)
```

---

## 🔐 權限與安全性

### Row Level Security (RLS)
- **開發階段**：已停用 RLS，允許所有操作
- **生產環境建議**：啟用 RLS 並設定適當政策

### 角色權限
```sql
-- anon（匿名角色）和 authenticated（已驗證）都擁有完整權限
GRANT ALL ON ALL TABLES TO anon, authenticated;
```

⚠️ **注意**：由於您的系統使用自訂驗證（非 Supabase Auth），需確保 `anon` 角色擁有存取權限。

---

## 🚀 使用步驟

### 1️⃣ 在 Supabase 執行 SQL

1. 登入您的 Supabase Dashboard
2. 進入 **SQL Editor**
3. 複製 `database_schema.sql` 的完整內容
4. 點選 **Run** 執行

### 2️⃣ 驗證表格建立

執行以下查詢確認：
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE 'cali_%' OR table_name LIKE 'ali_%')
ORDER BY table_name;
```

應該會看到：
- ✅ ali_settings
- ✅ cali_customers
- ✅ cali_orders
- ✅ cali_products
- ✅ cali_settings
- ✅ cali_technicians

### 3️⃣ 檢查範例資料

```sql
-- 查看產品
SELECT * FROM cali_products;

-- 查看客戶
SELECT * FROM cali_customers;

-- 查看技術人員
SELECT * FROM cali_technicians;

-- 查看管理員密碼設定
SELECT * FROM ali_settings WHERE key = 'AdminPassword';
```

---

## 🔧 常見問題排除

### ❌ 權限錯誤：`permission denied for table`

**解決方案**：
```sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
```

### ❌ RLS 阻擋存取

**解決方案**：
```sql
ALTER TABLE cali_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE cali_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE cali_customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE cali_technicians DISABLE ROW LEVEL SECURITY;
```

### ❌ UUID 生成錯誤

**確認 UUID 擴展已啟用**：
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## 📝 範例 SQL 查詢

### 查詢訂單統計
```sql
-- 各狀態訂單數量
SELECT status, COUNT(DISTINCT order_number) as count
FROM cali_orders
WHERE is_archived = false
GROUP BY status;

-- 總收入
SELECT SUM(total_amount) as total_revenue
FROM cali_orders
WHERE status = 'Completed';
```

### 查詢客戶訂單
```sql
SELECT 
    order_number,
    customer_name,
    equipment_name,
    status,
    SUM(total_amount) as order_total
FROM cali_orders
WHERE customer_name = '台積電'
GROUP BY order_number, customer_name, equipment_name, status
ORDER BY create_date DESC;
```

### 查詢技術人員工作量
```sql
SELECT 
    unnest(technicians) as technician,
    COUNT(*) as order_count
FROM cali_orders
WHERE status != 'Completed'
GROUP BY technician
ORDER BY order_count DESC;
```

---

## 📌 重要提醒

1. **訂單編號 (order_number)** 可重複，代表同一筆訂單的多筆明細
2. **product_id** 可為 NULL（允許手動輸入未在庫存中的品項）
3. **technicians** 是文字陣列，可儲存多位負責人員
4. **預設管理員密碼**：`0000`（請在系統設定中修改）
5. **技術人員密碼**：需透過系統介面設定

---

## ✅ 完成檢查清單

- [ ] 所有表格已建立
- [ ] 索引已建立
- [ ] 範例資料已插入
- [ ] 權限已正確設定
- [ ] RLS 已依需求配置
- [ ] 前端 `.env.local` 已更新 Supabase URL 和 KEY
- [ ] 系統可正常登入
- [ ] 訂單可正常建立和查詢

---

**檔案生成時間**：2026-01-12  
**系統版本**：CHUYI Calibration System v1.0  
**技術支援**：制宜電測
