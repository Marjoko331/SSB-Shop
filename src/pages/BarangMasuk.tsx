import React, { useState } from 'react';
import { Product, InboundTransaction, StoreSettings, Transaction } from '../types';
import { ArrowDownToLine, Search, Plus, Calendar, ListChecks, FileText, RefreshCw, Download, FileDown, Edit2, Trash2, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastContext';

interface BarangMasukProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  inboundTransactions: InboundTransaction[];
  setInboundTransactions: React.Dispatch<React.SetStateAction<InboundTransaction[]>>;
  settings: StoreSettings;
  activeTab: 'entri' | 'rekap';
  transactions?: Transaction[];
}

export default function BarangMasuk({ products, setProducts, inboundTransactions, setInboundTransactions, settings, activeTab, transactions = [] }: BarangMasukProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [transactionToDelete, setTransactionToDelete] = useState<string | 'multiple' | null>(null);
  const [transactionToEdit, setTransactionToEdit] = useState<InboundTransaction | null>(null);
  const [isProductInUse, setIsProductInUse] = useState<boolean>(false);
  const { showToast } = useToast();

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTransactions = inboundTransactions
    .filter((trx) => {
      if (!startDate && !endDate) return true;
      const trxDate = new Date(trx.date).getTime();
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() : Infinity;
      return trxDate >= start && trxDate <= end;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || quantity <= 0 || !date) return;

    const newStock = selectedProduct.stock + quantity;

    setProducts((prev) =>
      prev.map((p) =>
        p.id === selectedProduct.id ? { ...p, stock: newStock } : p
      )
    );

    let maxId = 0;
    inboundTransactions.forEach(t => {
      if (t.id.startsWith('BM-')) {
        const numStr = t.id.substring(3);
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }
    });
    const nextId = maxId + 1;

    const newTransaction: InboundTransaction = {
      id: `BM-${nextId}`,
      date: new Date(date).toISOString(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: quantity,
      currentStock: newStock,
    };

    setInboundTransactions((prev) => [newTransaction, ...prev]);

    if (supabase) {
      try {
        const { error: updateError } = await supabase.from('products').update({ stock: newStock }).eq('id', selectedProduct.id);
        if (updateError) throw updateError;
        
        const { error: insertError } = await supabase.from('inbound_transactions').insert({
          id: newTransaction.id,
          date: newTransaction.date,
          product_id: newTransaction.productId,
          product_name: newTransaction.productName,
          quantity: newTransaction.quantity,
          current_stock: newTransaction.currentStock
        });
        if (insertError) throw insertError;
      } catch (error: any) {
        console.error('Error saving inbound transaction to Supabase:', error);
        showToast('Gagal menyimpan barang masuk ke database: ' + error.message, 'error');
        return;
      }
    }

    showToast(`Berhasil menambahkan ${quantity} stok untuk ${selectedProduct.name} pada tanggal ${date}`, 'success');
    setSelectedProduct(null);
    setQuantity(0);
    setSearchQuery('');
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

  const handleDeleteClick = (id: string) => {
    const trx = inboundTransactions.find(t => t.id === id);
    if (trx) {
      const isUsed = transactions.some(t => t.items.some(item => item.id === trx.productId));
      setIsProductInUse(isUsed);
    }
    setTransactionToDelete(id);
  };

  const handleDeleteSelectedClick = () => {
    const isAnyUsed = inboundTransactions
      .filter(t => selectedIds.includes(t.id))
      .some(trx => transactions.some(t => t.items.some(item => item.id === trx.productId)));
    setIsProductInUse(isAnyUsed);
    setTransactionToDelete('multiple');
  };

  const handleDeleteConfirm = async () => {
    const idsToDelete = transactionToDelete === 'multiple' ? selectedIds : [transactionToDelete as string];
    
    // Find transactions to delete to adjust stock
    const transactionsToDelete = inboundTransactions.filter(t => idsToDelete.includes(t.id));
    
    // Update local state
    setInboundTransactions(prev => prev.filter(t => !idsToDelete.includes(t.id)));
    setSelectedIds(prev => prev.filter(id => !idsToDelete.includes(id)));
    setTransactionToDelete(null);

    // Adjust product stock locally
    setProducts(prev => prev.map(p => {
      const deletedForProduct = transactionsToDelete.filter(t => t.productId === p.id);
      if (deletedForProduct.length > 0) {
        const totalDeletedQuantity = deletedForProduct.reduce((sum, t) => sum + t.quantity, 0);
        return { ...p, stock: Math.max(0, p.stock - totalDeletedQuantity) };
      }
      return p;
    }));

    if (supabase) {
      try {
        // Update stock in Supabase
        for (const p of products) {
          const deletedForProduct = transactionsToDelete.filter(t => t.productId === p.id);
          if (deletedForProduct.length > 0) {
            const totalDeletedQuantity = deletedForProduct.reduce((sum, t) => sum + t.quantity, 0);
            const newStock = Math.max(0, p.stock - totalDeletedQuantity);
            await supabase.from('products').update({ stock: newStock }).eq('id', p.id);
          }
        }
        
        // Delete transactions
        const { error } = await supabase.from('inbound_transactions').delete().in('id', idsToDelete);
        if (error) throw error;
        showToast('Riwayat barang masuk berhasil dihapus!', 'success');
      } catch (error: any) {
        console.error('Error deleting inbound transactions from Supabase:', error);
        showToast('Gagal menghapus riwayat dari database: ' + error.message, 'error');
      }
    } else {
      showToast('Riwayat barang masuk berhasil dihapus!', 'success');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionToEdit) return;

    const originalTransaction = inboundTransactions.find(t => t.id === transactionToEdit.id);
    if (!originalTransaction) return;

    const quantityDiff = transactionToEdit.quantity - originalTransaction.quantity;

    // Update local state
    setInboundTransactions(prev => prev.map(t => t.id === transactionToEdit.id ? transactionToEdit : t));
    
    // Adjust product stock locally
    setProducts(prev => prev.map(p => {
      if (p.id === transactionToEdit.productId) {
        return { ...p, stock: Math.max(0, p.stock + quantityDiff) };
      }
      return p;
    }));
    
    if (supabase) {
      try {
        // Update transaction
        const { error: txError } = await supabase.from('inbound_transactions').update({
          date: transactionToEdit.date,
          quantity: transactionToEdit.quantity
        }).eq('id', transactionToEdit.id);
        
        if (txError) throw txError;

        // Update product stock
        const product = products.find(p => p.id === transactionToEdit.productId);
        if (product) {
          const newStock = Math.max(0, product.stock + quantityDiff);
          const { error: pError } = await supabase.from('products').update({ stock: newStock }).eq('id', product.id);
          if (pError) throw pError;
        }
        showToast('Riwayat barang masuk berhasil diperbarui!', 'success');
      } catch (error: any) {
        console.error('Error updating inbound transaction in Supabase:', error);
        showToast('Gagal mengupdate riwayat di database: ' + error.message, 'error');
      }
    } else {
      showToast('Riwayat barang masuk berhasil diperbarui!', 'success');
    }
    
    setTransactionToEdit(null);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    
    const formatDate = (dateString: string) => {
      if (!dateString) return '';
      const d = new Date(dateString);
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    };

    let periodText = 'Semua Waktu';
    if (startDate && endDate) {
      periodText = `${formatDate(startDate)} sampai ${formatDate(endDate)}`;
    } else if (startDate) {
      periodText = `Mulai ${formatDate(startDate)}`;
    } else if (endDate) {
      periodText = `Sampai ${formatDate(endDate)}`;
    }

    const tableRows: any[] = filteredTransactions.map((trx, index) => [
      index + 1,
      formatDate(trx.date),
      trx.productId,
      trx.productName,
      trx.quantity
    ]);

    // Calculate total quantity
    const totalQuantity = filteredTransactions.reduce((sum, trx) => sum + trx.quantity, 0);

    // Add total row
    tableRows.push([
      { content: 'TOTAL', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold' } },
      { content: totalQuantity.toString(), styles: { fontStyle: 'bold', halign: 'center' } }
    ]);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN BARANG MASUK', 105, 15, { align: 'center' });
    
    doc.setFontSize(16);
    doc.text(settings.storeName.toUpperCase(), 105, 23, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.text(settings.storeAddress || 'Alamat Toko', 105, 29, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periode : ${periodText}`, 15, 40);

    autoTable(doc, {
      head: [
        [
          { content: 'No.\nUrut', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Tgl. Barang\nMasuk', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'ID Barang', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Nama Barang', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Jml. Barang\nMasuk', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } }
        ]
      ],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      styles: { 
        fontSize: 11, 
        cellPadding: 3,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        font: 'helvetica'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { halign: 'center', cellWidth: 35 },
        2: { halign: 'center', cellWidth: 35 },
        3: { halign: 'left' },
        4: { halign: 'center', cellWidth: 30 }
      },
      margin: { top: 15, left: 15, right: 15 }
    });

    doc.save('Laporan_Barang_Masuk.pdf');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {activeTab === 'entri' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tanggal Barang Masuk
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="date"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pilih Barang
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Cari nama barang..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedProduct(null);
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedProduct(null);
                  }}
                  className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors border border-gray-200"
                  title="Refresh pencarian"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>

            {selectedProduct && (
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center gap-4">
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  className="w-16 h-16 rounded-lg object-cover bg-white border border-indigo-200"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h3 className="font-bold text-indigo-900">{selectedProduct.name}</h3>
                  <p className="text-sm text-indigo-700">Stok saat ini: {selectedProduct.stock}</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jumlah Masuk
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  required
                  disabled={!selectedProduct}
                  className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 transition-shadow text-lg font-medium"
                  value={quantity || ''}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                  pcs
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!selectedProduct || quantity <= 0}
              className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Simpan Stok
            </button>
          </form>
        </div>

        {/* Product Selection List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900">Daftar Barang</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => {
                  setSelectedProduct(product);
                  setSearchQuery(product.name);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                  selectedProduct?.id === product.id
                    ? 'bg-indigo-50 border border-indigo-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">{product.name}</h4>
                  <p className="text-sm text-gray-500">Stok: {product.stock}</p>
                </div>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                Tidak ada barang ditemukan.
              </div>
            )}
          </div>
        </div>
      </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Riwayat Barang Masuk
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                onClick={handleDownloadPDF}
                disabled={filteredTransactions.length === 0}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Unduh PDF"
              >
                <FileDown className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="date"
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    title="Dari Tanggal"
                  />
                </div>
                <span className="text-gray-500">-</span>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="date"
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    title="Sampai Tanggal"
                  />
                </div>
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Hapus filter"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
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
                    onClick={handleDeleteSelectedClick}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Hapus Terpilih
                  </button>
                )}
              </div>
            )}
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 w-10"></th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">No. Urut</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">Tgl. Barang Masuk</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">ID Barang</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">Nama Barang</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-center">Jml. Barang Masuk</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTransactions.map((trx, index) => (
                  <tr key={trx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleSelect(trx.id)}
                        className="text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        {selectedIds.includes(trx.id) ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{index + 1}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {new Date(trx.date).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-mono">{trx.productId}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{trx.productName}</td>
                    <td className="px-6 py-4 text-sm text-indigo-600 font-medium text-center">
                      +{trx.quantity}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setTransactionToEdit(trx)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(trx.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      {(startDate || endDate) ? 'Tidak ada riwayat barang masuk pada rentang tanggal tersebut.' : 'Belum ada riwayat barang masuk.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {transactionToDelete && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isProductInUse ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {isProductInUse ? 'Tidak Dapat Menghapus' : 'Hapus Riwayat'}
              </h3>
              <p className="text-gray-500 text-sm mb-6">
                {isProductInUse 
                  ? (transactionToDelete === 'multiple' ? "Beberapa barang dari riwayat yang dipilih sudah pernah dibeli (ada di riwayat transaksi). Untuk menjaga data riwayat transaksi, riwayat barang masuk tersebut tidak dapat dihapus." : "Barang dari riwayat ini sudah pernah dibeli (ada di riwayat transaksi). Untuk menjaga data riwayat transaksi, riwayat barang masuk ini tidak dapat dihapus.")
                  : (transactionToDelete === 'multiple' ? `Apakah Anda yakin ingin menghapus ${selectedIds.length} riwayat terpilih? Stok barang akan dikurangi sesuai jumlah barang masuk yang dihapus.` : "Apakah Anda yakin ingin menghapus riwayat ini? Stok barang akan dikurangi sesuai jumlah barang masuk yang dihapus.")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setTransactionToDelete(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  {isProductInUse ? 'Kembali' : 'Batal'}
                </button>
                {!isProductInUse && (
                  <button
                    onClick={handleDeleteConfirm}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                  >
                    Hapus
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {transactionToEdit && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Edit Riwayat Barang Masuk</h2>
              <button
                onClick={() => setTransactionToEdit(null)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                <RefreshCw className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Barang</label>
                <input
                  type="text"
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  value={transactionToEdit.productName}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Barang Masuk</label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={transactionToEdit.date.split('T')[0]}
                  onChange={(e) => setTransactionToEdit({
                    ...transactionToEdit, 
                    date: new Date(e.target.value).toISOString()
                  })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Masuk</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={transactionToEdit.quantity}
                  onChange={(e) => setTransactionToEdit({
                    ...transactionToEdit, 
                    quantity: Number(e.target.value)
                  })}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setTransactionToEdit(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
