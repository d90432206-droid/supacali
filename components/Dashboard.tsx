import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { Order, CalibrationStatus, StatusLabel } from '../types';
import { StatCard } from './StatCard';
import { DollarSign, Activity, CheckCircle, Clock, Filter } from 'lucide-react';

interface DashboardProps {
  orders: Order[];
}

// CIS Brand Colors - Monochromatic/Analogous Theme
const BRAND_COLORS = ['#0f766e', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#ccfbf1'];
const STATUS_COLORS = ['#fbbf24', '#818cf8', '#10b981']; 

export const Dashboard: React.FC<DashboardProps> = ({ orders }) => {
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // Extract available years
  const availableYears = useMemo(() => {
    const years = new Set(orders.map(o => new Date(o.createDate).getFullYear().toString()));
    return Array.from(years).sort().reverse();
  }, [orders]);

  // Filter orders based on year
  const filteredOrders = useMemo(() => {
    if (selectedYear === 'all') return orders;
    return orders.filter(o => new Date(o.createDate).getFullYear().toString() === selectedYear);
  }, [orders, selectedYear]);

  // Group orders by Order Number for work-order based statistics
  const groupedOrders = useMemo(() => {
    const groups = new Map<string, { totalAmount: number, status: CalibrationStatus, technicians: string[] }>();
    filteredOrders.forEach(o => {
      if (!groups.has(o.orderNumber)) {
        groups.set(o.orderNumber, { 
          totalAmount: 0, 
          status: o.status, 
          technicians: o.technicians || [] 
        });
      }
      const g = groups.get(o.orderNumber)!;
      g.totalAmount += (o.totalAmount || 0);
    });
    return Array.from(groups.values());
  }, [filteredOrders]);

  const stats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const active = groupedOrders.filter(g => g.status !== CalibrationStatus.COMPLETED).length;
    const completed = groupedOrders.filter(g => g.status === CalibrationStatus.COMPLETED).length;
    const pendingVal = groupedOrders
      .filter(g => g.status !== CalibrationStatus.COMPLETED)
      .reduce((sum, g) => sum + g.totalAmount, 0);

    return { totalRevenue, active, completed, pendingVal };
  }, [filteredOrders, groupedOrders]);

  const revenueData = useMemo(() => {
    const map = new Map<string, number>();
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    
    months.forEach(m => map.set(m, 0));

    filteredOrders.forEach(order => {
      const date = new Date(order.createDate);
      const month = months[date.getMonth()];
      map.set(month, (map.get(month) || 0) + (order.totalAmount || 0));
    });

    return Array.from(map).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    groupedOrders.forEach(g => {
      const label = StatusLabel[g.status] || g.status;
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map).map(([name, value]) => ({ name, value }));
  }, [groupedOrders]);

  const technicianData = useMemo(() => {
    const map = new Map<string, number>();
    groupedOrders.forEach(g => {
      const techs = (g.technicians && g.technicians.length > 0) ? g.technicians : ['未指派'];
      const shareAmount = g.totalAmount / techs.length;
      techs.forEach(tech => {
        map.set(tech, (map.get(tech) || 0) + shareAmount);
      });
    });
    // Sort by value desc
    return Array.from(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [groupedOrders]);

  const categoryData = useMemo(() => {
    const map = new Map<string, { revenue: number, count: number }>();
    filteredOrders.forEach(o => {
      const cat = o.category || '未分類';
      const current = map.get(cat) || { revenue: 0, count: 0 };
      map.set(cat, {
        revenue: current.revenue + (o.totalAmount || 0),
        count: current.count + (o.quantity || 1)
      });
    });
    return Array.from(map)
      .map(([name, data]) => ({ 
        name, 
        revenue: data.revenue, 
        count: data.count 
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 border-l-4 border-brand-600 pl-3">營運儀表板</h2>
          <p className="text-slate-500 text-sm mt-1 pl-4">即時追蹤校正中心關鍵績效指標 (KPI)</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="relative">
                <Filter className="absolute left-3 top-2 text-slate-400" size={16} />
                <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="pl-9 pr-4 py-1.5 border border-slate-300 rounded-md text-sm font-medium text-slate-700 focus:ring-2 focus:ring-brand-500 outline-none bg-white shadow-sm"
                >
                    <option value="all">所有年度</option>
                    {availableYears.map(year => (
                        <option key={year} value={year}>{year}年度</option>
                    ))}
                </select>
            </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="期間總營收" 
          value={`$${stats.totalRevenue.toLocaleString()}`} 
          icon={<DollarSign size={20} />} 
        />
        <StatCard 
          title="進行中工單" 
          value={stats.active} 
          icon={<Activity size={20} />} 
        />
        <StatCard 
          title="已完成案件" 
          value={stats.completed} 
          icon={<CheckCircle size={20} />} 
        />
        <StatCard 
          title="待入帳金額" 
          value={`$${stats.pendingVal.toLocaleString()}`} 
          icon={<Clock size={20} />} 
        />
      </div>

      {/* Main Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span className="w-1 h-5 bg-brand-500 rounded-full"></span>
            營收趨勢分析 {selectedYear !== 'all' && `(${selectedYear})`}
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip 
                  contentStyle={{borderRadius: '4px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'}} 
                  formatter={(val: number) => [`$${val.toLocaleString()}`, '營收']}
                />
                <Area type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" activeDot={{r: 6}} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Donut Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span className="w-1 h-5 bg-brand-500 rounded-full"></span>
            案件狀態分佈
          </h3>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{borderRadius: '4px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Technician Stats Row 2 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span className="w-1 h-5 bg-brand-500 rounded-full"></span>
            校正人員績效統計 (總金額)
        </h3>
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={technicianData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{fill: '#475569', fontSize: 13, fontWeight: 500}} axisLine={false} tickLine={false} />
                    <Tooltip 
                        cursor={{fill: '#f0fdfa'}}
                        contentStyle={{borderRadius: '4px', border: '1px solid #e2e8f0'}}
                        formatter={(val: number) => [`$${val.toLocaleString()}`, '校正金額']}
                    />
                    <Bar dataKey="value" fill="#0f766e" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Category Performance Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-1 h-5 bg-brand-500 rounded-full"></span>
                服務項目分類：營收統計
            </h3>
            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `$${val/1000}k`} />
                        <Tooltip 
                            contentStyle={{borderRadius: '4px', border: '1px solid #e2e8f0'}}
                            formatter={(val: number) => [`$${val.toLocaleString()}`, '營收']}
                        />
                        <Bar dataKey="revenue" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-1 h-5 bg-brand-500 rounded-full"></span>
                服務項目分類：件數統計
            </h3>
            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <Tooltip 
                            contentStyle={{borderRadius: '4px', border: '1px solid #e2e8f0'}}
                            formatter={(val: number) => [`${val} 件`, '校正數量']}
                        />
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>
    </div>
  );
};