"""
將解析後的報價單匯入 Supabase
Import Parsed Quotes to Supabase Database
"""

import os
import json
import pandas as pd
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

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
    import re
    
    match = re.search(r'(\d{2,3})[年/-](\d{1,2})[月/-](\d{1,2})', tw_date_str)
    if match:
        tw_year, month, day = match.groups()
        ad_year = int(tw_year) + 1911
        return f"{ad_year}-{int(month):02d}-{int(day):02d}"
    return datetime.now().strftime('%Y-%m-%d')

def import_quote_to_supabase(json_file: Path, supabase: Client, order_prefix: str = "CAL"):
    """
    將 JSON 格式的報價單匯入 Supabase
    
    Args:
        json_file: JSON 檔案路徑
        supabase: Supabase 客戶端
        order_prefix: 訂單編號前綴 (預設: CAL)
    """
    print(f"\n📄 處理: {json_file.name}")
    
    # 讀取 JSON
    with open(json_file, 'r', encoding='utf-8') as f:
        quote_data = json.load(f)
    
    # 直接使用報價單號作為校正工單號
    # P-26001 -> P-26001 (不添加前綴)
    original_quote_no = quote_data['quote_number']
    order_number = original_quote_no  # 直接使用 PDF 報價單編號
    
    # 轉換日期
    target_date = convert_tw_date(quote_data.get('quote_date', ''))
    
    # 客戶名稱
    customer_name = quote_data['customer_name']
    
    # 設備資訊 (從備註或第一項明細推測)
    equipment_name = quote_data.get('equipment_name', '')
    if not equipment_name and quote_data['items']:
        # 使用第一個項目的產品名稱作為設備名稱
        equipment_name = quote_data['items'][0]['product_name']
    
    equipment_number = f"EQ-{original_quote_no}"
    
    print(f"  訂單編號: {order_number}")
    print(f"  客戶: {customer_name}")
    print(f"  設備: {equipment_name}")
    print(f"  明細: {len(quote_data['items'])} 項")
    
    # 1. 檢查客戶是否存在，不存在則新增
    try:
        result = supabase.table('cali_customers').select('*').eq('name', customer_name).execute()
        if not result.data:
            print(f"  ➕ 新增客戶: {customer_name}")
            supabase.table('cali_customers').insert({
                'name': customer_name
            }).execute()
    except Exception as e:
        print(f"  ⚠️  客戶處理警告: {e}")
    
    # 2. 建立訂單明細
    orders_to_create = []
    
    for item in quote_data['items']:
        # 嘗試從庫存中找到對應產品
        product_id = None
        try:
            result = supabase.table('cali_products').select('id').eq('name', item['product_name']).execute()
            if result.data:
                product_id = result.data[0]['id']
            else:
                # 產品不存在，自動新增到庫存
                print(f"    ➕ 新增產品到庫存: {item['product_name']}")
                new_product = supabase.table('cali_products').insert({
                    'name': item['product_name'],
                    'specification': item.get('specification', ''),
                    'category': item.get('category', '一般'),
                    'standard_price': item['unit_price']
                }).execute()
                product_id = new_product.data[0]['id']
        except Exception as e:
            print(f"    ⚠️  產品處理警告: {e}")
        
        # 計算總金額
        total_amount = item['quantity'] * item['unit_price']
        
        orders_to_create.append({
            'order_number': order_number,
            'customer_name': customer_name,
            'equipment_number': equipment_number,
            'equipment_name': equipment_name,
            'product_id': product_id,
            'product_name': item['product_name'],
            'product_spec': item.get('specification', ''),
            'category': item.get('category', '一般'),
            'calibration_type': 'Internal',  # 預設內校，可根據需求調整
            'quantity': item['quantity'],
            'unit_price': item['unit_price'],
            'discount_rate': 100,
            'total_amount': total_amount,
            'status': 'Pending',
            'target_date': target_date,
            'notes': f"從報價單 {original_quote_no} 匯入"
        })
    
    # 3. 批次寫入訂單
    try:
        result = supabase.table('cali_orders').insert(orders_to_create).execute()
        print(f"  ✅ 成功匯入 {len(orders_to_create)} 筆明細")
        return True
    except Exception as e:
        print(f"  ❌ 匯入失敗: {e}")
        return False

def main():
    """主程式"""
    print("="*60)
    print("📊 報價單匯入工具 - Supabase")
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
    
    # 掃描解析後的 JSON 檔案
    parsed_folder = Path("quotes_parsed")
    if not parsed_folder.exists():
        print(f"\n❌ 找不到資料夾: {parsed_folder}")
        print("請先執行: python pdf_quote_parser.py")
        return
    
    json_files = list(parsed_folder.glob("*.json"))
    
    if not json_files:
        print(f"\n⚠️  {parsed_folder} 資料夾內沒有 JSON 檔案")
        print("請先執行: python pdf_quote_parser.py")
        return
    
    print(f"\n找到 {len(json_files)} 個待匯入檔案\n")
    
    # 匯入確認
    print("將匯入以下檔案:")
    for f in json_files:
        print(f"  - {f.name}")
    
    confirm = input("\n確定要匯入? (y/N): ").strip().lower()
    if confirm != 'y':
        print("已取消")
        return
    
    # 批次匯入
    success_count = 0
    for json_file in json_files:
        try:
            if import_quote_to_supabase(json_file, supabase):
                success_count += 1
        except Exception as e:
            print(f"  ❌ 處理失敗: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "="*60)
    print(f"✅ 匯入完成: {success_count}/{len(json_files)} 成功")
    print("="*60)
    
    # 可選：移動已處理的檔案
    if success_count > 0:
        archive = input("\n是否將已匯入的檔案移到 quotes_archived 資料夾? (y/N): ").strip().lower()
        if archive == 'y':
            archive_folder = Path("quotes_archived")
            archive_folder.mkdir(exist_ok=True)
            
            for json_file in json_files:
                csv_file = json_file.with_suffix('.csv')
                json_file.rename(archive_folder / json_file.name)
                if csv_file.exists():
                    csv_file.rename(archive_folder / csv_file.name)
            
            print(f"✓ 已移動到: {archive_folder}")

if __name__ == "__main__":
    main()
