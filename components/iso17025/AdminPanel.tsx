import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';

const API = 'http://localhost:3001';

interface Status { documents: number; chunks: number; }

export const AdminPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [docInput, setDocInput] = useState('');
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [log]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const loadStatus = async () => {
    try {
      const r = await fetch(`${API}/api/status`);
      if (r.ok) {
        setStatus(await r.json());
        setServerOk(true);
      } else {
        setServerOk(false);
      }
    } catch { 
      setServerOk(false); 
    }
  };
  
  useEffect(() => { loadStatus(); }, []);

  const startJob = async (url: string, body?: object) => {
    if (running) return;
    setRunning(true);
    setDone(false);
    setLog(['🎬 正在啟動任務...']);

    let jobId: string;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      jobId = data.jobId;
    } catch {
      setLog(['❌ 無法連線至後端服務（請確認已執行 npm run server）']);
      setRunning(false);
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/job/${jobId}`);
        const job = await r.json();

        if (job.logs && job.logs.length > 0) {
          setLog(job.logs);
        }

        if (job.done) {
          clearInterval(pollRef.current!);
          setRunning(false);
          setDone(true);
          loadStatus();
        }
      } catch {
        clearInterval(pollRef.current!);
        setRunning(false);
      }
    }, 800);
  };

  return (
    <div className="doc-overlay" style={{ zIndex: 10000 }}>
      <div className="doc-modal" style={{ maxWidth: '600px', background: '#ffffff', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <div className="doc-modal-head" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>🏢 17025 知識庫管理中心</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>索引 Word 文件與更新資料庫</p>
          </div>
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Server Status Warning */}
          {serverOk === false && (
            <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#dc2626', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>後端服務未啟動，請執行 <code>npm run server</code></span>
            </div>
          )}

          {/* Stats Bar */}
          {status && (
            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1, background: '#f1f5f9', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>📄 文件總數</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{status.documents}</div>
              </div>
              <div style={{ flex: 1, background: '#f1f5f9', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>🧩 知識區塊</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{status.chunks}</div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button
              onClick={() => startJob(`${API}/api/update-all`)}
              disabled={running || serverOk === false}
              style={{
                width: '100%', padding: '1rem', background: running ? '#94a3b8' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: running ? 'wait' : 'pointer', fontWeight: '800', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
              }}
            >
              {running ? <RefreshCw size={20} className="animate-spin" /> : <Upload size={20} />}
              {running ? '執行中...' : '🚀 一鍵更新全文件知識庫'}
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={docInput}
                onChange={e => setDocInput(e.target.value.toUpperCase())}
                placeholder="輸入文件編號 (如 CTM-5409)"
                disabled={running || serverOk === false}
                style={{ flex: 1, padding: '0.75rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem' }}
              />
              <button
                onClick={() => docInput.trim() && startJob(`${API}/api/ingest-one`, { docNumber: docInput.trim() })}
                disabled={running || !docInput.trim() || serverOk === false}
                style={{ padding: '0.75rem 1.25rem', background: '#334155', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                更新
              </button>
            </div>
          </div>

          {/* Log Window */}
          <div ref={logRef} style={{ marginTop: '1.5rem', background: '#0f172a', color: '#94a3b8', padding: '1rem', borderRadius: '8px', height: '200px', overflowY: 'auto', fontSize: '0.8rem', fontFamily: 'monospace', lineHeight: '1.5' }}>
            <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem', marginBottom: '0.5rem', color: '#475569' }}>SYSTEM LOGS</div>
            {log.length === 0 ? <div style={{ opacity: 0.5 }}>等待操作中...</div> : log.map((l, i) => (
               <div key={i} style={{ 
                 color: l.includes('✅') ? '#10b981' : l.includes('❌') ? '#ef4444' : '#94a3b8' 
               }}>
                 {l}
               </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
