import React, { useState, useEffect, useRef } from 'react';
import { AGENTS } from '../../data/iso17025_agents';
import type { Agent, Message } from '../../types/iso17025';
import { askAgent, decomposeLabTask } from '../../services/iso17025/gemini';
import { searchKnowledge, supabase, saveIsoLog } from '../../services/iso17025/supabase';
import { Settings, BookOpen, FileText, Wrench, Database, Send, Sparkles } from 'lucide-react';
import AdminPanel from './AdminPanel';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './ISO17025System.css';

const CHAR_IMAGES: Record<string, { img: string; label: string; color: string; scale: number }> = {
  iso_mgr:   { img: '/assets/mgr_solo.png',   label: '實驗室總管', color: '#ec4899', scale: 1.15 },
  iso_qm:    { img: '/assets/qm_solo.png',    label: '品質主管', color: '#6366f1', scale: 2.1 },
  iso_tech:  { img: '/assets/tech_solo.png',  label: '技術導師', color: '#f59e0b', scale: 1.9 },
  iso_audit: { img: '/assets/audit_solo.png', label: '稽核專家', color: '#10b981', scale: 2.1 },
};

const DOC_ICONS: Record<string, React.ReactNode> = {
  Manual: <BookOpen size={18} className="painting-icon-modern" />,
  Procedure: <FileText size={18} className="painting-icon-modern" />,
  Instruction: <Wrench size={18} className="painting-icon-modern" />,
};

const cleanDocTitle = (title: string, docNumber: string) => {
  let t = title.replace(/\.(pdf|docx?)$/i, '');
  t = t.replace(/\(.*?\)|（.*?）|\[.*?\]/g, ''); 
  t = t.replace(new RegExp(docNumber, 'gi'), ''); 
  t = t.replace(/[A-Z]{2,5}-[A-Z0-9]{1,6}(-[A-Z0-9]+)?/gi, ''); 
  t = t.replace(/[\s_-]?\d{4}[.\-/]?\d{2}[.\-/]?\d{2}\s*$/i, '');
  t = t.replace(/[\s_-]?\d{6,8}\s*$/i, '');
  t = t.replace(/[\s_-]?[A-Za-z]\d*版?\s*$/i, '');
  t = t.replace(/^[\s_.-]+|[\s_.-]+$/g, '');
  return t;
};

function parseDocDetails(doc: any) {
  const title = doc.title || '';
  const verM = title.match(/([A-Z]\d+版?)/i);
  const ver = doc.current_version || doc.version || (verM ? verM[1].toUpperCase() : '—');
  let date = doc.effective_date;
  if (!date) {
    const dateM = title.match(/(20\d{6})/);
    if (dateM) {
        date = dateM[1].replace(/(\d{4})(\d{2})(\d{2})/, '$1/$2/$3');
    } else {
        date = '—';
    }
  }
  return { ver: ver.replace(/版$/, ''), date, name: cleanDocTitle(title, doc.doc_number) || '未命名文件' };
}

