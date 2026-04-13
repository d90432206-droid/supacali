"""
智能 Excel 報價單匯入工具
Smart Excel Quote Importer - 自動識別欄位並匯入

使用方式:
1. 將您的報價單 Excel 放入 excel_quotes/ 資料夾
2. 執行: python smart_excel_import.py
3. 系統自動識別欄位並匯入

支援格式:
- .xlsx (Excel 2007+)
- .xls (Excel 舊版)
- 多工作表 Excel（會嘗試所有工作表）
"""

import os
import pandas as pd
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
import re
from difflib import SequenceMatcher

# 載入環境變數
load_dotenv('.env.local')

# Supabase
try:
    from supabase import create_client, Client
    HAS_SUPABASE = True
except ImportError:
    HAS_SUPABASE = False
    print("⚠️  請安裝 supabase: pip install supabase")


class SmartExcelParser:
    """智能 Excel 解析器 - 自動識別報價單欄位"""
    
    def __init__(self):
        # 欄位對應字典（關鍵字 -> 標準欄位名）
        self.field_mappings = {
            # 報價單號
            'order_number': ['報價單號', '單號', '工單號', '編號', 'order', 'quote', 'no'],
            
            # 客戶
            'customer': ['客戶', '公司', '客戶名稱', '廠商', 'customer', 'client', 'company'],
            
            # 日期
            'date': ['日期', '報價日期', 'date', '時間'],
            
            # 產品名稱
            'product': ['品名', '產品', '項目', '名稱', 'product', 'item', 'name', '品項'],
            
            # 規格
            'spec': ['規格', '說明', '備註', 'spec', 'specification', 'description'],
            
            # 數量
            'quantity': ['數量', 'qty', 'quantity', '件數'],
            
            # 單價
            'price': ['單價', '價格', '金額', 'price', 'unit', '費用'],
            
            # 總價
            'total': ['總價', '小計', '合計', 'total', 'amount', '總計'],
            
            # 項目編號
            'item_code': ['項目', '序號', '項次', 'code', '編號']
        }
    
    def smart_match_column(self, column_name: str, field_type: str) -> bool:
        """智能匹配欄位名稱"""
        if not column_name:
            return False
        
        column_lower = str(column_name).lower().strip()
        keywords = self.field_mappings.get(field_type, [])
        
        for keyword in keywords:
            if keyword.lower() in column_lower:
                return True
        return False
    
    def detect_columns(self, df: pd.DataFrame) -> dict:
        """自動檢測 DataFrame 中的欄位"""
        detected = {}
        
        for col in df.columns:
            for field_type, keywords in self.field_mappings.items():
                if self.smart_match_column(col, field_type):
                    detected[field_type] = col
                    break
        
        return detected
    
    def extract_order_number(self, df: pd.DataFrame, detected_cols: dict) -> str:
        """提取報價單號"""
        # 方式 1: 從欄位中找
        if 'order_number' in detected_cols:
            value = df[detected_cols['order_number']].iloc[0]
            if pd.notna(value):
                return str(value).strip()
        
        # 方式 2: 掃描整個 DataFrame 尋找類似報價單號的模式
        pattern = r'[A-Z]-?\d{4,}'
        for col in df.columns:
            for value in df[col].head(10):
                if pd.notna(value):
                    match = re.search(pattern, str(value))
                    if match:
                        return match.group(0)
        
        # 方式 3: 使用檔名
        return "UNKNOWN"
    
    def extract_customer(self, df: pd.DataFrame, detected_cols: dict) -> str:
        """提取客戶名稱"""
        if 'customer' in detected_cols:
            value = df[detected_cols['customer']].iloc[0]
            if pd.notna(value):
                return str(value).strip()
        
        # 掃描前幾列尋找包含"客戶"的資訊
        for col in df.columns:
            col_str = str(col).lower()
            if '客戶' in col_str or 'customer' in col_str:
                value = df[col].iloc[0]
                if pd.notna(value):
                    return str(value).strip()
        
        return "未知客戶"
    
    def parse_excel(self, excel_path: Path) -> pd.DataFrame:
        """解析 Excel 檔案"""
        print(f"\n📄 解析: {excel_path.name}")
        
        # 讀取 Excel (嘗試所有工作表)
        try:
            excel_file = pd.ExcelFile(excel_path)
            print(f"  找到 {len(excel_file.sheet_names)} 個工作表")
            
            # 嘗試每個工作表
            for sheet_name in excel_file.sheet_names:
                print(f"  檢查工作表: {sheet_name}")
                df = pd.read_excel(excel_path, sheet_name=sheet_name)
                
                # 跳過空白或太小的工作表
                if df.empty or len(df) < 2:
                    continue
                
                # 檢測欄位
                detected_cols = self.detect_columns(df)
                
                # 至少要有產品名稱和數量
                if 'product' in detected_cols or 'quantity' in detected_cols:
                    print(f"  ✓ 使用工作表: {sheet_name}")
                    return self.standardize_dataframe(df, detected_cols, excel_path)
            
            # 如果沒找到合適的工作表，使用第一個
            print(f"  ⚠️  未找到明確的報價單表格，使用第一個工作表")
            df = pd.read_excel(excel_path, sheet_name=0)
            detected_cols = self.detect_columns(df)
            return self.standardize_dataframe(df, detected_cols, excel_path)
            
        except Exception as e:
            print(f"  ❌ 解析失敗: {e}")
            raise
    
    def standardize_dataframe(self, df: pd.DataFrame, detected_cols: dict, excel_path: Path) -> pd.DataFrame:
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
                    match = re.search(r'[A-Z]-?\d{4,}', str(f9_value))
                    if match:
                        order_number = match.group(0)
                        print(f"  ✓ F9 報價單號: {order_number}")
        except: pass
        
        if order_number == "UNKNOWN":
            match = re.search(r'[A-Z]-?\d{4,}', excel_path.stem)
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
        print(f"\n  📋 掃描明細（第14列起）...")
        
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
            print(f"\n  📋 明細預覽:")
            for i, r in result_df.head(5).iterrows():
                print(f"     {i+1}. {r['產品名稱']} | {r['數量']}個 | ${r['單價']:,.0f}")
        
        return result_df


