# ISO 17025 專家系統整合技術日誌 (Integration Log)

## 📋 專案概況
本紀錄旨在說明將原獨立運行的 ISO 17025 多 Agent AI 系統整合至「制宜校運管理系統 (CHUYI CALIBRATION)」的過程與核心架構，供未來 AI 維護與分析時使用。

## 🏗️ 核心架構調整
1.  **根目錄結構化**：
    *   目標系統為根目錄驅動（`App.tsx` 在根目錄下）。
    *   **修正**：所有 17025 相關組件已從 `src/` 移至根目錄下對應的 `/components`, `/services`, `/data`, `/types` 資料夾，以解決 Vite Import-Analysis 路徑解析失敗的問題。
2.  **版面整合 (Full-Width)**：
    *   主系統使用 `max-w-7xl` 限制寬度。
    *   **修正**：為 `iso17025` 視圖設定了專屬條件，在進入該功能時會移除 Padding 與 Max-Width，達成右側滿版顯示。

## 🛠️ 遇到過的技術問題與解決方案
*   **Vite Import Error**: 發生 `Failed to resolve import "./components/iso17025/..."`。
    *   *原因*：路徑混淆（根目錄 vs src）。
    *   *解決*：統一移動至根目錄路徑。
*   **Missing Lucide Icons**: 加入新功能後 Sidebar 出現 `Sparkles is not defined`。
    *   *解決*：補齊 `lucide-react` 導入。
*   **Ingestion Server 衝突**: 分開執行的流程太繁瑣。
    *   *解決*：導入 `concurrently` 套件，建立 `npm start` 指令，一次啟動 Vite 與後端解析伺服器。

## ⚙️ 環境變數需求
請確保 `.env.local` 包含以下金鑰：
- `VITE_ISO_SUPABASE_URL`: 17025 專屬 Supabase URL
- `VITE_ISO_SUPABASE_ANON_KEY`: 17025 專屬 Anon Key
- `VITE_GEMINI_API_KEY`: Google AI API Key

## 🚀 啟動方式
```bash
npm start
```
(會同時啟動前端與 `localhost:3001` 的 Word 轉檔服務)
