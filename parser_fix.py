"""
修補檔：用於更新 standardize_dataframe 函數
根據用戶實際格式：
- B9 = 客戶
- F9 = 報價單號
- B13 = 設備名稱
- B14+ = 校正項目，D欄=數量，E欄=單價
"""

def standardize_dataframe_NEW(self, df, detected_cols, excel_path):
    """將 DataFrame 標準化為系統格式 - 針對制宜電測報價單格式"""
    from pathlib import Path
    import pandas as pd
    import re
    
    df = df.dropna(how='all')
    
    # === 提取固定位置資訊 ===
    
    # B9 = 客戶
    customer_name = "未知客戶"
    try:
        if len(df) > 8 and len(df.columns) > 1:
            b9 = df.iloc[8, 1]
            if pd.notna(b9) and str(b9).strip():
                customer_name = str(b9).strip()
                print(f"  ✓ B9 客戶: {customer_name}")
    except: pass
    
    # F9 ≈ 報價單號
    order_number = "UNKNOWN"
    try:
       if len(df) > 8 and len(df.columns) > 5:
            f9 = df.iloc[8, 5]
            if pd.notna(f9):
                match = re.search(r'[A-Z]-?\d{4,}', str(f9))
                if match:
                    order_number = match.group(0)
                    print(f"  ✓ F9 報價單號: {order_number}")
    except: pass
    
    # 從檔名 fallback
    if order_number == "UNKNOWN":
        match = re.search(r'[A-Z]-?\d{4,}', excel_path.stem)
        order_number = match.group(0) if match else excel_path.stem
        print(f"  ✓ 檔名報價單號: {order_number}")
    
    # B13 = 設備名稱
    equipment_name = "未知設備"
    try:
        if len(df) > 12 and len(df.columns) > 1:
            b13 = df.iloc[12, 1]
            if pd.notna(b13) and str(b13).strip():
                equipment_name = str(b13).strip()
                print(f"  ✓ B13 設備: {equipment_name}")
    except: pass
    
    # === 提取明細（從第14列，即index 13開始） ===
    items = []
    print(f"\n  掃描明細（第14列起）...")
    
    for idx in range(13, len(df)):
        try:
            row = df.iloc[idx]
            if len(row) <= 1: continue
            
            # B欄 = 校正項目
            product = row.iloc[1]
            if pd.isna(product) or not str(product).strip(): continue
            
            product_str = str(product).strip()
            
            # 跳過標題
            if any(k in product_str for k in ['項目','品名','數量','單價','合計','備註']):
                continue
            if len(product_str) < 2 or product_str.isdigit(): continue
            
            # D欄 = 數量
            qty_ok = False
            qty = 1
            if len(row) > 3 and pd.notna(row.iloc[3]):
                try:
                    qty = int(float(row.iloc[3]))
                    qty_ok = True
                except: pass
            
            # E欄 = 單價
            price_ok = False
            price = 0
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
            
            items.append({
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
    
    result = pd.DataFrame(items)
    print(f"  ✓ 提取 {len(result)} 筆明細\n")
    
    if len(result) > 0:
        print("  📋 明細預覽:")
        for i, r in result.head(5).iterrows():
            print(f"     {i+1}. {r['產品名稱']} | {r['數量']}個 | ${r['單價']:,.0f}")
    
    return result


# 使用說明:
# 1. 打開 smart_excel_import.py
# 2. 找到 def standardize_dataframe 函數（約168行）
# 3. 將整個函數替換為上面的 standardize_dataframe_NEW
# 4. 移除函數名稱中的 _NEW