def similarity(a: str, b: str) -> float:
    """計算兩個字串的相似度（0-1）"""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def find_similar_product(target_name: str, products: list) -> dict:
    """
    從產品列表中找出最相似的產品
    
    Args:
        target_name: 要匹配的產品名稱
        products: 產品列表（從 Supabase 查詢結果）
    
    Returns:
        {'product': dict, 'similarity': float} 或 None
    """
    if not products:
        return None
    
    best_match = None
    best_score = 0.0
    
    for product in products:
        product_name = product.get('name', '')
        if not product_name:
            continue
        
        score = similarity(target_name, product_name)
        
        if score > best_score:
            best_score = score
            best_match = product
    
    if best_match and best_score > 0.5:  # 至少 50% 相似才返回
        return {
            'product': best_match,
            'similarity': best_score
        }
    
    return None


def convert_tw_date(tw_date_str: str) -> str:
    """轉換民國日期為西元日期"""
    if not tw_date_str or pd.isna(tw_date_str):
        return datetime.now().strftime('%Y-%m-%d')
    
    match = re.search(r'(\d{2,3})[年/-](\d{1,2})[月/-](\d{1,2})', str(tw_date_str))
    if match:
        tw_year, month, day = match.groups()
        ad_year = int(tw_year) + 1911
        return f"{ad_year}-{int(month):02d}-{int(day):02d}"
    return datetime.now().strftime('%Y-%m-%d')


