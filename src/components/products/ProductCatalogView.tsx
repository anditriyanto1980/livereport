import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import { Product, LiveSession } from '../../types';
import { formatIDR, formatNumber } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { addProduct, updateProduct, deleteProduct } from '../../services/firestoreService';

interface ProductCatalogViewProps {
  products: Product[];
  sessions: LiveSession[];
}

export const ProductCatalogView: React.FC<ProductCatalogViewProps> = ({
  products,
  sessions,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formCategory, setFormCategory] = useState('Fashion Muslim');
  const [formPrice, setFormPrice] = useState<number>(100000);
  const [formStock, setFormStock] = useState<number>(100);
  const [submitting, setSubmitting] = useState(false);

  // Sales aggregation per product from live sessions
  const salesMap = useMemo(() => {
    const map: Record<string, { quantity: number; revenue: number }> = {};
    sessions.forEach((s) => {
      s.productDetails?.forEach((item) => {
        if (!map[item.productId]) {
          map[item.productId] = { quantity: 0, revenue: 0 };
        }
        map[item.productId].quantity += item.quantity || 0;
        map[item.productId].revenue += item.revenue || 0;
      });
    });
    return map;
  }, [sessions]);

  // Combined product stats
  const productStats = useMemo(() => {
    return products
      .map((p) => {
        const sales = salesMap[p.id] || { quantity: 0, revenue: 0 };
        return {
          ...p,
          soldInLive: sales.quantity,
          revenueFromLive: sales.revenue,
        };
      })
      .filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => b.revenueFromLive - a.revenueFromLive);
  }, [products, salesMap, searchQuery]);

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormSku(`SKU-${Date.now().toString().slice(-4)}`);
    setFormCategory('Fashion');
    setFormPrice(150000);
    setFormStock(100);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: any) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormSku(p.sku);
    setFormCategory(p.category);
    setFormPrice(p.price);
    setFormStock(p.stock ?? 100);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formSku) return;

    setSubmitting(true);
    try {
      if (editingProduct) {
        await updateProduct(
          editingProduct.id,
          {
            name: formName,
            sku: formSku,
            category: formCategory,
            price: Number(formPrice) || 0,
            stock: Number(formStock) || 0,
          },
          currentUser?.displayName || 'User',
          currentUser?.uid || 'uid'
        );
      } else {
        await addProduct(
          {
            name: formName,
            sku: formSku,
            category: formCategory,
            price: Number(formPrice) || 0,
            stock: Number(formStock) || 0,
            status: 'active',
          },
          currentUser?.displayName || 'User',
          currentUser?.uid || 'uid'
        );
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving product:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Yakin ingin menghapus produk "${name}"?`)) {
      await deleteProduct(id, name, currentUser?.displayName || 'User', currentUser?.uid || 'uid');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl clay-sphere-orange flex items-center justify-center text-white shadow-xs">
              <Package className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight">
                Katalog Produk & Penjualan Live
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Daftar SKU produk dan monitoring perolehan omset yang dihasilkan dari sesi Shopee Live.
              </p>
            </div>
          </div>

          {isAdmin && (
            <button
              type="button"
              id="add-product-btn"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Produk Baru</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama atau SKU produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total Katalog: <strong className="text-slate-800">{products.length}</strong> Produk
          </span>
        </div>
      </div>

      {/* PRODUCTS TABLE */}
      <div className="clay-card p-6 space-y-4">
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-600 bg-slate-50 border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-3.5">Produk & SKU</th>
                <th className="py-3 px-3.5">Kategori</th>
                <th className="py-3 px-3.5 text-right">Harga Jual</th>
                <th className="py-3 px-3.5 text-right">Stok</th>
                <th className="py-3 px-3.5 text-right">Terjual di Live</th>
                <th className="py-3 px-3.5 text-right">Total Omset Live</th>
                {isAdmin && <th className="py-3 px-3.5 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {productStats.map((p) => (
                <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-3.5">
                    <div className="font-bold text-slate-800">{p.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                  </td>
                  <td className="py-3 px-3.5">
                    <span className="px-2.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                      {p.category}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-right font-semibold text-slate-800">
                    {formatIDR(p.price)}
                  </td>
                  <td className="py-3 px-3.5 text-right text-slate-600 font-medium">{p.stock} pcs</td>
                  <td className="py-3 px-3.5 text-right font-bold text-blue-600">
                    {formatNumber(p.soldInLive)} pcs
                  </td>
                  <td className="py-3 px-3.5 text-right font-black text-emerald-600">
                    {formatIDR(p.revenueFromLive)}
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(p)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Produk"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id, p.name)}
                          className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Hapus Produk"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT PRODUCT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800">
                {editingProduct ? 'Edit Data Produk' : 'Tambah Produk Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nama Produk</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Gamis Rayon Premium Polos"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">SKU</label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Kategori</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Harga (IDR)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Stok Awal</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formStock}
                    onChange={(e) => setFormStock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white rounded-xl shadow-md transition-all active:scale-95"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
