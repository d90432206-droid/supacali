"""
制宜電測校正系統 - PDF 報價單解析器
PDF Quote Parser for CHUYI Calibration System

功能:
1. 從 PDF 報價單中提取關鍵欄位
2. 自動識別客戶、設備、明細資訊
3. 支援多種 OCR 引擎 (Tesseract, pdfplumber)
4. 輸出標準化 JSON/CSV 格式
"""

import os
import re
import json
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime

# PDF 處理庫
try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False
    print("⚠️  pdfplumber 未安裝，請執行: pip install pdfplumber")

# OCR 庫
try:
    from PIL import Image
    import pytesseract
    HAS_OCR = True
except ImportError:
    HAS_OCR = False
    print("⚠️  OCR 功能未安裝，請執行: pip install pytesseract pillow")


@dataclass
class QuoteItem:
    """報價明細項目"""
    item_code: str              # 項目編號 (A, B, C...)
    product_name: str           # 產品名稱
    specification: str          # 規格說明
    quantity: int               # 數量
    unit_price: float           # 單價
    total_price: float          # 小計
    category: str = "一般"      # 類別


@dataclass
class QuoteInfo:
    """報價單主資訊"""
    quote_number: str           # 報價單號 (P-26001)
    customer_name: str          # 客戶名稱
    quote_date: str             # 報價日期
    equipment_number: str = ""  # 設備案號
    equipment_name: str = ""    # 設備名稱
    total_amount: float = 0.0   # 總金額
    items: List[QuoteItem] = None
    
    def __post_init__(self):
        if self.items is None:
            self.items = []