def import_to_supabase(df: pd.DataFrame, supabase: Client) -> bool:
    """匯入標準化的 DataFrame 到 Supabase"""
    if df.empty:
        print("  ⚠️  無資料可匯入")
        return False
    
    # 按報價單號分組
    grouped = df.groupby('報價單號')
    
    for order_number, group in grouped:
        print(f"\n  處理訂單: {order_number}")
        
        first_row = group.iloc[0]
        customer_name = str(first_row['客戶名稱']).strip()
        equipment_name = str(first_row['設備名稱']).strip()
        
        # 使用 Excel 提取的設備案號，如果沒有則使用報價單號
        equipment_number = str(first_row.get('設備案號', '')).strip()
        if not equipment_number:
            equipment_number = f"EQ-{order_number}"
        
        target_date = convert_tw_date(first_row.get('報價日期', ''))
        
        print(f"    設備: {equipment_name} | 案號: {equipment_number}")
        
        # 1. 檢查並新增客戶
        try:
            result = supabase.table('cali_customers').select('*').eq('name', customer_name).execute()
            if not result.data:
                print(f"    ➕ 新增客戶: {customer_name}")
                supabase.table('cali_customers').insert({'name': customer_name}).execute()
        except Exception as e:
            print(f"    ⚠️  客戶處理警告: {e}")
        
        # 2. 建立訂單明細
        orders_to_create = []
        
        for idx, row in group.iterrows():
            product_name = str(row['產品名稱']).strip()
            specification = str(row.get('規格', '')).strip()
            quantity = int(row['數量'])
            unit_price = float(row['單價'])
            total_amount = quantity * unit_price
            
            # 智能產品匹配：先從庫存找完全匹配，再找模糊匹配
            product_id = None
            try:
                # 1. 精確匹配
                result = supabase.table('cali_products').select('*').eq('name', product_name).execute()
                if result.data:
                    product_id = result.data[0]['id']
                    print(f"      ✓ 使用現有產品: {product_name}")
                else:
                    # 2. 模糊匹配 - 從所有產品中找最相似的
                    all_products = supabase.table('cali_products').select('*').execute()
                    
                    if all_products.data:
                        best_match = find_similar_product(product_name, all_products.data)
                        
                        if best_match:
                            similarity_score = best_match['similarity']
                            matched_product = best_match['product']
                            
                            # 相似度超過 70% 顯示建議
                            if similarity_score >= 0.7:
                                print(f"\n      🔍 找到相似產品:")
                                print(f"         新產品: {product_name}")
                                print(f"         相似度: {similarity_score*100:.0f}%")
                                print(f"         現有: {matched_product['name']}")
                                print(f"         規格: {matched_product.get('specification', 'N/A')}")
                                print(f"         價格: ${matched_product.get('standard_price', 0):,.0f}")
                                
                                # 相似度超過 85% 自動使用
                                if similarity_score >= 0.85:
                                    product_id = matched_product['id']
                                    product_name = matched_product['name']  # 使用現有名稱
                                    specification = matched_product.get('specification', specification)
                                    unit_price = matched_product.get('standard_price', unit_price)
                                    print(f"         ✓ 自動使用現有產品 (相似度≥85%)")
                                else:
                                    # 70-85% 詢問用戶
                                    use_existing = input(f"         使用現有產品? (y/N): ").strip().lower()
                                    if use_existing == 'y':
                                        product_id = matched_product['id']
                                        product_name = matched_product['name']
                                        specification = matched_product.get('specification', specification)
                                        unit_price = matched_product.get('standard_price', unit_price)
                                        print(f"         ✓ 使用現有產品")
                                    else:
                                        print(f"         ➕ 建立新產品: {product_name}")
                                        new_product = supabase.table('cali_products').insert({
                                            'name': product_name,
                                            'specification': specification,
                                            'category': '一般',
                                            'standard_price': unit_price
                                        }).execute()
                                        product_id = new_product.data[0]['id']
                            else:
                                # 相似度低於 70%，直接建立新產品
                                print(f"      ➕ 新增產品: {product_name}")
                                new_product = supabase.table('cali_products').insert({
                                    'name': product_name,
                                    'specification': specification,
                                    'category': '一般',
                                    'standard_price': unit_price
                                }).execute()
                                product_id = new_product.data[0]['id']
                        else:
                            # 沒有任何匹配，建立新產品
                            print(f"      ➕ 新增產品: {product_name}")
                            new_product = supabase.table('cali_products').insert({
                                'name': product_name,
                                'specification': specification,
                                'category': '一般',
                                'standard_price': unit_price
                            }).execute()
                            product_id = new_product.data[0]['id']
                    else:
                        # 資料庫中沒有任何產品
                        print(f"      ➕ 新增產品: {product_name}")
                        new_product = supabase.table('cali_products').insert({
                            'name': product_name,
                            'specification': specification,
                            'category': '一般',
                            'standard_price': unit_price
                        }).execute()
                        product_id = new_product.data[0]['id']
            except Exception as e:
                print(f"      ⚠️  產品處理警告: {e}")
            
            orders_to_create.append({
                'order_number': str(order_number),
                'customer_name': customer_name,
                'equipment_number': equipment_number,
                'equipment_name': equipment_name,
                'product_id': product_id,
                'product_name': product_name,
                'product_spec': specification,
                'category': '一般',
                'calibration_type': 'Internal',
                'quantity': quantity,
                'unit_price': unit_price,
                'discount_rate': 100,
                'total_amount': total_amount,
                'status': 'Pending',
                'target_date': target_date,
                'notes': row.get('備註', '')
            })
        
        # 3. 批次寫入
        try:
            result = supabase.table('cali_orders').insert(orders_to_create).execute()
            print(f"    ✅ 成功匯入 {len(orders_to_create)} 筆明細")
        except Exception as e:
            print(f"    ❌ 匯入失敗: {e}")
            return False
    
    return True


