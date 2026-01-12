#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSV 編碼轉換工具 - 解決中文亂碼問題
將 Big5/ANSI/GBK 編碼的 CSV 轉換為 UTF-8
"""

import os
import sys
import chardet

def detect_encoding(file_path):
    """自動偵測檔案編碼"""
    with open(file_path, 'rb') as f:
        raw_data = f.read()
        result = chardet.detect(raw_data)
        return result['encoding']

def convert_csv_to_utf8(input_file, output_file=None):
    """
    轉換 CSV 編碼為 UTF-8
    
    Args:
        input_file: 輸入檔案路徑
        output_file: 輸出檔案路徑（如為 None，則覆蓋原檔案）
    """
    # 偵測原始編碼
    original_encoding = detect_encoding(input_file)
    print(f"📄 檔案: {input_file}")
    print(f"🔍 偵測到編碼: {original_encoding}")
    
    # 如果已經是 UTF-8，不需要轉換
    if original_encoding.lower() in ['utf-8', 'utf-8-sig', 'ascii']:
        print("✅ 檔案已經是 UTF-8 編碼，無需轉換！")
        return
    
    # 讀取檔案內容
    try:
        with open(input_file, 'r', encoding=original_encoding) as f:
            content = f.read()
    except Exception as e:
        # 如果自動偵測失敗，嘗試常見的中文編碼
        print(f"⚠️ 使用 {original_encoding} 讀取失敗，嘗試其他編碼...")
        encodings_to_try = ['big5', 'gbk', 'gb2312', 'cp950']
        
        for enc in encodings_to_try:
            try:
                print(f"   嘗試 {enc}...")
                with open(input_file, 'r', encoding=enc) as f:
                    content = f.read()
                original_encoding = enc
                print(f"✅ 成功使用 {enc} 讀取")
                break
            except:
                continue
        else:
            print("❌ 無法讀取檔案，請手動指定編碼")
            return
    
    # 輸出檔案路徑
    if output_file is None:
        # 建立備份
        backup_file = input_file + '.backup'
        os.rename(input_file, backup_file)
        output_file = input_file
        print(f"💾 已建立備份: {backup_file}")
    
    # 寫入 UTF-8 編碼
    with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
        f.write(content)
    
    print(f"✅ 轉換完成！")
    print(f"📝 輸出檔案: {output_file}")
    print(f"📊 編碼: UTF-8 with BOM")

def batch_convert(directory):
    """批次轉換資料夾內所有 CSV 檔案"""
    csv_files = [f for f in os.listdir(directory) if f.endswith('.csv') and not f.endswith('.backup')]
    
    if not csv_files:
        print("❌ 找不到 CSV 檔案")
        return
    
    print(f"📦 找到 {len(csv_files)} 個 CSV 檔案\n")
    
    for csv_file in csv_files:
        file_path = os.path.join(directory, csv_file)
        convert_csv_to_utf8(file_path)
        print("-" * 60)

if __name__ == "__main__":
    print("=" * 60)
    print("CSV 編碼轉換工具 - UTF-8 轉換器")
    print("=" * 60 + "\n")
    
    if len(sys.argv) > 1:
        # 命令列模式
        target = sys.argv[1]
        
        if os.path.isfile(target):
            # 單一檔案
            convert_csv_to_utf8(target)
        elif os.path.isdir(target):
            # 批次處理資料夾
            batch_convert(target)
        else:
            print(f"❌ 找不到檔案或資料夾: {target}")
    else:
        # 互動模式
        print("請選擇模式：")
        print("1. 轉換單一檔案")
        print("2. 批次轉換資料夾內所有 CSV")
        
        choice = input("\n請輸入選項 (1/2): ").strip()
        
        if choice == "1":
            file_path = input("請輸入 CSV 檔案路徑: ").strip().strip('"')
            if os.path.exists(file_path):
                convert_csv_to_utf8(file_path)
            else:
                print(f"❌ 找不到檔案: {file_path}")
        
        elif choice == "2":
            dir_path = input("請輸入資料夾路徑 (直接 Enter 使用當前資料夾): ").strip().strip('"')
            if not dir_path:
                dir_path = "."
            
            if os.path.exists(dir_path):
                batch_convert(dir_path)
            else:
                print(f"❌ 找不到資料夾: {dir_path}")
        else:
            print("❌ 無效的選項")
    
    print("\n" + "=" * 60)
    print("完成！")
    print("=" * 60)
