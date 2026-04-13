"""
CSV 報價單匯入工具
Import Quotes from CSV to Supabase
"""

import os
import pandas as pd
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
import re

# 載入環境變數
load_dotenv('.env.local')

# 檢查 Supabase 套件
try:
    from supabase import create_client, Client
    HAS_SUPABASE = True
except ImportError:
    HAS_SUPABASE = False
    print("⚠️  請安裝 supabase: pip install supabase")

def convert_tw_date(tw_date_str: str) -> str:
    """
    轉換民國日期為西元日期
    例: 114年1月19日 -> 2025-01-19
    """
    if not tw_date_str or pd.isna(tw_date_str):
        return datetime.now().strftime('%Y-%m-%d')
    
    match = re.search(r'(\d{2,3})[年/-](\d{1,2})[月/-](\d{1,2})', str(tw_date_str))
    if match:
        tw_year, month, day = match.groups()
        ad_year = int(tw_year) + 1911
        return f"{ad_year}-{int(month):02d}-{int(day):02d}"
    return datetime.now().strftime('%Y-%m-%d')

def import_csv_to_supabase(csv_file: Path, supabase: Client):
    """
    從 CSV 匯入報價單到 Supabase
    
    Args:
        csv_file: CSV 檔案路徑
        supabase: Supabase 客戶端
    """
    print(f"\n📄 處理: {csv_file.name}")
    
    # 讀取 CSV
    try:
        # 嘗試 UTF-8
        df = pd.read_csv(csv_file, encoding='utf-8-sig')
    except UnicodeDecodeError:
        # 回退到 Big5
        df = pd.read_csv(csv_file, encoding='big5')
    
    print(f"  ✓ 讀取 {len(df)} 筆資料")
    
    # 驗證必要欄位
    required_columns = ['報價單號', '客戶名稱', '產品名稱', '數量', '單價']
    missing_columns = [col for col in required_columns if col not in df.columns]
    
    if missing_columns:
        print(f"  ❌ 缺少必要欄位: {', '.join(missing_columns)}")
        print(f"  ℹ️  目前欄位: {', '.join(df.columns)}")
        return False
    
    # 按報價單號分組
    grouped = df.groupby('報價單號')
    
    for order_number, group in grouped:
        print(f"\n  處理訂單: {order_number}")
        
        # 取得客戶資訊（使用第一筆的資料）
        first_row = group.iloc[0]
        customer_name = str(first_row['客戶名稱']).strip()
        
        # 設備資訊
        equipment_name = str(first_row.get('設備名稱', first_row['產品名稱'])).strip()
        equipment_number = f"EQ-{order_number}"
        
        # 報價日期
        quote_date = first_row.get('報價日期', '')
        target_date = convert_tw_date(quote_date)
        
        print(f"    客戶: {customer_name}")
        print(f"    設備: {equipment_name}")
        print(f"    預計完成日: {target_date}")
        
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
            category = str(row.get('分類', '一般')).strip()
            
            # 校正類型
            calibration_type_map = {
                '內校': 'Internal',
                '委外': 'External',
                'Internal': 'Internal',
                'External': 'External'
            }
            calibration_type_str = str(row.get('校正類型', '內校')).strip()
            calibration_type = calibration_type_map.get(calibration_type_str, 'Internal')
            
            quantity = int(row['數量'])
            unit_price = float(row['單價'])
            total_amount = quantity * unit_price
            
            # 嘗試從庫存找產品
            product_id = None
            try:
                result = supabase.table('cali_products').select('id').eq('name', product_name).execute()
                if result.data:
                    product_id = result.data[0]['id']
                else:
                    # 自動新增到庫存
                    print(f"      ➕ 新增產品: {product_name}")
                    new_product = supabase.table('cali_products').insert({
                        'name': product_name,
                        'specification': specification,
                        'category': category,
                        'standard_price': unit_price
                    }).execute()
                    product_id = new_product.data[0]['id']
            except Exception as e:
                print(f"      ⚠️  產品處理警告: {e}")
            
            # 備註
            notes = str(row.get('備註', '')).strip()
            if not notes or notes == 'nan':
                notes = f"從 CSV 匯入 ({csv_file.name})"
            
            orders_to_create.append({
                'order_number': str(order_number),
                'customer_name': customer_name,
                'equipment_number': equipment_number,
                'equipment_name': equipment_name,
                'product_id': product_id,
                'product_name': product_name,
                'product_spec': specification,
                'category': category,
                'calibration_type': calibration_type,
                'quantity': quantity,
                'unit_price': unit_price,
                'discount_rate': 100,
                'total_amount': total_amount,
                'status': 'Pending',
                'target_date': target_date,
                'notes': notes
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
    print("📊 CSV 報價單匯入工具 - Supabase")
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
        print("請確認 .env.local 檔案包含:")
        print("  VITE_SUPABASE_URL=...")
        print("  VITE_SUPABASE_ANON_KEY=...")
        return
    
    # 連線 Supabase
    try:
        supabase = create_client(supabase_url, supabase_key)
        print("\n✅ Supabase 連線成功")
    except Exception as e:
        print(f"\n❌ Supabase 連線失敗: {e}")
        return
    
    # 掃描 CSV 檔案
    import_folder = Path("import_templates")
    csv_files = list(import_folder.glob("quote_*.csv"))
    
    # 排除模板檔案
    csv_files = [f for f in csv_files if 'template' not in f.name.lower()]
    
    if not csv_files:
        print(f"\n⚠️  {import_folder} 資料夾內沒有待匯入的 CSV 檔案")
        print("請建立檔名為 quote_*.csv 的檔案 (例: quote_F26001.csv)")
        print(f"參考範本: {import_folder}/quote_import_template.csv")
        return
    
    print(f"\n找到 {len(csv_files)} 個待匯入檔案\n")
    
    # 列出檔案
    print("將匯入以下檔案:")
    for f in csv_files:
        print(f"  - {f.name}")
    
    confirm = input("\n確定要匯入? (y/N): ").strip().lower()
    if confirm != 'y':
        print("已取消")
        return
    
    # 批次匯入
    success_count = 0
    for csv_file in csv_files:
        try:
            if import_csv_to_supabase(csv_file, supabase):
                success_count += 1
        except Exception as e:
            print(f"  ❌ 處理失敗: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "="*60)
    print(f"✅ 匯入完成: {success_count}/{len(csv_files)} 成功")
    print("="*60)
    
    # 可選：移動已處理的檔案
    if success_count > 0:
        archive = input("\n是否將已匯入的檔案移到 import_templates/archived? (y/N): ").strip().lower()
        if archive == 'y':
            archive_folder = import_folder / "archived"
            archive_folder.mkdir(exist_ok=True)
            
            for csv_file in csv_files:
                csv_file.rename(archive_folder / csv_file.name)
            
            print(f"✓ 已移動到: {archive_folder}")

if __name__ == "__main__":
    main()
