"""
自動修補 smart_excel_import.py 的 standardize_dataframe 函數
"""

import re

# 讀取原始檔案
with open('smart_excel_import.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 新版函數
new_function = '''    def standardize_dataframe(self, df: pd.DataFrame, detected_cols: dict, excel_path: Path) -> pd.DataFrame:
        """將 DataFrame 標準化為系統格式 - 針對制宜電測報價單格式"""
        df = df.dropna(how='all')
        
        # === B9 = 客戶名稱 ===
        customer_name = "未知客戶"
        try:
            if len(df) > 8 and len(df.columns) > 1:
                b9_value = df.iloc[8, 1]
                if pd.notna(b9_value) and str(b9_value).strip():
                    customer_name = str(b9_value).strip()
                    print(f"  ✓ B9 客戶: {customer_name}")
        except: pass
        
        # === F9 = 報價單號 ===
        order_number = "UNKNOWN"
        try:
            if len(df) > 8 and len(df.columns) > 5:
                f9_value = df.iloc[8, 5]
                if pd.notna(f9_value):
                    match = re.search(r'[A-Z]-?\\d{4,}', str(f9_value))
                    if match:
                        order_number = match.group(0)
                        print(f"  ✓ F9 報價單號: {order_number}")
        except: pass
        
        if order_number == "UNKNOWN":
            match = re.search(r'[A-Z]-?\\d{4,}', excel_path.stem)
            order_number = match.group(0) if match else excel_path.stem
            print(f"  ✓ 檔名報價單號: {order_number}")
        
        # === B13 = 設備名稱 ===
        equipment_name = "未知設備"
        try:
            if len(df) > 12 and len(df.columns) > 1:
                b13_value = df.iloc[12, 1]
                if pd.notna(b13_value) and str(b13_value).strip():
                    equipment_name = str(b13_value).strip()
                    print(f"  ✓ B13 設備: {equipment_name}")
        except: pass
        
        # === 從第14列(index 13)開始提取明細 ===
        standardized_data = []
        print(f"\\n  📋 掃描明細（第14列起）...")
        
        for idx in range(13, len(df)):
            try:
                row = df.iloc[idx]
                if len(row) <= 1: continue
                
                # B欄 = 校正項目
                product_name = row.iloc[1]
                if pd.isna(product_name) or not str(product_name).strip(): continue
                
                product_str = str(product_name).strip()
                
                # 跳過標題
                if any(k in product_str for k in ['項目','品名','數量','單價','合計','備註','項次','說明']):
                    continue
                if len(product_str) < 2 or product_str.isdigit(): continue
                
                # D欄 = 數量
                qty_ok, qty = False, 1
                if len(row) > 3 and pd.notna(row.iloc[3]):
                    try:
                        qty = int(float(row.iloc[3]))
                        qty_ok = True
                    except: pass
                
                # E欄 = 單價
                price_ok, price = False, 0
                if len(row) > 4 and pd.notna(row.iloc[4]):
                    try:
                        price = float(row.iloc[4])
                        if price > 0: price_ok = True
                    except: pass
                
                # 必須同時有數量和價格
                if not (qty_ok and price_ok): continue
                
                # C欄 = 設備案號（可選）
                eq_no = ""
                if len(row) > 2 and pd.notna(row.iloc[2]):
                    eq_no = str(row.iloc[2]).strip()
                if not eq_no:
                    eq_no = f"EQ-{order_number}"
                
                standardized_data.append({
                    '報價單號': order_number,
                    '客戶名稱': customer_name,
                    '產品名稱': product_str,
                    '數量': qty,
                    '單價': price,
                    '規格': '',
                    '報價日期': '',
                    '項目編號': '',
                    '設備名稱': equipment_name,
                    '設備案號': eq_no,
                    '校正類型': '內校',
                    '備註': f'從 {excel_path.name} 自動匯入'
                })
            except: continue
        
        result_df = pd.DataFrame(standardized_data)
        print(f"  ✓ 提取 {len(result_df)} 筆明細")
        
        if len(result_df) > 0:
            print(f"\\n  📋 明細預覽:")
            for i, r in result_df.head(5).iterrows():
                print(f"     {i+1}. {r['產品名稱']} | {r['數量']}個 | ${r['單價']:,.0f}")
        
        return result_df

'''

# 找到函數的開始和結束行
start_line = None
end_line = None
indent_level = None

for i, line in enumerate(lines):
    if '    def standardize_dataframe(' in line:
        start_line = i
        indent_level = len(line) - len(line.lstrip())
        continue
    
    if start_line is not None and i > start_line:
        # 檢查是否到達下一個同級別的定義
        if line.strip() and not line.strip().startswith('#'):
            current_indent = len(line) - len(line.lstrip())
            if current_indent <= indent_level and (line.strip().startswith('def ') or line.strip().startswith('class ')):
                end_line = i
                break

if start_line is None:
    print("❌ 找不到 standardize_dataframe 函數")
else:
    # 替換函數
    new_lines = lines[:start_line] + [new_function + '\n'] + lines[end_line:]
    
    # 寫入新檔案
    with open('smart_excel_import.py', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print(f"✅ 已更新函數")
    print(f"   原函數: 第 {start_line+1} 到 {end_line} 行")
    print(f"   新函數: {new_function.count(chr(10))} 行")