class PDFQuoteParser:
    """PDF 報價單解析器"""
    
    def __init__(self, tesseract_path: Optional[str] = None):
        """
        初始化解析器
        
        Args:
            tesseract_path: Tesseract OCR 執行檔路徑（Windows 需要）
        """
        if tesseract_path and HAS_OCR:
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
        
        # 正則表達式模式
        self.patterns = {
            'quote_number': r'[報價單號碼編號][:：\s]*([A-Z]+-\d+)',
            'customer': r'[客戶名稱公司][:：\s]*([^\n]+)',
            'date': r'[報價日期時間][:：\s]*(\d{2,4}[年/-]\d{1,2}[月/-]\d{1,2})',
            'total': r'[總金額計][:：\s]*NT?\$?\s*([\d,]+)',
            # 明細表格模式
            'item_row': r'([A-Z])\.?\s+(.+?)\s+(\d+)\s+\$?([\d,]+)\s+\$?([\d,]+)',
        }
    
    def parse_pdf(self, pdf_path: str) -> QuoteInfo:
        """
        解析 PDF 報價單
        
        Args:
            pdf_path: PDF 檔案路徑
            
        Returns:
            QuoteInfo: 解析後的報價資訊
        """
        if not HAS_PDFPLUMBER:
            raise ImportError("需要安裝 pdfplumber: pip install pdfplumber")
        
        pdf_path = Path(pdf_path)
        if not pdf_path.exists():
            raise FileNotFoundError(f"找不到檔案: {pdf_path}")
        
        print(f"📄 開始解析: {pdf_path.name}")
        
        quote_info = QuoteInfo(
            quote_number="",
            customer_name="",
            quote_date=""
        )
        
        with pdfplumber.open(pdf_path) as pdf:
            # 處理第一頁（通常報價單只有一頁）
            page = pdf.pages[0]
            
            # 提取文字
            text = page.extract_text()
            print(f"✓ 提取文字 ({len(text)} 字元)")
            
            # 提取表格
            tables = page.extract_tables()
            
            # 解析文字欄位
            quote_info.quote_number = self._extract_field(text, 'quote_number', '未知編號')
            quote_info.customer_name = self._extract_field(text, 'customer', '未知客戶')
            quote_info.quote_date = self._extract_field(text, 'date', '')
            total_str = self._extract_field(text, 'total', '0')
            quote_info.total_amount = self._parse_number(total_str)
            
            # 解析明細表格
            if tables:
                quote_info.items = self._parse_table(tables[0], text)
            else:
                # 回退：用文字模式解析
                quote_info.items = self._parse_items_from_text(text)
        
        print(f"✓ 解析完成: 找到 {len(quote_info.items)} 個項目")
        return quote_info
    
    def _extract_field(self, text: str, pattern_key: str, default: str = "") -> str:
        """從文字中提取特定欄位"""
        pattern = self.patterns.get(pattern_key)
        if not pattern:
            return default
        
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        return match.group(1).strip() if match else default
    
    def _parse_number(self, num_str: str) -> float:
        """解析數字（處理千分位、貨幣符號）"""
        cleaned = re.sub(r'[NT$,\s]', '', num_str)
        try:
            return float(cleaned)
        except ValueError:
            return 0.0
    
    def _parse_table(self, table: List[List[str]], full_text: str) -> List[QuoteItem]:
        """解析 PDF 表格明細"""
        items = []
        
        # 尋找表頭位置
        header_idx = -1
        for i, row in enumerate(table):
            if any('項目' in str(cell or '') for cell in row):
                header_idx = i
                break
        
        # 解析資料列
        for row in table[header_idx + 1:]:
            if not row or len(row) < 4:
                continue
            
            # 嘗試提取欄位
            try:
                item_code = self._extract_item_code(row)
                if not item_code:
                    continue
                
                product_name = self._extract_product_name(row)
                spec = self._extract_specification(row)
                qty = self._extract_quantity(row)
                unit_price = self._extract_price(row, 'unit')
                total_price = self._extract_price(row, 'total')
                
                if product_name:
                    items.append(QuoteItem(
                        item_code=item_code,
                        product_name=product_name,
                        specification=spec,
                        quantity=qty,
                        unit_price=unit_price,
                        total_price=total_price
                    ))
            except Exception as e:
                print(f"  ⚠️  跳過無效列: {e}")
                continue
        
        return items
    
    def _extract_item_code(self, row: List[str]) -> str:
        """提取項目編號 (A, B, C...)"""
        for cell in row[:3]:  # 通常在前三欄
            if cell and re.match(r'^[A-Z]\.?$', str(cell).strip()):
                return cell.strip().replace('.', '')
        return ""
    
    def _extract_product_name(self, row: List[str]) -> str:
        """提取產品名稱"""
        # 尋找最長的文字欄位（通常是產品名稱）
        longest = ""
        for cell in row:
            if cell and len(str(cell).strip()) > len(longest):
                # 排除純數字欄位
                if not re.match(r'^[\d,\$]+$', str(cell).strip()):
                    longest = str(cell).strip()
        return longest
    
    def _extract_specification(self, row: List[str]) -> str:
        """提取規格"""
        # 尋找包含規格特徵的欄位（範圍、單位等）
        for cell in row:
            if cell and any(char in str(cell) for char in ['mm', '°C', 'kg', '-', '~']):
                return str(cell).strip()
        return ""
    
    def _extract_quantity(self, row: List[str]) -> int:
        """提取數量"""
        for cell in row:
            if cell and re.match(r'^\d+$', str(cell).strip()):
                try:
                    qty = int(cell.strip())
                    if 0 < qty < 1000:  # 合理範圍
                        return qty
                except ValueError:
                    continue
        return 1
    
    def _extract_price(self, row: List[str], price_type: str = 'unit') -> float:
        """提取價格（單價或總價）"""
        prices = []
        for cell in row:
            if cell:
                num_str = re.sub(r'[NT$,\s]', '', str(cell))
                if re.match(r'^\d+(\.\d+)?$', num_str):
                    try:
                        price = float(num_str)
                        if price > 0:
                            prices.append(price)
                    except ValueError:
                        continue
        
        # 返回最大值（總價）或次大值（單價）
        if not prices:
            return 0.0
        prices.sort()
        return prices[-1] if price_type == 'total' else (prices[-2] if len(prices) > 1 else prices[0])
    
    def _parse_items_from_text(self, text: str) -> List[QuoteItem]:
        """從純文字解析明細（回退方案）"""
        items = []
        pattern = self.patterns['item_row']
        
        for match in re.finditer(pattern, text, re.MULTILINE):
            item_code, name, qty, unit_price, total = match.groups()
            items.append(QuoteItem(
                item_code=item_code,
                product_name=name.strip(),
                specification="",
                quantity=int(qty),
                unit_price=self._parse_number(unit_price),
                total_price=self._parse_number(total)
            ))
        
        return items
    
    def export_to_csv(self, quote_info: QuoteInfo, output_path: str):
        """匯出為 CSV 格式"""
        # 準備資料
        rows = []
        for item in quote_info.items:
            rows.append({
                '報價單號': quote_info.quote_number,
                '客戶名稱': quote_info.customer_name,
                '報價日期': quote_info.quote_date,
                '項目編號': item.item_code,
                '產品名稱': item.product_name,
                '規格': item.specification,
                '數量': item.quantity,
                '單價': item.unit_price,
                '總價': item.total_price,
                '類別': item.category
            })
        
        df = pd.DataFrame(rows)
        df.to_csv(output_path, index=False, encoding='utf-8-sig')
        print(f"✓ CSV 已匯出: {output_path}")
    
    def export_to_json(self, quote_info: QuoteInfo, output_path: str):
        """匯出為 JSON 格式"""
        data = asdict(quote_info)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✓ JSON 已匯出: {output_path}")


