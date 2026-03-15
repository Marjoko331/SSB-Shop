import React, { useState } from 'react';
import { Transaction, StoreSettings, Product } from '../types';
import { Receipt, Search, Calendar, ChevronDown, ChevronUp, Printer, RefreshCw, Trash2, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import ReceiptModal from '../components/ReceiptModal';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastContext';

interface RekapPenjualanProps {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  settings: StoreSettings;
}

export default function RekapPenjualan({ transactions, setTransactions, products, setProducts, settings }: RekapPenjualanProps) {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [printingTransaction, setPrintingTransaction] = useState<Transaction | null>(null);
  const { showToast } = useToast();
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [transactionToDelete, setTransactionToDelete] = useState<string | 'multiple' | null>(null);

  const filteredTransactions = transactions
    .filter((t) => {
      // Date filter
      if (startDate || endDate) {
        const tDate = new Date(t.date).getTime();
        const start = startDate ? new Date(startDate).getTime() : 0;
        const end = endDate ? new Date(endDate).getTime() + 86399999 : Infinity;
        if (tDate < start || tDate > end) return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchId = t.id.toLowerCase().includes(query);
        const matchCustomer = t.customerName?.toLowerCase().includes(query) || false;
        const matchItems = t.items.some(item => item.name.toLowerCase().includes(query));
        
        if (!matchId && !matchCustomer && !matchItems) return false;
      }

      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTransactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTransactions.map(t => t.id));
    }
  };

  const handleDeleteConfirm = async () => {
    const idsToDelete = transactionToDelete === 'multiple' ? selectedIds : [transactionToDelete as string];
    
    // Restore stock for deleted transactions
    const transactionsToDelete = transactions.filter(t => idsToDelete.includes(t.id));
    
    // Update local state first
    setTransactions(prev => prev.filter(t => !idsToDelete.includes(t.id)));
    setSelectedIds(prev => prev.filter(id => !idsToDelete.includes(id)));
    setTransactionToDelete(null);

    if (supabase) {
      try {
        // Restore stock in Supabase
        for (const t of transactionsToDelete) {
          for (const item of t.items) {
            const product = products.find(p => p.id === item.id);
            if (product) {
              await supabase.from('products')
                .update({ stock: product.stock + item.quantity })
                .eq('id', item.id);
            }
          }
        }
        
        // Delete transactions (transaction_items will be deleted by CASCADE if set up, otherwise we should delete them first)
        // Assuming CASCADE is set up on transaction_items.transaction_id
        const { error } = await supabase.from('transactions').delete().in('id', idsToDelete);
        if (error) throw error;
        showToast('Transaksi berhasil dihapus!', 'success');
      } catch (error: any) {
        console.error('Error deleting transactions from Supabase:', error);
        showToast('Gagal menghapus transaksi dari database: ' + error.message, 'error');
      }
    } else {
      showToast('Transaksi berhasil dihapus!', 'success');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {printingTransaction && (
        <ReceiptModal
          transaction={printingTransaction}
          settings={settings}
          onClose={() => setPrintingTransaction(null)}
        />
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rekap Nota</h1>
            <p className="text-gray-500 text-sm">Riwayat transaksi toko</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari Nota, Pembeli, Barang..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-40">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="Dari Tanggal"
              />
            </div>
            <span className="text-gray-500">-</span>
            <div className="relative w-full sm:w-40">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="Sampai Tanggal"
              />
            </div>
          </div>
          {(startDate || endDate || searchQuery) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSearchQuery('');
              }}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
              title="Hapus filter"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredTransactions.length > 0 && (
          <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="text-gray-500 hover:text-indigo-600 transition-colors"
                title={selectedIds.length === filteredTransactions.length ? "Batal pilih semua" : "Pilih semua"}
              >
                {selectedIds.length > 0 && selectedIds.length === filteredTransactions.length ? (
                  <CheckSquare className="w-5 h-5 text-indigo-600" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
              </button>
              <span className="text-sm font-medium text-gray-600">
                {selectedIds.length > 0 ? `${selectedIds.length} dipilih` : 'Pilih Semua'}
              </span>
            </div>
            {selectedIds.length > 0 && (
              <button
                onClick={() => setTransactionToDelete('multiple')}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Hapus Terpilih
              </button>
            )}
          </div>
        )}
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-4">
            <Receipt className="w-16 h-16 opacity-20" />
            <p className="text-lg">Belum ada transaksi.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTransactions.map((t) => (
              <div key={t.id} className="group">
                <div
                  onClick={() => toggleExpand(t.id)}
                  className="p-4 sm:px-6 hover:bg-gray-50 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(t.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors mt-1 sm:mt-0"
                    >
                      {selectedIds.includes(t.id) ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <div className="p-2 bg-gray-100 rounded-lg shrink-0">
                      <Receipt className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {t.id}
                        {t.customerName && (
                          <span className="ml-2 text-sm font-normal text-gray-500">
                            • {t.customerName}
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(t.date), 'dd MMM yyyy, HH:mm', { locale: id })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6 sm:gap-8">
                    <div className="text-left sm:text-right">
                      <div className="text-sm text-gray-500 mb-1">Total Belanja</div>
                      <div className="font-bold text-indigo-600">
                        Rp {t.total.toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          t.paymentMethod === 'Cash'
                            ? 'bg-green-100 text-green-700'
                            : t.paymentMethod === 'QRIS'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {t.paymentMethod}
                      </span>
                      <div className="flex items-center gap-1 border-l border-gray-200 pl-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTransactionToDelete(t.id);
                          }}
                          className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {expandedId === t.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                      )}
                    </div>
                  </div>
                </div>

                {expandedId === t.id && (
                  <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-100">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-4 text-sm uppercase tracking-wider">
                          Detail Pesanan
                        </h4>
                        <div className="space-y-3">
                          {t.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                  {item.quantity}x
                                </span>
                                <span className="font-medium text-gray-900">{item.name}</span>
                              </div>
                              <span className="text-gray-600">
                                Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-xl border border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-4 text-sm uppercase tracking-wider">
                          Rincian Pembayaran
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between font-bold text-gray-900 text-base">
                            <span>Total</span>
                            <span>Rp {t.total.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between text-gray-600">
                            <span>Tunai / Dibayar</span>
                            <span>Rp {t.amountPaid.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>Kembalian</span>
                            <span className="font-medium text-green-600">
                              Rp {t.change.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setPrintingTransaction(t)}
                          className="w-full mt-6 bg-indigo-50 text-indigo-600 py-2.5 rounded-lg font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <Printer className="w-4 h-4" />
                          Cetak Struk
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {transactionToDelete && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Hapus Transaksi</h3>
              <p className="text-gray-500 text-sm mb-6">
                {transactionToDelete === 'multiple' 
                  ? `Apakah Anda yakin ingin menghapus ${selectedIds.length} transaksi terpilih? Stok barang akan dikembalikan.`
                  : 'Apakah Anda yakin ingin menghapus transaksi ini? Stok barang akan dikembalikan.'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setTransactionToDelete(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
