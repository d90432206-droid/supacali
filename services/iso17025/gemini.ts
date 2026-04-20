import { GoogleGenerativeAI } from "@google/generative-ai";
import { AGENTS } from "../../data/iso17025_agents";

// Note: Ensure VITE_GEMINI_API_KEY is in your .env file
const API_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const MODEL_PRIORITY = [
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-flash"
];

async function callGeminiWithFallback(prompt: string, isJson: boolean = false) {
  if (!API_KEY) {
    throw new Error("請先在 .env 檔案中設定 VITE_GEMINI_API_KEY");
  }

  let lastError: any = null;

  for (const modelId of MODEL_PRIORITY) {
    let retryCount = 0;
    while (retryCount < 2) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelId,
          ...(isJson ? { generationConfig: { responseMimeType: "application/json" } } : {})
        });
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        
        if (isJson) {
           text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        }
        
        return text;
      } catch (error: any) {
        lastError = error;
        if (error?.status === 503 || error?.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          retryCount++;
          continue;
        }
        break; 
      }
    }
  }

  throw new Error(lastError?.message || "所有支援的模型呼叫皆失敗");
}

export async function askAgent(systemPrompt: string, userPrompt: string, knowledgeContext?: string) {
  const noContext = !knowledgeContext || knowledgeContext.includes("未在知識庫中找到") || knowledgeContext === "無";

  const isTechnicalTable = /不確定度|CMC|擴充|量測範圍|校正能力|溫度係數|靈敏度|標準差/.test(userPrompt);

  const finalPrompt = `
角色命令 (System Instruction):
${systemPrompt}

知識庫片段:
${knowledgeContext || "無"}

使用者提問:
${userPrompt}

[內容與排版強制規則]:
1. 【極簡精準】：嚴禁客套話，直接給重點。${isTechnicalTable ? '本題涉及技術/數值，請完整表列所有資料，字數不限。' : '字數請控制在 300 字內。'}
2. 【視覺化高亮排版】：你必須使用極為清晰、優雅的 Markdown 排版，讓畫面易讀：
   - 使用清晰的 📢 **重點標題** (## 或 ###) 將長篇回答分區。
   - 大量使用 **清單符號** 條列細節。
   - 重要數據與文件編號使用 **粗體**。
3. 【嚴禁幻覺】：你的回答只能來自上方「知識庫片段」。${noContext ? '本次查詢無片段，請回覆：「知識庫中無此資料」。' : '若找不到答案，請明確說「知識庫中無此相關資訊」。'}
4. 【數據與表格】：請將資料還原為優美對齊的 Markdown Table。
`;

  return callGeminiWithFallback(finalPrompt);
}

export async function decomposeLabTask(userPrompt: string) {
  const mijiangSystemPrompt = `
你是一位實驗室總管。分析用戶需求並決定最精簡的處理方式：
1. 簡單問題（查章節、版次、日期、一般諮詢）→ tasks 設為 []，由你自己直接用知識庫回答。
2. 單一技術/品質/稽核問題 → 指派「一位」對應專家。
3. 問題同時涉及多個領域（例如同時問不確定度＋文件日期、或技術＋合規）→ 最多指派「兩位」專家，各自回答自己負責的部分。
4. 專家列表：
   - iso_qm  (品質主管安娜)：文件管制、版次、日期、合規程序、品質手冊(CLS-0001-1)、品質程序(CLP-xxxx)
   - iso_tech (技術導師泰德)：校正能力、不確定度、CMC 表、技術數據、技術報告(CTM-xxxx)
   - iso_audit (稽核專家)：稽核、條款查核、TAF 準備

【任務指派與關鍵字搜索的最嚴格規定】
task 欄位是「交給專家去資料庫檢索的終極關鍵字」，必須非常精準：
- 若詢問「**具體的儀器技術參數**」（如：白金電阻的不確定度、壓力計的 CMC、電壓的量測範圍）：你**絕對不能**指派查詢 CLP-7601 這種通用的「程序法規」，你必須指派查詢該儀器的 **CTM (技術報告) 或 CTP (標準程序)**。例如指令："查詢 CTM-5409 關於白金電阻的不確定度"。

文件編號對照（你必須精準備背誦）：
- 溫度/白金電阻 → CTM-5409 或 SCTM-5409
- 溫度/熱電偶 → CTM-5409-T
- 壓力/差壓/數字壓力計 → CTP-5408 / CTM-5408
- 直流電壓 (DC Voltage) → CTM-5401 或 SCTM-5401
- 直流電流 (DC Current) → CTM-5402 或 SCTM-5402
- 交流電壓 (AC Voltage) → CTM-5403 或 SCTM-5403
- 交流電流 (AC Current) → CTM-5404 或 SCTM-5404
- 交流功率 (AC Power) → CTM-5405
- 通用不確定度「法規與評估方法」 → CLP-7601 (⚠️ 裡面沒有實體設備數據，僅限問法規時使用)
- 品質手冊/目標/政策 → CLS-0001-1
- 供應商/採購 → CLP-6601, CLP-6602
- 內部稽核 → CLP-8801

請回傳 JSON（tasks 可為 0、1 或 2 個元素）：
{
  "tasks": [ { "agentId": "expert_id", "task": "請查詢 文件編號 中關於XXX的規定，具體問題" } ],
  "reasoning": "分析原因"
}
`;

  try {
    const resultText = await callGeminiWithFallback(`${mijiangSystemPrompt}\n\n用戶要求: ${userPrompt}`, true);
    return JSON.parse(resultText);
  } catch (error) {
    return { tasks: [], reasoning: "直接回答。" };
  }
}
