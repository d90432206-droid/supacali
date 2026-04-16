
import React, { useEffect, useState } from 'react';
import { Product, AuthUser, CATEGORIES } from '../types';
import { mockGasService } from '../services/mockGasService';
import { Plus, Edit2, Save, X, Trash2, Search, Database, RefreshCcw } from 'lucide-react';

interface InventoryProps {
    user: AuthUser;
}

export const Inventory: React.FC<InventoryProps> = ({ user }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Product>>({});
    const [showAddForm, setShowAddForm] = useState(false);
    const [newProduct, setNewProduct] = useState({
        name: '',
        specification: '',
        category: '',
        standardPrice: 0
    });

    const isAdmin = user.role === 'admin';

    const loadProducts = async () => {
        setIsRefreshing(true);
        const data = await mockGasService.getInventory();
        setProducts(data);
        setIsRefreshing(false);
    };

    useEffect(() => {
        loadProducts();
    }, []);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.specification.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleEdit = (product: Product) => {
        setEditingId(product.id);
        setEditForm(product);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;
        await mockGasService.updateProduct(editingId, {
            name: editForm.name,
            specification: editForm.specification,
            category: editForm.category,
            standardPrice: editForm.standardPrice
        });
        setEditingId(null);
        loadProducts();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('確定要刪除此商品嗎？')) return;
        await mockGasService.deleteProduct(id);
        loadProducts();
    };

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        await mockGasService.addProduct(newProduct);
        setNewProduct({ name: '', specification: '', category: '', standardPrice: 0 });
        setShowAddForm(false);
        loadProducts();
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-brand-50 rounded-lg text-brand-600">
                        <Database size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">商品庫存管理系統</h2>
                        <p className="text-sm text-slate-500">
                            {isAdmin ? '您可以即時修改預設規格、價格與分類' : '查看校正品項與標準價格'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={loadProducts}
                        disabled={isRefreshing}
                        className="p-2.5 text-slate-500 hover:text-brand-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all disabled:opacity-50"
                        title="重新整理"
                    >
                        <RefreshCcw size={20} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-md shadow-brand-600/20 transition-all"
                        >
                            {showAddForm ? <X size={20} /> : <Plus size={20} />}
                            {showAddForm ? '取消新增' : '新增商品'}
                        </button>
                    )}
                </div>
            </div>

            {/* Add Product Form */}
            {showAddForm && isAdmin && (
                <div className="bg-white p-6 rounded-xl border-2 border-brand-500/20 shadow-lg animate-slide-up">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Plus size={18} className="text-brand-500" />
                        新增校正品項
                    </h3>
                    <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">商品名稱</label>
                            <input
                                required
                                type="text"
                                value={newProduct.name}
                                onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                placeholder="例如: 數位卡尺"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">規格 (Spec)</label>
                            <input
                                required
                                type="text"
                                value={newProduct.specification}
                                onChange={e => setNewProduct({ ...newProduct, specification: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                placeholder="例如: 0-150mm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">分類</label>
                            <select
                                required
                                value={newProduct.category}
                                onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                            >
                                <option value="" disabled>請選擇分類</option>
                                {CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">標準價格</label>
                                <input
                                    required
                                    type="number"
                                    value={newProduct.standardPrice}
                                    onChange={e => setNewProduct({ ...newProduct, standardPrice: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                                />
                            </div>
                            <button
                                type="submit"
                                className="bg-brand-600 text-white p-2.5 rounded-lg hover:bg-brand-700 transition-colors"
                            >
                                <Save size={20} />
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Main Table Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="搜尋品項、規格或分類..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">商品名稱</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">規格 (Spec)</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">分類</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">標準價格 (TWD)</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">最後更新</th>
                                {isAdmin && <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">操作</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredProducts.length > 0 ? (
                                filteredProducts.map(p => (
                                    <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors ${editingId === p.id ? 'bg-brand-50/30' : ''}`}>
                                        <td className="p-4">
                                            {editingId === p.id ? (
                                                <input
                                                    type="text"
                                                    value={editForm.name || ''}
                                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                    className="w-full px-2 py-1 border border-brand-300 rounded focus:ring-1 focus:ring-brand-500 outline-none"
                                                />
                                            ) : (
                                                <div className="font-bold text-slate-800">{p.name}</div>
                                            )}
                                        </td>
                                        <td className="p-4 text-slate-600 text-sm">
                                            {editingId === p.id ? (
                                                <input
                                                    type="text"
                                                    value={editForm.specification || ''}
                                                    onChange={e => setEditForm({ ...editForm, specification: e.target.value })}
                                                    className="w-full px-2 py-1 border border-brand-300 rounded focus:ring-1 focus:ring-brand-500 outline-none"
                                                />
                                            ) : (
                                                p.specification
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {editingId === p.id ? (
                                                <select
                                                    value={editForm.category || ''}
                                                    onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                                    className="w-full px-2 py-1 border border-brand-300 rounded focus:ring-1 focus:ring-brand-500 outline-none bg-white"
                                                >
                                                    {CATEGORIES.map(cat => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-bold">
                                                    {p.category}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 font-mono text-slate-700 font-bold">
                                            {editingId === p.id ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-slate-400">$</span>
                                                    <input
                                                        type="number"
                                                        value={editForm.standardPrice || 0}
                                                        onChange={e => setEditForm({ ...editForm, standardPrice: parseInt(e.target.value) || 0 })}
                                                        className="w-24 px-2 py-1 border border-brand-300 rounded focus:ring-1 focus:ring-brand-500 outline-none"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="text-emerald-700">${p.standardPrice.toLocaleString()}</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-slate-400 text-[11px] font-mono">
                                            {new Date(p.lastUpdated).toLocaleString('zh-TW', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        {isAdmin && (
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {editingId === p.id ? (
                                                        <>
                                                            <button
                                                                onClick={handleSaveEdit}
                                                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                                                title="儲存"
                                                            >
                                                                <Save size={18} />
                                                            </button>
                                                            <button
                                                                onClick={handleCancelEdit}
                                                                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors"
                                                                title="取消"
                                                            >
                                                                <X size={18} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleEdit(p)}
                                                                className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                                                                title="編輯品項"
                                                            >
                                                                <Edit2 size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(p.id)}
                                                                className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
                                                                title="刪除"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={isAdmin ? 6 : 5} className="p-12 text-center text-slate-400">
                                        查無相符商品品項
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
