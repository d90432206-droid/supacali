import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/iso17025/supabase';
import { Trash2, AlertCircle, CheckCircle2, Loader2, Upload } from 'lucide-react';

interface AdminPanelProps {
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error', msg: string } | null>(null);

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-100));

  const clearDatabase = async () => {
    if (!confirm('確定要清空 17025 知識庫嗎？這將刪除所有文件與內容。')) return;
    setIsProcessing(true);
    setStatus({ type: 'info', msg: '正在清空資料庫...' });
    try {
      const { error: err1 } = await supabase.from('iso_knowledge_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const { error: err2 } = await supabase.from('iso_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (err1 || err2) throw new Error('刪除失敗');
      setStatus({ type: 'success', msg: '資料庫已清空' });
      addLog('資料庫已清空');
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
      addLog(`錯誤: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="doc-overlay" style={{zIndex: 10000}}>
      <div className="doc-modal" style={{maxWidth: '600px'}}>
        <div className="doc-modal-head">
          <h2>17025 後台管理</h2>
          <button onClick={onClose}>✕</button>
        </div>
        <div style={{padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
          <div style={{background: '#fff7ed', padding: '1rem', borderRadius: '8px', border: '1px solid #ffedd5'}}>
            <h3 style={{fontSize: '0.9rem', color: '#9a3412', marginBottom: '0.5rem', display: 'flex', alignItems: 'center'}}>
              <AlertCircle size={16} style={{marginRight: '6px'}} /> 危險操作
            </h3>
            <button 
              onClick={clearDatabase}
              disabled={isProcessing}
              style={{
                width: '100%', padding: '0.75rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <Trash2 size={18} style={{marginRight: '8px'}} /> 清空所有知識庫數據
            </button>
          </div>

          <div style={{flex: 1, background: '#1e293b', borderRadius: '8px', padding: '1rem', color: '#cbd5e1', fontSize: '0.8rem', fontFamily: 'monospace', height: '200px', overflowY: 'auto'}}>
            <div style={{color: '#94a3b8', borderBottom: '1px solid #334155', paddingBottom: '0.5rem', marginBottom: '0.5rem'}}>系統日誌</div>
            {logs.map((log, i) => <div key={i} style={{marginBottom: '2px'}}>{log}</div>)}
            {logs.length === 0 && <div style={{opacity: 0.5}}>等待操作...</div>}
          </div>

          {status && (
            <div style={{
              padding: '1rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px',
              background: status.type==='success'?'#f0fdf4':status.type==='error'?'#fef2f2':'#eff6ff',
              color: status.type==='success'?'#16a34a':status.type==='error'?'#dc2626':'#2563eb',
              border: `1px solid ${status.type==='success'?'#bcf0da':status.type==='error'?'#fecaca':'#bfdbfe'}`
            }}>
              {status.type === 'success' ? <CheckCircle2 size={18} /> : status.type === 'error' ? <AlertCircle size={18} /> : <Loader2 size={18} className="animate-spin" />}
              <span style={{fontWeight: 'bold'}}>{status.msg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
