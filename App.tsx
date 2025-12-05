
import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { OrderForm } from './components/OrderForm';
import { OrderList } from './components/OrderList';
import { Sidebar } from './components/Sidebar';
import { Inventory } from './components/Inventory';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { ViewState, Order, OrderTemplate, AuthUser, UserRole } from './types';
import { mockGasService } from './services/mockGasService';
import { Menu } from 'lucide-react';

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<AuthUser>({ role: 'guest', name: '', isAuthenticated: false });

  // App State
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [copyOrderData, setCopyOrderData] = useState<OrderTemplate | null>(null);

  const fetchOrders = async () => {
    if (!user.isAuthenticated) return;
    const data = await mockGasService.getOrders();
    setOrders(data);
  };

  useEffect(() => {
    if (user.isAuthenticated) {
        fetchOrders();
    }
  }, [user.isAuthenticated]);

  const handleLogin = (role: UserRole, name: string) => {
      setUser({ role, name, isAuthenticated: true });
  };

  const handleLogout = () => {
      setUser({ role: 'guest', name: '', isAuthenticated: false });
      setCurrentView('dashboard');
  };

  const handleOrderCreated = () => {
    fetchOrders();
    setCopyOrderData(null); 
    setCurrentView('order-list'); 
  };

  const handleCopyOrder = (template: OrderTemplate) => {
      setCopyOrderData(template);
      setCurrentView('create-order');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard orders={orders} />;
      case 'create-order':
        return <OrderForm onOrderCreated={handleOrderCreated} copyData={copyOrderData} />;
      case 'order-list':
        return <OrderList orders={orders} refreshData={fetchOrders} onCopyOrder={handleCopyOrder} />;
      case 'inventory':
        return <Inventory />;
      case 'settings':
        return <Settings />; // Now accessible to everyone, but internal actions might be gated
      default:
        return <Dashboard orders={orders} />;
    }
  };

  const handleViewChange = (view: ViewState) => {
      if (view !== 'create-order') {
          setCopyOrderData(null);
      }
      setCurrentView(view);
      setIsMobileMenuOpen(false);
  }

  // --- Auth Gate ---
  if (!user.isAuthenticated) {
      return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
         <div className="fixed inset-0 z-40 bg-slate-900/50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar - Desktop & Mobile */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar 
            currentView={currentView} 
            setView={handleViewChange} 
            user={user}
            onLogout={handleLogout}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 p-4 sticky top-0 z-30">
           <div className="flex items-center gap-2 font-bold text-slate-800">
             制宜電測校正系統
           </div>
           <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600">
             <Menu />
           </button>
        </div>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
           <div className="max-w-7xl mx-auto animate-fade-in">
             {renderContent()}
           </div>
        </main>

      </div>
    </div>
  );
};

export default App;
