
import React, { useState, useEffect } from 'react';
import { ShieldCheck, User, ArrowRight, Lock, Users } from 'lucide-react';
import { mockGasService } from '../services/mockGasService';
import { Technician } from '../types';

interface LoginProps {
  onLogin: (role: 'admin' | 'engineer', name: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [role, setRole] = useState<'selection' | 'admin' | 'engineer'>('selection');
  const [password, setPassword] = useState('');
  const [selectedTech, setSelectedTech] = useState('');
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load technicians for the dropdown
    mockGasService.getTechnicians().then(setTechnicians);
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const isValid = await mockGasService.verifyAdminPassword(password);
    if (isValid) {
        onLogin('admin', 'Administrator');
    } else {
        setError('管理員密碼錯誤');
    }
    setLoading(false);
  };

  const handleEngineerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTech) {
        setError('請選擇您的姓名');
        return;
    }
    setLoading(true);
    setError('');

    const isValid = await mockGasService.verifyEngineerPassword(selectedTech, password);
    if (isValid) {
        onLogin('engineer', selectedTech);
    } else {
        setError('密碼錯誤');
    }
    setLoading(false);
  };

  if (role === 'selection') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
         <div className="mb-8 text-center animate-fade-in">
             <div className="w-16 h-16 bg-brand-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-brand-500/20">
                 <span className="text-3xl font-bold text-white">CC</span>
             </div>
             <h1 className="text-2xl font-bold text-white">制宜電測校正系統</h1>
             <p className="text-slate-400 text-sm mt-2">請選擇您的登入身分</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
             <button 
                onClick={() => setRole('engineer')}
                className="group relative overflow-hidden bg-slate-800 hover:bg-slate-700 p-6 rounded-xl border border-slate-700 hover:border-brand-500 transition-all text-left"
             >
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Users size={64} className="text-white" />
                 </div>
                 <div className="bg-brand-900/50 w-12 h-12 rounded-lg flex items-center justify-center text-brand-400 mb-4 group-hover:scale-110 transition-transform">
                     <User size={24} />
                 </div>
                 <h3 className="text-lg font-bold text-white mb-1">工程師 (Engineer)</h3>
                 <p className="text-slate-400 text-xs">執行校正作業、建立工單與庫存管理</p>
             </button>

             <button 
                onClick={() => setRole('admin')}
                className="group relative overflow-hidden bg-slate-800 hover:bg-slate-700 p-6 rounded-xl border border-slate-700 hover:border-red-500 transition-all text-left"
             >
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <ShieldCheck size={64} className="text-white" />
                 </div>
                 <div className="bg-red-900/30 w-12 h-12 rounded-lg flex items-center justify-center text-red-400 mb-4 group-hover:scale-110 transition-transform">
                     <ShieldCheck size={24} />
                 </div>
                 <h3 className="text-lg font-bold text-white mb-1">系統管理員 (Admin)</h3>
                 <p className="text-slate-400 text-xs">系統設定、權限管理與資料維護</p>
             </button>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className={`p-6 ${role === 'admin' ? 'bg-slate-900' : 'bg-brand-600'} text-white`}>
                <button onClick={() => { setRole('selection'); setError(''); }} className="text-xs font-bold opacity-70 hover:opacity-100 mb-4 flex items-center gap-1">
                    ← 返回選擇
                </button>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    {role === 'admin' ? <ShieldCheck /> : <User />}
                    {role === 'admin' ? '管理員登入' : '工程師登入'}
                </h2>
                <p className="text-sm opacity-80 mt-1">請輸入憑證以存取系統</p>
            </div>
            
            <form className="p-8 space-y-6" onSubmit={role === 'admin' ? handleAdminLogin : handleEngineerLogin}>
                {role === 'engineer' && (
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">選擇您的姓名</label>
                        <select 
                            value={selectedTech}
                            onChange={(e) => setSelectedTech(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none bg-slate-50"
                        >
                            <option value="">-- 請選擇 --</option>
                            {technicians.map(t => (
                                <option key={t.id} value={t.name}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">密碼</label>
                    <div className="relative">
                        <input 
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                            placeholder="請輸入密碼..."
                        />
                        <Lock className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 text-sm font-bold p-3 rounded-lg flex items-center gap-2 animate-pulse">
                        ⚠️ {error}
                    </div>
                )}

                <button 
                    type="submit"
                    disabled={loading}
                    className={`w-full py-3 rounded-lg text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                        role === 'admin' 
                        ? 'bg-slate-800 hover:bg-slate-900 shadow-slate-200' 
                        : 'bg-brand-600 hover:bg-brand-700 shadow-brand-200'
                    }`}
                >
                    {loading ? '驗證中...' : (
                        <>登入系統 <ArrowRight size={18} /></>
                    )}
                </button>
            </form>
        </div>
    </div>
  );
};