export const ISO17025System: React.FC = () => {
  const [selectedAgent, setSelectedAgent] = useState<Agent>(AGENTS[0]);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [inputValue, setInputValue]   = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [speakingId, setSpeakingId]   = useState<string | null>(null);
  const [showAdmin, setShowAdmin]     = useState(false);
  const [showDocs, setShowDocs]       = useState(false);
  const [filterCat, setFilterCat]     = useState<string | null>(null);
  const [docs, setDocs]               = useState<any[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // 獲取目前用戶
    const userName = localStorage.getItem('chuyi_user_name') || '系統工程師';
    saveIsoLog(userName, 'ENTER_SYSTEM');
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadDocs = async () => {
    const { data } = await supabase.from('iso_documents').select('*').order('doc_number');
    setDocs(data ?? []);
  };
  useEffect(() => { loadDocs(); }, []);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    const query = inputValue.trim();
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: query, timestamp: Date.now() }]);
    setInputValue(''); setIsLoading(true);
    try {
      if (selectedAgent.id === 'iso_mgr') {
        setSpeakingId('iso_mgr');
        const decomp = await decomposeLabTask(query);
        setMessages(prev => [...prev, { id: `m-${Date.now()}`, role: 'assistant', content: `⚡ ${decomp.reasoning}`, agentId: 'iso_mgr', timestamp: Date.now() }]);
        if (decomp.tasks.length === 0) {
          const ctx = await searchKnowledge(query);
          const ans = await askAgent(selectedAgent.systemPrompt, query, ctx);
          setMessages(prev => [...prev, { id: `ma-${Date.now()}`, role: 'assistant', content: ans, agentId: 'iso_mgr', timestamp: Date.now() }]);
          
          // 記錄日誌
          saveIsoLog(localStorage.getItem('chuyi_user_name') || '系統工程師', 'CHAT_INQUIRY', query, ans);
        } else {
          for (const t of decomp.tasks) {
            const expert = AGENTS.find(a => a.id === t.agentId);
            if (!expert) continue;
            setSpeakingId(expert.id);
            const ctx = await searchKnowledge(t.task);
            const reply = await askAgent(expert.systemPrompt, t.task, ctx);
            setMessages(prev => [...prev, { id: `ex-${Date.now()}`, role: 'assistant', content: reply, agentId: expert.id, timestamp: Date.now() }]);
            
            // 記錄日誌 (專家子任務)
            saveIsoLog(localStorage.getItem('chuyi_user_name') || '系統工程師', 'CHAT_AGENT_TASK', t.task, reply);
          }
        }
      } else {
        setSpeakingId(selectedAgent.id);
        const ctx = await searchKnowledge(query);
        const reply = await askAgent(selectedAgent.systemPrompt, query, ctx);
        setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: 'assistant', content: reply, agentId: selectedAgent.id, timestamp: Date.now() }]);
        
        // 記錄日誌 (單一 Agent 諮詢)
        saveIsoLog(localStorage.getItem('chuyi_user_name') || '系統工程師', 'CHAT_CONSULT', query, reply);
      }
    } catch (err) {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: '❌ 系統忙碌', timestamp: Date.now() }]);
    } finally {
      setIsLoading(false); setSpeakingId(null);
    }
  };

  const openDocTable = (cat: string | null = null) => { setFilterCat(cat); setShowDocs(true); };
  const filteredDocs = filterCat ? docs.filter(d => d.category === filterCat) : docs;

  return (
    <div className="iso17025-container">
      {showAdmin && <AdminPanel onClose={() => { setShowAdmin(false); loadDocs(); }} />}
      <div className="cave-header">
        <div className="cave-title">🦾 制宜實驗室 — 17025 專家顧問系統</div>
        <div style={{fontSize:'0.8rem', opacity:0.6}}>ISO 17025 Digital Consultant</div>
      </div>
      <div className="cave-main">
        <div className="cave-wall">
          <div className="cave-wall-title">知識庫目錄</div>
          <div className="cave-paintings">
            <div className={`cave-painting-item ${!filterCat ? 'active' : ''}`} onClick={() => openDocTable()}>
              <Database size={18} className="painting-icon-modern" /> 
              <div className="cave-painting-text">
                <span className="cave-painting-label">全文件庫</span>
                <span className="cave-painting-count">{docs.length}</span>
              </div>
            </div>
            {(['Manual', 'Procedure', 'Instruction'] as const).map(cat => (
              <div key={cat} className={`cave-painting-item ${filterCat === cat ? 'active' : ''}`} onClick={() => openDocTable(cat)}>
                {DOC_ICONS[cat]}
                <div className="cave-painting-text">
                  <span className="cave-painting-label">{cat==='Manual'?'品質手冊':cat==='Procedure'?'程序文件':'技術文件'}</span>
                  <span className="cave-painting-count">{docs.filter(d => d.category === cat).length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cave-center" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'white' }}>
          <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '2rem', height: 'calc(100vh - 180px)' }}>
            {messages.length === 0 && (
              <div style={{textAlign:'center', marginTop:'8rem', opacity:0.3, animation:'pulse 2s infinite'}}>
                <Sparkles size={48} /><p style={{marginTop:'1.5rem', fontSize:'1.2rem', fontWeight:600}}>專家團隊已就緒，請輸入問題</p>
              </div>
            )}
            {messages.map(m => {
              const info = CHAR_IMAGES[m.agentId || ''];
              return (
                <div key={m.id} className={`message-bubble ${m.role}`}>
                  <div className="bubble-sender" style={{ color: info?.color }}>{info?.label ?? '使用者'}</div>
                  <div className="bubble-body" style={m.agentId ? { borderLeft: `3px solid ${info?.color}` } : {}}>
                    {m.role === 'assistant' && !m.content.startsWith('⚡') ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    ) : (
                      <>{m.content}</>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="cave-input-area">
            <input className="cave-input" placeholder={`與 ${selectedAgent.name} 會談中...`} value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key==='Enter' && !isLoading && handleSend()} disabled={isLoading} />
            <button className="cave-send-btn" onClick={handleSend} disabled={isLoading}><Send size={18} /></button>
          </div>
        </div>

        <div className="cave-right">
          <div className="agent-panel-title">專業團隊</div>
          <div className="agent-panel-list">
            {AGENTS.map(agent => {
              const isActive = selectedAgent.id === agent.id;
              const isSpeaking = speakingId === agent.id;
              return (
                <div key={agent.id} className={`agent-pixel-card ${isActive ? 'active' : ''} ${isSpeaking ? 'speaking-pulse' : ''}`} onClick={() => setSelectedAgent(agent)}>
                   <img 
                     src={CHAR_IMAGES[agent.id].img} 
                     alt={agent.name} 
                     style={{ '--scale': CHAR_IMAGES[agent.id].scale } as React.CSSProperties} 
                   />
                   <div className="agent-card-info">
                     <div className="agent-card-name" style={{ color: isActive ? 'var(--iso-accent)' : undefined }}>{agent.name}</div>
                     <div className="agent-card-role">{agent.role}</div>
                   </div>
                </div>
              );
            })}
          </div>
          <button style={{padding:'1rem', background:'#f8fafc', border:'none', borderTop:'1px solid #e2e8f0', cursor:'pointer', fontSize:'0.8rem', color:'#64748b'}} onClick={() => setShowAdmin(true)}><Settings size={14} style={{marginRight:'5px'}} /> 後台管理</button>
        </div>
      </div>

      {showDocs && (
        <div className="doc-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={()=>setShowDocs(false)}>
          <div className="doc-modal" style={{ width: '90vw', maxWidth: '900px', maxHeight: '80vh', background: 'white', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e=>e.stopPropagation()}>
             <div className="doc-modal-head" style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h2 style={{ margin: 0 }}>{filterCat ? (filterCat==='Manual'?'品質手冊':filterCat==='Procedure'?'程序文件':'技術文件') : '全文件資料庫'}</h2>
               <button style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }} onClick={()=>setShowDocs(false)}>✕</button>
             </div>
             <div className="doc-table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
               <table className="doc-table-modern">
                 <thead><tr><th>編號</th><th>名稱</th><th>版次</th><th>日期</th></tr></thead>
                 <tbody>
                    {filteredDocs.map(d => {
                      const { ver, date, name } = parseDocDetails(d);
                      return (
                        <tr key={d.id}>
                          <td style={{color:'var(--iso-accent)', fontWeight:800}}>{d.doc_number}</td>
                          <td style={{fontWeight:700}}>{name}</td>
                          <td>{ver}</td>
                          <td style={{color:'#64748b'}}>{date}</td>
                        </tr>
                      );
                    })}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ISO17025System;
