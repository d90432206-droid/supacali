# 📋 PDF 報價單自動解析工具

## 🎯 功能說明

這個工具可以自動從 PDF 報價單中提取以下資訊：

- ✅ **報價單號碼** (例: P-26001)
- ✅ **客戶名稱** (例: 財團法人工業技術研究院)
- ✅ **報價日期** (例: 114年1月19日)
- ✅ **明細項目** (A, B, C...)
  - 產品名稱 (例: 白金電阻溫度計)
  - 規格 (例: 校正點20,30,40,50,60℃)
  - 數量
  - 單價
  - 總價
- ✅ **總金額**

## 📦 安裝步驟

### 步驟 1: 安裝 Python 套件

```powershell
# 安裝必要套件
pip install pdfplumber pandas openpyxl

# (可選) 安裝 OCR 功能
pip install pytesseract pillow
```

### 步驟 2: 安裝 Tesseract OCR (Windows)

**僅在 PDF 文字提取失敗時需要**

1. 下載 Tesseract OCR:
   - 官網: https://github.com/UB-Mannheim/tesseract/wiki
   - 下載: `tesseract-ocr-w64-setup-5.x.x.exe`

2. 安裝到預設路徑:
   ```
   C:\Program Files\Tesseract-OCR\
   ```

3. (可選) 下載繁體中文語言包:
   - 下載 `chi_tra.traineddata`
   - 放到: `C:\Program Files\Tesseract-OCR\tessdata\`

## 🚀 使用方法

### 方法 1: 批次處理多個 PDF

```powershell
# 1. 建立 PDF 資料夾
mkdir quotes_pdf

# 2. 將報價單 PDF 放入 quotes_pdf 資料夾

# 3. 執行解析
python pdf_quote_parser.py
```

**輸出結果:**
- `quotes_parsed/報價單名稱.csv` - Excel 可開啟的格式
- `quotes_parsed/報價單名稱.json` - 結構化資料

### 方法 2: 程式碼整合

```python
from pdf_quote_parser import PDFQuoteParser

# 初始化解析器
parser = PDFQuoteParser()

# 解析單一 PDF
quote_info = parser.parse_pdf("報價單.pdf")

# 查看結果
print(f"客戶: {quote_info.customer_name}")
print(f"總金額: {quote_info.total_amount}")

for item in quote_info.items:
    print(f"{item.product_name} - ${item.total_price}")

# 匯出為 CSV
parser.export_to_csv(quote_info, "output.csv")
```

## 📊 輸出格式範例

### CSV 格式
```
報價單號,客戶名稱,報價日期,項目編號,產品名稱,規格,數量,單價,總價,類別
P-26001,財團法人工業技術研究院,114年1月19日,A,白金電阻溫度計,校正點20-60℃,28,5000,140000,一般
P-26001,財團法人工業技術研究院,114年1月19日,B,白金電阻溫度計,校正點0-80℃,4,6500,26000,一般
```

### JSON 格式
```json
{
  "quote_number": "P-26001",
  "customer_name": "財團法人工業技術研究院",
  "quote_date": "114年1月19日",
  "total_amount": 173000,
  "items": [
    {
      "item_code": "A",
      "product_name": "白金電阻溫度計",
      "specification": "校正點20,30,40,50,60℃",
      "quantity": 28,
      "unit_price": 5000,
      "total_price": 140000
    }
  ]
}
```

## 🔧 進階設定

### 自訂欄位匹配規則

編輯 `pdf_quote_parser.py` 中的 `patterns` 字典:

```python
self.patterns = {
    'quote_number': r'報價單號[:：\s]*([A-Z]+-\d+)',
    'customer': r'客戶[:：\s]*([^\n]+)',
    # 新增您的自訂規則...
}
```

### 處理特殊格式 PDF

如果 PDF 掃描品質不佳，可以:

1. **調整 OCR 設定**
   ```python
   parser = PDFQuoteParser(tesseract_path="...")
   ```

2. **手動調整表格解析邏輯**
   - 修改 `_parse_table()` 方法
   - 根據您的報價單格式調整欄位索引

## 🔄 與系統整合

### 直接匯入 Supabase

建立整合腳本 `import_parsed_quotes.py`:

```python
import pandas as pd
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

# 初始化 Supabase
supabase = create_client(
    os.getenv('VITE_SUPABASE_URL'),
    os.getenv('VITE_SUPABASE_ANON_KEY')
)

# 讀取解析後的 CSV
df = pd.read_csv('quotes_parsed/報價單.csv')

# 批次建立訂單
for _, row in df.iterrows():
    order_data = {
        'order_number': row['報價單號'],
        'customer_name': row['客戶名稱'],
        'product_name': row['產品名稱'],
        'quantity': int(row['數量']),
        'unit_price': float(row['單價']),
        # ... 其他欄位
    }
    
    supabase.table('cali_orders').insert(order_data).execute()

print("✅ 匯入完成!")
```

## ❓ 常見問題

### Q1: 提取的欄位不準確怎麼辦?

**方案 1:** 檢查 PDF 文字層
- 有些 PDF 是掃描圖片，需要 OCR
- 執行: `python -c "import pdfplumber; print(pdfplumber.open('報價單.pdf').pages[0].extract_text())"`

**方案 2:** 調整正則表達式
- 根據實際格式修改 `patterns` 字典

**方案 3:** 使用 OCR
- 安裝 Tesseract 並啟用 OCR 功能

### Q2: 如何處理多頁 PDF?

修改 `parse_pdf()` 方法:

```python
for page in pdf.pages:
    text += page.extract_text()
    tables.extend(page.extract_tables())
```

### Q3: 可以處理 Excel 報價單嗎?

可以! 建立簡化版本:

```python
import pandas as pd

df = pd.read_excel('報價單.xlsx')
# 根據欄位名稱直接對應即可
```

## 📞 技術支援

如遇到問題,請提供:
1. PDF 報價單樣本
2. 錯誤訊息截圖
3. 執行 `python pdf_quote_parser.py` 的完整輸出

## 🎉 下一步

完成 PDF 解析後,可以:
1. 建立 Web 上傳介面
2. 整合到現有 OrderForm 組件
3. 設定自動排程處理
4. 加入 AI 智能欄位識別

---

**製作:** 制宜電測校正系統  
**最後更新:** 2026-01-12
