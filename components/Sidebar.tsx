
import React, { useEffect, useState } from 'react';
import { ViewState, AuthUser } from '../types';
import { LayoutDashboard, PlusCircle, List, Settings, Database, LogOut, Wifi, WifiOff, Database as DatabaseIcon, ShieldCheck, User } from 'lucide-react';
import { mockGasService } from '../services/mockGasService';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  user: AuthUser;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, user, onLogout }) => {
  const [envType, setEnvType] = useState<'supabase' | 'mock'>('mock');
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setEnvType(mockGasService.getEnvironmentType());
  }, []);
  
  const NavItem = ({ view, icon, label }: { view: ViewState; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => setView(view)}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all mb-1 ${
        currentView === view 
          ? 'bg-brand-700 text-white shadow-md' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {icon}
      <span className="font-medium tracking-wide">{label}</span>
    </button>
  );

  const getStatusDisplay = () => {
      switch (envType) {
          case 'supabase':
              return {
                  bg: 'bg-emerald-900/30',
                  border: 'border-emerald-800',
                  text: 'text-emerald-400',
                  icon: <DatabaseIcon size={14} />,
                  label: 'Supabase 連線中'
              };
          default:
              return {
                  bg: 'bg-amber-900/30',
                  border: 'border-amber-800',
                  text: 'text-amber-500',
                  icon: <WifiOff size={14} />,
                  label: '未連線 (Mock Mode)'
              };
      }
  };

  const statusStyle = getStatusDisplay();

  return (
    <div className="w-full h-full bg-slate-900 flex flex-col p-4 text-slate-100">
      <div className="flex items-center gap-3 px-2 mb-8 mt-4">
        {/* Logo Image with Fallback */}
        <div className="flex-shrink-0">
            {!logoError ? (
                <img 
                    src="/logo.png" 
                    alt="Logo" 
                    className="h-10 w-auto object-contain"
                    onError={() => setLogoError(true)}
                />
            ) : (
                <div className="bg-brand-500 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-brand-500/20">
                    CC
                </div>
            )}
        </div>
        <div>
          <h1 className="font-bold text-white text-sm leading-tight tracking-tight">制宜電測校正管理系統</h1>
          <p className="text-[10px] text-brand-400 font-bold tracking-widest uppercase mt-0.5">Chuyi Calibration System</p>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="mb-6 mx-2 px-3 py-3 bg-slate-800 rounded-lg border border-slate-700 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${user.role === 'admin' ? 'bg-red-900/50 text-red-400' : 'bg-brand-900/50 text-brand-400'}`}>
              {user.role === 'admin' ? <ShieldCheck size={16} /> : <User size={16} />}
          </div>
          <div className="overflow-hidden">
              <div className="text-xs text-slate-400 font-bold uppercase">{user.role === 'admin' ? '管理員' : '工程師'}</div>
              <div className="text-sm font-bold text-white truncate">{user.name}</div>
          </div>
      </div>

      <nav className="flex-1 space-y-1">
        <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">主要功能</p>
        <NavItem view="dashboard" icon={<LayoutDashboard size={18} />} label="營運儀表板" />
        <NavItem view="create-order" icon={<PlusCircle size={18} />} label="建立校正訂單" />
        <NavItem view="order-list" icon={<List size={18} />} label="訂單追蹤" />
        
        <div className="my-6 border-t border-slate-800"></div>
        
        <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">資料庫管理</p>
        <NavItem view="inventory" icon={<Database size={18} />} label="商品庫存 (DB)" />
      </nav>

      <div className="mt-auto space-y-4">
         {/* Connection Status Indicator */}
         <div className={`mx-2 px-3 py-2 rounded-md border text-xs font-bold flex items-center gap-2 ${statusStyle.bg} ${statusStyle.border} ${statusStyle.text}`}>
            {statusStyle.icon}
            <span>{statusStyle.label}</span>
         </div>

         <div className="pt-2 border-t border-slate-800">
            <button 
                onClick={() => setView('settings')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors hover:bg-slate-800 ${currentView === 'settings' ? 'bg-brand-700 text-white shadow-md' : 'text-slate-400'}`}
            >
                <Settings size={18} />
                <span className="font-medium">系統設定</span>
            </button>
            <button 
                onClick={onLogout}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-400 hover:text-red-400 transition-colors mt-1"
            >
                <LogOut size={18} />
                <span className="font-medium">登出系統</span>
            </button>
         </div>
      </div>
    </div>
  );
};
