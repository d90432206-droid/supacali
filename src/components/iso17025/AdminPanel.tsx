import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/iso17025/supabase';
import { Trash2, AlertCircle, CheckCircle2, Loader2, Users, Database, Clock, RefreshCw } from 'lucide-react';

interface AdminPanelProps {
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [userLogs, setUserLogs] = useState<any[]>([]);
  const [isLoadingUserLogs, setIsLoadingUserLogs] = useState(false);

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

  useEffect(() => {
    fetchUserLogs();
  }, []);

  return (
    <div className="doc-overlay" style={{zIndex: 10000}}>
      <div className="doc-modal" style={{width: '95vw', maxWidth: '800px', height: '80vh'}}>
        <div className="doc-modal-head">
          <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
            <h2 style={{margin:0}}>ISO 17025 系統活動日誌</h2>
          </div>
          <button onClick={onClose} style={{background:'none', border:'none', fontSize:'24px', cursor:'pointer'}}>✕</button>
        </div>

        <div style={{flex: 1, overflowY: 'auto', padding: '1.5rem'}}>
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
              {userLogs.length === 0 && <div style={{textAlign:'center', padding:'3rem', opacity:0.3}}>目前尚無活動記錄</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