def main():
    """主程式 - 示範用法"""
    print("=" * 60)
    print("📋 制宜電測 - PDF 報價單解析器")
    print("=" * 60)
    
    # 初始化解析器
    # Windows 用戶需指定 Tesseract 路徑
    tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    parser = PDFQuoteParser(tesseract_path if os.path.exists(tesseract_path) else None)
    
    # 設定輸入輸出路徑
    pdf_folder = Path(__file__).parent / "quotes_pdf"
    output_folder = Path(__file__).parent / "quotes_parsed"
    output_folder.mkdir(exist_ok=True)
    
    print(f"\n📁 掃描資料夾: {pdf_folder}")
    
    if not pdf_folder.exists():
        pdf_folder.mkdir()
        print(f"  ⚠️  資料夾不存在，已建立: {pdf_folder}")
        print(f"  ℹ️  請將 PDF 報價單放入此資料夾後重新執行")
        return
    
    # 處理所有 PDF 檔案
    pdf_files = list(pdf_folder.glob("*.pdf"))
    
    if not pdf_files:
        print("  ⚠️  未找到 PDF 檔案")
        print(f"  ℹ️  請將 PDF 報價單放入: {pdf_folder}")
        return
    
    print(f"\n找到 {len(pdf_files)} 個 PDF 檔案\n")
    
    for pdf_file in pdf_files:
        try:
            # 解析 PDF
            quote_info = parser.parse_pdf(str(pdf_file))
            
            # 顯示結果
            print(f"\n{'─' * 60}")
            print(f"報價單號: {quote_info.quote_number}")
            print(f"客戶名稱: {quote_info.customer_name}")
            print(f"報價日期: {quote_info.quote_date}")
            print(f"總金額: NT$ {quote_info.total_amount:,.0f}")
            print(f"\n明細項目 ({len(quote_info.items)} 項):")
            
            for item in quote_info.items:
                print(f"  [{item.item_code}] {item.product_name}")
                print(f"      規格: {item.specification}")
                print(f"      數量: {item.quantity} | 單價: ${item.unit_price:,.0f} | 小計: ${item.total_price:,.0f}")
            
            # 匯出檔案
            base_name = pdf_file.stem
            csv_path = output_folder / f"{base_name}.csv"
            json_path = output_folder / f"{base_name}.json"
            
            parser.export_to_csv(quote_info, str(csv_path))
            parser.export_to_json(quote_info, str(json_path))
            
        except Exception as e:
            print(f"❌ 解析失敗: {pdf_file.name}")
            print(f"   錯誤: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("✅ 全部處理完成!")
    print(f"📂 輸出資料夾: {output_folder}")
    print("=" * 60)


if __name__ == "__main__":
    main()
