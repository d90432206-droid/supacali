const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' }); // 讀取您的 .env.local

const { createClient } = require('@supabase/supabase-js');
const mammoth = require('mammoth');

const app = express();
app.use(cors());
app.use(express.json());

// 使用您在 .env.local 中設定的 17025 專屬變數
const supabase = createClient(
  process.env.VITE_ISO_SUPABASE_URL, 
  process.env.VITE_ISO_SUPABASE_ANON_KEY
);

const DOCS_FOLDERS = ['1.品質手冊', '2.品質文件', '3.技術文件'];
const ROOT_DIR = __dirname;

const jobs = new Map();
let jobCounter = 0;

function createJob() {
    const id = String(++jobCounter);
    jobs.set(id, { logs: [], done: false, error: null, result: null });
    return id;
}
function jobLog(id, msg) {
    const job = jobs.get(id);
    if (job) job.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
}
function jobDone(id, result) {
    const job = jobs.get(id);
    if (job) { job.done = true; job.result = result; }
}

function matchDocNumber(filename, docNumber) {
    const escaped = docNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('^' + escaped + '(?=[_\\s.]|$)', 'i').test(filename);
}

function scanDocxFiles(folder) {
    const dirPath = path.join(ROOT_DIR, folder);
    if (!fs.existsSync(dirPath)) return [];
    const files = fs.readdirSync(dirPath).filter(f => f.toLowerCase().endsWith('.docx'));
    const newest = new Map();
    for (const file of files) {
        const match = file.match(/([A-Z]{2,5}-\d{3,5}(?:-[A-Z0-9]+)?)/);
        if (!match) continue;
        const docNumber = match[1];
        const filePath = path.join(dirPath, file);
        const mtime = fs.statSync(filePath).mtimeMs;
        if (!newest.has(docNumber) || mtime > newest.get(docNumber).mtime) {
            newest.set(docNumber, { file, mtime, filePath, docNumber });
        }
    }
    return Array.from(newest.values());
}

function chunkText(text, chunkSize = 800, overlap = 100) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end).trim());
        start += chunkSize - overlap;
    }
    return chunks.filter(c => c.length > 50);
}

async function processDocx(jobId, filePath, docNumber) {
    const fileName = path.basename(filePath);
    jobLog(jobId, `📄 處理中: ${docNumber}：${fileName}`);
    let result;
    try {
        result = await mammoth.extractRawText({ path: filePath });
    } catch (err) {
        jobLog(jobId, `  ❌ Word 解析失敗: ${err.message}`);
        return false;
    }
    const text = result.value || '';
    if (text.length < 100) { jobLog(jobId, `  ⚠️ 內容太少，跳過`); return false; }

    const { data: docData } = await supabase.from('iso_documents').select('id').eq('doc_number', docNumber).single();
    if (!docData) {
        jobLog(jobId, `  ❌ 資料庫找不到 ${docNumber}，請先確認已登錄該文件`);
        return false;
    }

    await supabase.from('iso_knowledge_chunks').delete().eq('doc_id', docData.id);
    const chunks = chunkText(text);
    let ok = 0;
    for (let i = 0; i < chunks.length; i++) {
        const { error } = await supabase.from('iso_knowledge_chunks').insert({
            doc_id: docData.id,
            content: chunks[i],
            chunk_index: i,
            page_number: 1,
            metadata: { source: 'word_direct', file_name: fileName }
        });
        if (!error) ok++;
    }
    jobLog(jobId, `  ✅ 成功覆寫 ${ok}/${chunks.length} 個知識區塊`);
    return true;
}

async function runUpdateAll(jobId, targetDoc = null) {
    jobLog(jobId, '【步驟 1】掃描並登錄文件編號...');
    let newDocs = 0;
    const categoryMap = { '1.品質手冊': 'Manual', '2.品質文件': 'Procedure', '3.技術文件': 'Instruction' };

    for (const folder of DOCS_FOLDERS) {
        const dirPath = path.join(ROOT_DIR, folder);
        if (!fs.existsSync(dirPath)) continue;
        const allFiles = fs.readdirSync(dirPath).filter(f => f.match(/\.(pdf|docx)$/i));
        for (const file of allFiles) {
            const match = file.match(/([A-Z]{2,5}-\d{3,5}(?:-[A-Z0-9]+)?)/);
            if (!match) continue;
            const docNumber = match[1];
            if (targetDoc && !matchDocNumber(file, targetDoc)) continue;
            const { data: existing } = await supabase.from('iso_documents').select('id').eq('doc_number', docNumber).single();
            if (!existing) {
                const title = file.replace(/\.(pdf|docx)$/i, '').trim();
                const { error } = await supabase.from('iso_documents').insert({
                    doc_number: docNumber, title, category: categoryMap[folder] || 'Procedure', status: '有效'
                });
                if (!error) { jobLog(jobId, `  ✅ 新登錄：[${docNumber}]`); newDocs++; }
            }
        }
    }
    jobLog(jobId, `  新增 ${newDocs} 筆檔案登錄`);

    jobLog(jobId, '【步驟 2】上傳 Word 內容到知識庫...');
    let total = 0, success = 0;
    for (const folder of DOCS_FOLDERS) {
        const entries = scanDocxFiles(folder);
        const targets = targetDoc ? entries.filter(e => matchDocNumber(e.file, targetDoc)) : entries;
        if (targets.length === 0) continue;
        for (const entry of targets) {
            const ok = await processDocx(jobId, entry.filePath, entry.docNumber);
            total++;
            if (ok) success++;
        }
    }
    jobLog(jobId, `🎉 完成！${success}/${total} 份檔案同步成功`);
    jobDone(jobId, { total, success });
}

app.post('/api/update-all', (req, res) => {
    const jobId = createJob();
    runUpdateAll(jobId).catch(err => { jobLog(jobId, `❌ 錯誤：${err.message}`); jobDone(jobId, { error: err.message }); });
    res.json({ jobId });
});

app.post('/api/ingest-one', (req, res) => {
    const { docNumber } = req.body;
    const jobId = createJob();
    runUpdateAll(jobId, docNumber).catch(err => { jobLog(jobId, `❌ 錯誤：${err.message}`); jobDone(jobId, { error: err.message }); });
    res.json({ jobId });
});

app.get('/api/job/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ logs: job.logs, done: job.done, result: job.result });
});

app.get('/api/status', async (req, res) => {
    try {
        const { count: documents } = await supabase.from('iso_documents').select('*', { count: 'exact', head: true });
        const { count: chunks } = await supabase.from('iso_knowledge_chunks').select('*', { count: 'exact', head: true });
        res.json({ documents: documents || 0, chunks: chunks || 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(3001, () => console.log('✅ 17025 知識庫解析伺服器已啟動：http://localhost:3001'));
