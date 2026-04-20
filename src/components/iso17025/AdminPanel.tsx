import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/iso17025/supabase';
import { Trash2, AlertCircle, CheckCircle2, Loader2, Users, Database, Clock, RefreshCw } from 'lucide-react';

interface AdminPanelProps {
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'mgmt' | 'logs'>('logs');
  const [userLogs, setUserLogs] = useState<any[]>([]);
  const [sysLogs, setSysLogs] = useState<string[]>([]);
  const [isLoadingUserLogs, setIsLoadingUserLogs] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error', msg: string } | null>(null);

  const fetchUserLogs = async () => {
    setIsLoadingUserLogs(true);
    try {
      const { data, error } = await supabase
        .from('iso17025_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setUserLogs(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingUserLogs(false);
    }
  };

  const triggerUpdate = async () => {
    setIsUpdating(true);
    setSysLogs(['[系統] 開始更新知識庫...']);
    setStatus({ type: 'info', msg: '正在同步本地文件與資料庫...' });
    
    try {
      const resp = await fetch('http://localhost:3001/api/update-all', { method: 'POST' });
      const { jobId } = await resp.json();
      
      const poll = setInterval(async () => {
        const sResp = await fetch(`http://localhost:3001/api/job/${jobId}`);
        const { logs, done, result } = await sResp.json();
        setSysLogs(logs || []);
        if (done) {
          clearInterval(poll);
          setIsUpdating(false);
          setStatus({ type: 'success', msg: `更新完成！成功同步 ${result?.success || 0} 份文件。` });
        }
      }, 1000);
    } catch (err: any) {
      setIsUpdating(false);
      setStatus({ type: 'error', msg: '更新失敗：請確保後端伺服器 (server_17025.cjs) 已啟動。' });
      setSysLogs(prev => [...prev, `[錯誤] ${err.message}`]);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs') fetchUserLogs();
  }, [activeTab]);

  return (
    <div className="doc-overlay" style={{zIndex: 10000}}>
      <div className="doc-modal" style={{width: '95vw', maxWidth: '800px', height: '80vh'}}>
        <div className="doc-modal-head">
          <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
            <h2 style={{margin:0}}>ISO 17025 系統管理</h2>
            <div style={{display:'flex', background:'#f1f5f9', padding:'4px', borderRadius:'8px', fontSize:'0.8rem'}}>
              <button onClick={()=>setActiveTab('logs')} style={{padding:'6px 12px', border:'none', borderRadius:'6px', background: activeTab==='logs'?'white':'transparent', cursor:'pointer', fontWeight: activeTab==='logs'?800:400, boxShadow: activeTab==='logs'?'0 2px 4px rgba(0,0,0,0.05)':'none'}}>活動日誌</button>
              <button onClick={()=>setActiveTab('mgmt')} style={{padding:'6px 12px', border:'none', borderRadius:'6px', background: activeTab==='mgmt'?'white':'transparent', cursor:'pointer', fontWeight: activeTab==='mgmt'?800:400, boxShadow: activeTab==='mgmt'?'0 2px 4px rgba(0,0,0,0.05)':'none'}}>文件同步</button>
            </div>
          </div>
          <button onClick={onClose} style={{background:'none', border:'none', fontSize:'24px', cursor:'pointer'}}>✕</button>
        </div>

        <div style={{flex: 1, overflowY: 'auto', padding: '1.5rem'}}>
          {activeTab === 'logs' ? (
            <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{fontSize:'0.9rem', color:'#64748b', display:'flex', alignItems:'center', gap:'6px'}}><Users size={16} /> 最近活動記錄 (50筆)</div>
                <button onClick={fetchUserLogs} disabled={isLoadingUserLogs} style={{display:'flex', alignItems:'center', gap:'4px', background:'none', border:'1px solid #e2e8f0', padding:'4px 8px', borderRadius:'4px', fontSize:'0.8rem', cursor:'pointer'}}><RefreshCw size={14} className={isLoadingUserLogs?'animate-spin':''} /> 刷新</button>
              </div>
              
              <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                {userLogs.map(log => (
                  <div key={log.id} style={{padding:'1rem', border:'1px solid #f1f5f9', borderRadius:'10px', background:'#f8fafc'}}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px'}}>
                      <span style={{fontWeight:800, color:'#0f172a', fontSize:'0.9rem'}}>{log.user_name}</span>
                      <span style={{fontSize:'0.75rem', color:'#94a3b8', display:'flex', alignItems:'center', gap:'4px'}}><Clock size={12} /> {new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <div style={{fontSize:'0.8rem', background: log.action_type==='ENTER_SYSTEM'?'#fef3c7':'#dcfce7', color: log.action_type==='ENTER_SYSTEM'?'#92400e':'#166534', padding:'2px 8px', borderRadius:'4px', display:'inline-block', marginBottom:'8px'}}>{
                      log.action_type === 'ENTER_SYSTEM' ? '🚪 進入系統' : 
                      log.action_type === 'CHAT_INQUIRY' ? '❓ 發起諮詢 (管理者)' :
                      log.action_type === 'CHAT_CONSULT' ? '💬 單一專家諮詢' : '🔧 專家協作任務'
                    }</div>
                    {log.message_content && (
                      <div style={{fontSize:'0.85rem', color:'#334055', marginTop:'4px', borderLeft:'2px solid #e2e8f0', paddingLeft:'8px'}}>
                        <strong>詢問：</strong> {log.message_content}
                      </div>
                    )}
                    {log.agent_response && (
                      <div style={{fontSize:'0.85rem', color:'#64748b', marginTop:'4px', maxHeight:'120px', overflowY:'auto', borderTop:'1px dashed #e2e8f0', paddingTop:'8px'}}>
                        <strong>AI回覆：</strong> {log.agent_response}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
             <div style={{display:'flex', flexDirection:'column', gap:'1.5rem'}}>
                <div style={{background: '#eff6ff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #dbeafe'}}>
                  <h3 style={{fontSize: '1rem', color: '#1e40af', marginBottom: '0.8rem', display: 'flex', alignItems: 'center'}}>
                    <Database size={18} style={{marginRight: '8px'}} /> 文件同步更新
                  </h3>
                  <p style={{fontSize:'0.85rem', color:'#1e40af', marginBottom:'1rem', opacity:0.8}}>將掃描您的三個文件夾 (品質手冊、品質文件、技術文件)，自動將最新 version 同步至 Supabase。</p>
                  <button 
                    onClick={triggerUpdate}
                    disabled={isUpdating}
                    style={{
                      width: '100%', padding: '1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    {isUpdating ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} style={{marginRight:'8px'}} />} 一鍵更新知識庫 (Sync)
                  </button>
                </div>

                <div style={{flex: 1, background: '#1e293b', borderRadius: '12px', padding: '1rem', color: '#cbd5e1', fontSize: '0.8rem', fontFamily: 'monospace', height: '250px', overflowY: 'auto'}}>
                  <div style={{color: '#94a3b8', borderBottom: '1px solid #334155', paddingBottom: '0.5rem', marginBottom: '0.5rem'}}>同步作業日誌</div>
                  {sysLogs.map((log, i) => <div key={i} style={{marginBottom: '2px'}}>{log}</div>)}
                  {sysLogs.length === 0 && <div style={{opacity: 0.5}}>等待執行任務...</div>}
                </div>
             </div>
          )}
        </div>

        {status && (
          <div style={{
            margin:'0 1.5rem 1.5rem 1.5rem', padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px',
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
  );
};

export default AdminPanel;
