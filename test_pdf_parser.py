"""
快速測試 PDF 解析器
Quick Test Script for PDF Quote Parser
"""

import sys
from pathlib import Path

# 檢查依賴
print("🔍 檢查依賴套件...")
try:
    import pdfplumber
    print("  ✓ pdfplumber")
except ImportError:
    print("  ✗ pdfplumber - 請執行: pip install pdfplumber")
    sys.exit(1)

try:
    import pandas
    print("  ✓ pandas")
except ImportError:
    print("  ✗ pandas - 請執行: pip install pandas")
    sys.exit(1)

print("\n" + "="*60)
print("📋 制宜電測 - PDF 報價單解析器 - 快速測試")
print("="*60)

# 檢查資料夾
pdf_folder = Path("quotes_pdf")
if not pdf_folder.exists():
    print(f"\n❌ 找不到資料夾: {pdf_folder}")
    print("   請確認資料夾已建立")
    sys.exit(1)

pdf_files = list(pdf_folder.glob("*.pdf"))

if not pdf_files:
    print(f"\n📁 資料夾: {pdf_folder.absolute()}")
    print("\n⚠️  資料夾內沒有 PDF 檔案")
    print("\n請將您的報價單 PDF 檔案放入此資料夾，然後執行:")
    print("   python pdf_quote_parser.py")
    print("\n範例: 將 '校驗報價單_P26001.pdf' 複製到 quotes_pdf 資料夾")
else:
    print(f"\n✅ 找到 {len(pdf_files)} 個 PDF 檔案:")
    for pdf in pdf_files:
        print(f"   - {pdf.name}")
    
    print("\n準備解析! 執行以下指令:")
    print("   python pdf_quote_parser.py")

print("\n" + "="*60)
print("📖 完整說明請參考: PDF_PARSER_README.md")
print("="*60)