def main():
    """主程式"""
    print("="*60)
    print("🤖 智能 Excel 報價單匯入工具")
    print("="*60)
    
    if not HAS_SUPABASE:
        print("\n❌ 缺少 supabase 套件")
        print("請執行: pip install supabase")
        return
    
    # 檢查環境變數
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("\n❌ 找不到 Supabase 設定")
        return
    
    # 連線 Supabase
    try:
        supabase = create_client(supabase_url, supabase_key)
        print("\n✅ Supabase 連線成功")
    except Exception as e:
        print(f"\n❌ Supabase 連線失敗: {e}")
        return
    
    # 掃描 Excel 檔案
    excel_folder = Path("excel_quotes")
    excel_folder.mkdir(exist_ok=True)
    
    excel_files = list(excel_folder.glob("*.xlsx")) + list(excel_folder.glob("*.xls"))
    
    if not excel_files:
        print(f"\n📁 請將 Excel 報價單放入: {excel_folder.absolute()}")
        print("支援格式: .xlsx, .xls")
        return
    
    print(f"\n找到 {len(excel_files)} 個 Excel 檔案\n")
    
    # 列出檔案
    for f in excel_files:
        print(f"  - {f.name}")
    
    confirm = input("\n開始處理? (y/N): ").strip().lower()
    if confirm != 'y':
        print("已取消")
        return
    
    # 初始化解析器
    parser = SmartExcelParser()
    
    # 處理每個檔案
    success_count = 0
    for excel_file in excel_files:
        try:
            # 解析 Excel
            df = parser.parse_excel(excel_file)
            
            # 匯入到 Supabase
            if import_to_supabase(df, supabase):
                success_count += 1
                
        except Exception as e:
            print(f"  ❌ 處理失敗: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "="*60)
    print(f"✅ 處理完成: {success_count}/{len(excel_files)} 成功")
    print("="*60)


if __name__ == "__main__":
    main()
