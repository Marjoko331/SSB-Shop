import React, { useMemo, useState } from 'react';
import { Transaction, Product, InboundTransaction, StoreSettings } from '../types';
import { BarChart3, TrendingUp, DollarSign, ShoppingBag, Calendar, RefreshCw, FileText, Download, FileDown, ListChecks, Search, Trash2, CheckSquare, Square, AlertTriangle, LayoutDashboard, Package, ArrowDownCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { format, subDays, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastContext';

interface LaporanProps {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  inboundTransactions: InboundTransaction[];
  settings: StoreSettings;
  activeTab: string;
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Laporan({ transactions, setTransactions, products, setProducts, inboundTransactions, settings, activeTab }: LaporanProps) {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'tanggal' | 'bulan'>('tanggal');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const { showToast } = useToast();
  
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [rowToDelete, setRowToDelete] = useState<string | 'multiple' | null>(null);

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (!startDate && !endDate) return true;
      const tDate = new Date(t.date).getTime();
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() + 86399999 : Infinity;
      return tDate >= start && tDate <= end;
    });
  }, [transactions, startDate, endDate]);

  const pelaporanData = useMemo(() => {
    // 1. Create a map of current stock for each product
    const currentStockMap = new Map<string, number>();
    products.forEach(p => {
      currentStockMap.set(p.id, p.stock);
    });

    // 2. Combine all movements (outbound and inbound)
    type Movement = {
      type: 'outbound' | 'inbound';
      date: number;
      productId: string;
      quantity: number;
      transactionId: string;
      // For outbound only
      name?: string;
      price?: number;
      isoDate?: string;
    };

    const movements: Movement[] = [];

    // Add outbound movements (sales)
    transactions.forEach(trx => {
      const trxTime = new Date(trx.date).getTime();
      trx.items.forEach(item => {
        movements.push({
          type: 'outbound',
          date: trxTime,
          productId: item.id,
          quantity: item.quantity,
          transactionId: trx.id,
          name: item.name,
          price: item.price,
          isoDate: trx.date
        });
      });
    });

    // Add inbound movements
    inboundTransactions.forEach(trx => {
      // Assume inbound transactions happen at the start of the day
      const trxTime = new Date(trx.date + 'T00:00:00.000Z').getTime();
      movements.push({
        type: 'inbound',
        date: trxTime,
        productId: trx.productId,
        quantity: trx.quantity,
        transactionId: trx.id
      });
    });

    // 3. Sort movements descending by date
    movements.sort((a, b) => b.date - a.date);

    // 4. Calculate historical stock
    const historicalStockMap = new Map<string, number>(); // key: transactionId_productId, value: stock after this movement
    
    movements.forEach(movement => {
      const currentTrackedStock = currentStockMap.get(movement.productId) || 0;
      
      if (movement.type === 'outbound') {
        // The stock *after* this sale is the current tracked stock
        historicalStockMap.set(`${movement.transactionId}_${movement.productId}`, currentTrackedStock);
        // To go backwards in time, we add the sold quantity back
        currentStockMap.set(movement.productId, currentTrackedStock + movement.quantity);
      } else if (movement.type === 'inbound') {
        // To go backwards in time, we subtract the inbound quantity
        currentStockMap.set(movement.productId, currentTrackedStock - movement.quantity);
      }
    });

    // 5. Build the final report data using filtered transactions
    const data: any[] = [];
    let no = 1;
    
    // Sort filtered transactions by date ascending
    const sortedTransactions = [...filteredTransactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sortedTransactions.forEach((trx) => {
      trx.items.forEach((item) => {
        // Apply search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchName = item.name.toLowerCase().includes(query);
          const matchNota = trx.id.toLowerCase().includes(query);
          const matchCustomer = trx.customerName ? trx.customerName.toLowerCase().includes(query) : false;
          
          if (!matchName && !matchNota && !matchCustomer) {
            return;
          }
        }

        const productId = item.productId || item.id;
        const sisaStok = historicalStockMap.get(`${trx.id}_${productId}`) || 0;

        data.push({
          no: no++,
          noNota: trx.id,
          tanggal: trx.date,
          namaPembeli: trx.customerName || '-',
          idBarang: productId,
          namaBarang: item.name,
          harga: item.price,
          qty: item.quantity,
          jumlah: item.price * item.quantity,
          sisaStok: sisaStok
        });
      });
    });
    return data;
  }, [filteredTransactions, transactions, inboundTransactions, products, searchQuery]);

  const dashboardMetrics = useMemo(() => {
    let filteredTrx = transactions;
    let filteredInbound = inboundTransactions;
    let isFiltered = false;

    if (startDate || endDate) {
      isFiltered = true;
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() + 86399999 : Infinity;
      
      filteredTrx = transactions.filter((t) => {
        const tDate = new Date(t.date).getTime();
        return tDate >= start && tDate <= end;
      });

      filteredInbound = inboundTransactions.filter((t) => {
        const tDate = new Date(t.date).getTime();
        return tDate >= start && tDate <= end;
      });
    }

    const totalPendapatan = filteredTrx.reduce((sum, t) => sum + t.total, 0);
    const totalBarang = products.length;
    const barangMasuk = filteredInbound.reduce((sum, t) => sum + t.quantity, 0);
    const barangTerjual = filteredTrx.reduce((sum, t) => sum + t.items.reduce((s, i) => s + i.quantity, 0), 0);
    
    let pendapatanTampil = 0;
    let labelPendapatan = '';

    if (isFiltered) {
      pendapatanTampil = totalPendapatan;
      labelPendapatan = 'Total Pendapatan';
    } else {
      const today = new Date();
      const todayTrx = transactions.filter((t) => isSameDay(new Date(t.date), today));
      pendapatanTampil = todayTrx.reduce((sum, t) => sum + t.total, 0);
      labelPendapatan = 'Pendapatan Hari Ini';
    }

    return {
      totalPendapatan,
      totalBarang,
      barangMasuk,
      barangTerjual,
      pendapatanTampil,
      labelPendapatan
    };
  }, [transactions, inboundTransactions, products, startDate, endDate]);

  const salesData = useMemo(() => {
    const data = [];
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 31) {
        for (let i = 0; i <= diffDays; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const dateStr = format(d, 'dd MMM', { locale: id });
          const dayTransactions = transactions.filter((t) => isSameDay(new Date(t.date), d));
          const total = dayTransactions.reduce((sum, t) => sum + t.total, 0);
          data.push({
            name: dateStr,
            total,
          });
        }
      } else {
        // Group by month
        const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
        const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
        
        let currentMonth = new Date(startMonth);
        while (currentMonth <= endMonth) {
          const monthStr = format(currentMonth, 'MMM yyyy', { locale: id });
          const monthTransactions = transactions.filter((t) => {
            const tDate = new Date(t.date);
            return tDate.getMonth() === currentMonth.getMonth() && tDate.getFullYear() === currentMonth.getFullYear();
          });
          const total = monthTransactions.reduce((sum, t) => sum + t.total, 0);
          data.push({
            name: monthStr,
            total,
          });
          currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
      }
    } else {
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayTransactions = transactions.filter((t) => isSameDay(new Date(t.date), date));
        const total = dayTransactions.reduce((sum, t) => sum + t.total, 0);
        data.push({
          name: format(date, 'dd MMM', { locale: id }),
          total,
        });
      }
    }
    return data;
  }, [transactions, startDate, endDate]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    filteredTransactions.forEach((t) => {
      t.items.forEach((item) => {
        const product = products.find(p => p.id === item.id);
        const category = item.category || product?.category || 'Lainnya';
        categories[category] = (categories[category] || 0) + item.quantity;
      });
    });

    return Object.entries(categories).map(([name, value]) => ({
      name,
      value,
    }));
  }, [filteredTransactions, products]);

  const outOfStockProducts = useMemo(() => {
    return products
      .filter(p => p.stock <= 0)
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }, [products]);

  const displayedTransactionsData = useMemo(() => {
    let isFiltered = false;
    let filtered = transactions;

    if (startDate || endDate) {
      isFiltered = true;
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() + 86399999 : Infinity;
      
      filtered = transactions.filter((t) => {
        const tDate = new Date(t.date).getTime();
        return tDate >= start && tDate <= end;
      });
    } else {
      const today = new Date();
      filtered = transactions.filter((t) => isSameDay(new Date(t.date), today));
    }

    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      data: filtered,
      label: isFiltered ? 'Riwayat Transaksi' : 'Riwayat Transaksi Hari Ini',
      emptyMessage: isFiltered ? 'Tidak ada transaksi pada periode ini.' : 'Belum ada transaksi hari ini.'
    };
  }, [transactions, startDate, endDate]);

  const toggleSelect = (id: string) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRows.length === pelaporanData.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(pelaporanData.map(row => `${row.noNota}_${row.idBarang}`));
    }
  };

  const handleDeleteConfirm = async () => {
    const rowsToDelete = rowToDelete === 'multiple' ? selectedRows : [rowToDelete as string];
    
    // Create a map of transaction ID to a list of product IDs to delete
    const itemsToDeleteMap = new Map<string, string[]>();
    rowsToDelete.forEach(rowId => {
      const [noNota, idBarang] = rowId.split('_');
      if (!itemsToDeleteMap.has(noNota)) {
        itemsToDeleteMap.set(noNota, []);
      }
      itemsToDeleteMap.get(noNota)!.push(idBarang);
    });

    const transactionsToDelete: string[] = [];
    const updatedTransactions = transactions.map(t => {
      if (itemsToDeleteMap.has(t.id)) {
        const itemsToRemove = itemsToDeleteMap.get(t.id)!;
        const newItems = t.items.filter(item => !itemsToRemove.includes(item.id));
        
        if (newItems.length === 0) {
          transactionsToDelete.push(t.id);
          return null;
        }
        
        // Recalculate total and subtotal
        const newSubtotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        return {
          ...t,
          items: newItems,
          subtotal: newSubtotal,
          total: newSubtotal // Assuming total = subtotal for simplicity
        };
      }
      return t;
    }).filter(Boolean) as Transaction[];

    // Restore stock
    const productsToUpdate = new Map<string, number>();
    rowsToDelete.forEach(rowId => {
      const [noNota, idBarang] = rowId.split('_');
      const row = pelaporanData.find(r => r.noNota === noNota && r.idBarang === idBarang);
      if (row) {
        productsToUpdate.set(idBarang, (productsToUpdate.get(idBarang) || 0) + row.qty);
      }
    });

    // Update local state
    setTransactions(updatedTransactions);
    setProducts(prev => prev.map(p => {
      if (productsToUpdate.has(p.id)) {
        return { ...p, stock: p.stock + productsToUpdate.get(p.id)! };
      }
      return p;
    }));
    setSelectedRows(prev => prev.filter(id => !rowsToDelete.includes(id)));
    setRowToDelete(null);

    if (supabase) {
      try {
        // Update stock in Supabase
        for (const [idBarang, qty] of productsToUpdate.entries()) {
          const product = products.find(p => p.id === idBarang);
          if (product) {
            await supabase.from('products').update({ stock: product.stock + qty }).eq('id', idBarang);
          }
        }

        // Delete items from transaction_items
        for (const [noNota, itemIds] of itemsToDeleteMap.entries()) {
          await supabase.from('transaction_items')
            .delete()
            .eq('transaction_id', noNota)
            .in('product_id', itemIds);
        }

        // Delete empty transactions
        if (transactionsToDelete.length > 0) {
          await supabase.from('transactions').delete().in('id', transactionsToDelete);
        }

        // Update remaining transactions
        for (const t of updatedTransactions) {
          if (itemsToDeleteMap.has(t.id)) {
            await supabase.from('transactions').update({
              subtotal: t.subtotal,
              total: t.total
            }).eq('id', t.id);
          }
        }
        showToast('Data berhasil dihapus!', 'success');
      } catch (error: any) {
        console.error('Error deleting items from Supabase:', error);
        showToast('Gagal menghapus data dari database: ' + error.message, 'error');
      }
    } else {
      showToast('Data berhasil dihapus!', 'success');
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF('landscape');
    
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

    const tableRows: any[] = pelaporanData.map((row) => [
      row.no,
      row.noNota,
      format(new Date(row.tanggal), 'dd/MM/yyyy'),
      row.namaPembeli,
      row.idBarang,
      row.namaBarang,
      row.harga.toLocaleString('id-ID'),
      row.qty,
      row.jumlah.toLocaleString('id-ID')
    ]);

    // Calculate totals
    const totalQty = pelaporanData.reduce((sum, row) => sum + row.qty, 0);
    const totalJumlah = pelaporanData.reduce((sum, row) => sum + row.jumlah, 0);

    // Add total row
    tableRows.push([
      { content: 'TOTAL', colSpan: 7, styles: { halign: 'center', fontStyle: 'bold' } },
      { content: totalQty.toString(), styles: { fontStyle: 'bold', halign: 'center' } },
      { content: totalJumlah.toLocaleString('id-ID'), styles: { fontStyle: 'bold', halign: 'right' } }
    ]);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN PENJUALAN', 148.5, 15, { align: 'center' });
    
    doc.setFontSize(16);
    doc.text(settings.storeName.toUpperCase(), 148.5, 23, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.text(settings.storeAddress || 'Alamat Toko', 148.5, 29, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periode : ${periodText}`, 15, 40);

    autoTable(doc, {
      head: [
        [
          { content: 'No.\nUrut', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'No. Nota', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Tanggal', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Nama Pembeli', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'ID Barang', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Nama Barang', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Harga', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Qty', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Jumlah', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } }
        ]
      ],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      styles: { 
        fontSize: 10, 
        cellPadding: 3,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        font: 'helvetica'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'center', cellWidth: 25 },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'left', cellWidth: 35 },
        4: { halign: 'center', cellWidth: 25 },
        5: { halign: 'left' },
        6: { halign: 'right', cellWidth: 25 },
        7: { halign: 'center', cellWidth: 12 },
        8: { halign: 'right', cellWidth: 30 }
      },
      margin: { top: 15, left: 15, right: 15 }
    });

    doc.save('Laporan_Penjualan.pdf');
  };

  const stokPenjualanData = useMemo(() => {
    let start = 0;
    let end = Infinity;

    if (filterType === 'tanggal') {
      start = startDate ? new Date(startDate).getTime() : 0;
      end = endDate ? new Date(endDate).getTime() + 86399999 : Infinity;
    } else if (filterType === 'bulan' && selectedMonth !== '') {
      const year = new Date().getFullYear();
      const month = parseInt(selectedMonth);
      start = new Date(year, month, 1).getTime();
      end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
    }

    const data = products.map((product) => {
      const productInbound = inboundTransactions.filter(t => {
        const tDate = new Date(t.date).getTime();
        return t.productId === product.id && tDate >= start && tDate <= end;
      });
      const masuk = productInbound.reduce((sum, t) => sum + t.quantity, 0);

      const productTransactions = transactions.filter(t => {
        const tDate = new Date(t.date).getTime();
        return tDate >= start && tDate <= end;
      });

      let qty = 0;
      let jumlah = 0;

      productTransactions.forEach(t => {
        const item = t.items.find(i => i.id === product.id);
        if (item) {
          qty += item.quantity;
          jumlah += item.price * item.quantity;
        }
      });

      const totalMasuk = inboundTransactions
        .filter(t => {
          const tDate = new Date(t.date).getTime();
          return t.productId === product.id && tDate <= end;
        })
        .reduce((sum, t) => sum + t.quantity, 0);

      const totalKeluar = transactions
        .filter(t => {
          const tDate = new Date(t.date).getTime();
          return tDate <= end;
        })
        .reduce((sum, t) => {
          const item = t.items.find(i => i.id === product.id);
          return sum + (item ? item.quantity : 0);
        }, 0);

      return {
        idBarang: product.id,
        namaBarang: product.name,
        harga: product.price,
        qty: qty,
        jumlah: jumlah,
        sisaStok: totalMasuk - totalKeluar
      };
    });

    data.sort((a, b) => a.idBarang.localeCompare(b.idBarang, undefined, { numeric: true }));

    return data.map((item, index) => ({
      no: index + 1,
      ...item
    }));
  }, [products, transactions, inboundTransactions, filterType, startDate, endDate, selectedMonth]);

  const handleDownloadStokPenjualanPDF = () => {
    const doc = new jsPDF('landscape');
    
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
    if (filterType === 'tanggal') {
      if (startDate && endDate) {
        periodText = `${formatDate(startDate)} sampai ${formatDate(endDate)}`;
      } else if (startDate) {
        periodText = `Mulai ${formatDate(startDate)}`;
      } else if (endDate) {
        periodText = `Sampai ${formatDate(endDate)}`;
      }
    } else if (filterType === 'bulan' && selectedMonth !== '') {
      periodText = `Bulan ${months[parseInt(selectedMonth)]} ${new Date().getFullYear()}`;
    }

    const tableRows: any[] = stokPenjualanData.map((row) => [
      row.no,
      row.idBarang,
      row.namaBarang,
      row.harga.toLocaleString('id-ID'),
      row.qty,
      row.jumlah.toLocaleString('id-ID'),
      row.sisaStok
    ]);

    // Calculate totals
    const totalQty = stokPenjualanData.reduce((sum, row) => sum + row.qty, 0);
    const totalJumlah = stokPenjualanData.reduce((sum, row) => sum + row.jumlah, 0);
    const totalSisaStok = stokPenjualanData.reduce((sum, row) => sum + row.sisaStok, 0);

    // Add total row
    tableRows.push([
      { content: 'TOTAL', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold' } },
      { content: totalQty.toString(), styles: { fontStyle: 'bold', halign: 'center' } },
      { content: totalJumlah.toLocaleString('id-ID'), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: totalSisaStok.toString(), styles: { fontStyle: 'bold', halign: 'center' } }
    ]);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN STOK PENJUALAN', 148.5, 15, { align: 'center' });
    
    doc.setFontSize(16);
    doc.text(settings.storeName.toUpperCase(), 148.5, 23, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.text(settings.storeAddress || 'Alamat Toko', 148.5, 29, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periode : ${periodText}`, 15, 40);

    autoTable(doc, {
      head: [
        [
          { content: 'No.\nUrut', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'ID Barang', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Nama Barang', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Harga', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Qty', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Jumlah', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Sisa Stok', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } }
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
        2: { halign: 'left' },
        3: { halign: 'right', cellWidth: 35 },
        4: { halign: 'center', cellWidth: 20 },
        5: { halign: 'right', cellWidth: 40 },
        6: { halign: 'center', cellWidth: 25 }
      },
      margin: { top: 15, left: 15, right: 15 }
    });

    doc.save('Laporan_Stok_Penjualan.pdf');
  };

  const rekapBarangData = useMemo(() => {
    let start = 0;
    let end = Infinity;

    if (filterType === 'tanggal') {
      start = startDate ? new Date(startDate).getTime() : 0;
      end = endDate ? new Date(endDate).getTime() + 86399999 : Infinity;
    } else if (filterType === 'bulan' && selectedMonth !== '') {
      const year = new Date().getFullYear();
      const month = parseInt(selectedMonth);
      start = new Date(year, month, 1).getTime();
      end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
    }

    const data = products.map((product) => {
      const masuk = inboundTransactions
        .filter(t => t.productId === product.id)
        .filter(t => {
          const tDate = new Date(t.date).getTime();
          return tDate >= start && tDate <= end;
        })
        .reduce((sum, t) => sum + t.quantity, 0);

      const keluar = transactions
        .filter(t => {
          const tDate = new Date(t.date).getTime();
          return tDate >= start && tDate <= end;
        })
        .reduce((sum, t) => {
          const item = t.items.find(i => i.id === product.id);
          return sum + (item ? item.quantity : 0);
        }, 0);

      const totalMasuk = inboundTransactions
        .filter(t => t.productId === product.id)
        .filter(t => {
          const tDate = new Date(t.date).getTime();
          return tDate <= end;
        })
        .reduce((sum, t) => sum + t.quantity, 0);

      const totalKeluar = transactions
        .filter(t => {
          const tDate = new Date(t.date).getTime();
          return tDate <= end;
        })
        .reduce((sum, t) => {
          const item = t.items.find(i => i.id === product.id);
          return sum + (item ? item.quantity : 0);
        }, 0);

      const sisaStok = totalMasuk - totalKeluar;

      return {
        idBarang: product.id,
        namaBarang: product.name,
        barangMasuk: masuk,
        barangKeluar: keluar,
        sisaStok: sisaStok
      };
    });

    data.sort((a, b) => a.idBarang.localeCompare(b.idBarang, undefined, { numeric: true }));

    return data.map((item, index) => ({
      no: index + 1,
      ...item
    }));
  }, [products, transactions, inboundTransactions, startDate, endDate, filterType, selectedMonth]);

  const handleDownloadRekapBarangPDF = () => {
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
    if (filterType === 'tanggal') {
      if (startDate && endDate) {
        periodText = `${formatDate(startDate)} sampai ${formatDate(endDate)}`;
      } else if (startDate) {
        periodText = `Mulai ${formatDate(startDate)}`;
      } else if (endDate) {
        periodText = `Sampai ${formatDate(endDate)}`;
      }
    } else if (filterType === 'bulan' && selectedMonth !== '') {
      periodText = `Bulan ${months[parseInt(selectedMonth)]} ${new Date().getFullYear()}`;
    }

    const tableRows: any[] = rekapBarangData.map((row) => [
      row.no,
      row.idBarang,
      row.namaBarang,
      row.barangMasuk,
      row.barangKeluar,
      row.sisaStok
    ]);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN BARANG MASUK DAN KELUAR', doc.internal.pageSize.width / 2, 15, { align: 'center' });
    
    doc.setFontSize(16);
    doc.text(settings.storeName.toUpperCase(), doc.internal.pageSize.width / 2, 23, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.text(settings.storeAddress || 'Alamat Toko', doc.internal.pageSize.width / 2, 29, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periode : ${periodText}`, 15, 40);

    // Calculate totals
    const totalMasuk = rekapBarangData.reduce((sum, row) => sum + row.barangMasuk, 0);
    const totalKeluar = rekapBarangData.reduce((sum, row) => sum + row.barangKeluar, 0);
    const totalSisaStok = rekapBarangData.reduce((sum, row) => sum + row.sisaStok, 0);

    // Add total row
    tableRows.push([
      { content: 'TOTAL', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold' } },
      { content: totalMasuk.toString(), styles: { fontStyle: 'bold', halign: 'center' } },
      { content: totalKeluar.toString(), styles: { fontStyle: 'bold', halign: 'center' } },
      { content: totalSisaStok.toString(), styles: { fontStyle: 'bold', halign: 'center' } }
    ]);

    autoTable(doc, {
      head: [
        [
          { content: 'No.\nUrut', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'ID Barang', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Nama Barang', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Barang Masuk', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Barang Keluar', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Sisa Stok', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } }
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
        2: { halign: 'left' },
        3: { halign: 'center', cellWidth: 30 },
        4: { halign: 'center', cellWidth: 30 },
        5: { halign: 'center', cellWidth: 25 }
      },
      margin: { top: 15, left: 15, right: 15 }
    });

    doc.save('Laporan_Barang_Masuk_dan_Keluar.pdf');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {activeTab === 'dashboard' ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 text-sm">Ringkasan performa toko Anda</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-gray-200 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none min-w-[130px]">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="date"
                  className="w-full pl-9 pr-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs sm:text-sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  title="Dari Tanggal"
                />
              </div>
              <span className="text-gray-500 hidden sm:inline">-</span>
              <div className="relative flex-1 sm:flex-none min-w-[130px]">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="date"
                  className="w-full pl-9 pr-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs sm:text-sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  title="Sampai Tanggal"
                />
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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-blue-100 text-blue-600 rounded-xl">
                  <Package className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">Total Barang</p>
              </div>
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mt-2 truncate text-gray-900" title={dashboardMetrics.totalBarang.toString()}>
                {dashboardMetrics.totalBarang}
              </h3>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                  <ArrowDownCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">Barang Masuk</p>
              </div>
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mt-2 truncate text-gray-900" title={dashboardMetrics.barangMasuk.toString()}>
                {dashboardMetrics.barangMasuk}
              </h3>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-purple-100 text-purple-600 rounded-xl">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">Barang Terjual</p>
              </div>
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mt-2 truncate text-gray-900" title={dashboardMetrics.barangTerjual.toString()}>
                {dashboardMetrics.barangTerjual}
              </h3>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-amber-100 text-amber-600 rounded-xl">
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">{dashboardMetrics.labelPendapatan}</p>
              </div>
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mt-2 truncate text-gray-900" title={`Rp ${dashboardMetrics.pendapatanTampil.toLocaleString('id-ID')}`}>
                Rp {dashboardMetrics.pendapatanTampil.toLocaleString('id-ID')}
              </h3>
            </div>
          </div>

          {/* Riwayat Transaksi Hari Ini */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-900">{displayedTransactionsData.label}</h3>
              </div>
              <span className="bg-indigo-100 text-indigo-600 text-xs font-bold px-2 py-1 rounded-full">
                {displayedTransactionsData.data.length} Transaksi
              </span>
            </div>
            
            {displayedTransactionsData.data.length > 0 ? (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-sm font-semibold text-gray-900">Waktu</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-900">No. Nota</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-900">Pelanggan</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-900">Item</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {displayedTransactionsData.data.map((trx) => (
                      <tr key={trx.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {format(new Date(trx.date), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-mono">{trx.id}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{trx.customerName || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {trx.items.reduce((sum, item) => sum + item.quantity, 0)} barang
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-bold text-right">
                          Rp {trx.total.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>{displayedTransactionsData.emptyMessage}</p>
              </div>
            )}
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <h3 className="text-lg font-bold text-gray-900">Grafik Pendapatan</h3>
            <div className="bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100">
              <p className="text-xs text-indigo-600 font-medium mb-1">Total Pendapatan</p>
              <p className="text-lg sm:text-xl font-bold text-indigo-700">Rp {dashboardMetrics.totalPendapatan.toLocaleString('id-ID')}</p>
            </div>
          </div>
          <div className="h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#4f46e5" floodOpacity="0.3" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => `Rp ${value / 1000}k`}
                  width={60}
                />
                <Tooltip
                  cursor={{ stroke: '#e5e7eb', strokeWidth: 2, strokeDasharray: '5 5' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`Rp ${value.toLocaleString('id-ID')}`, 'Pendapatan']}
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#4f46e5" 
                  strokeWidth={4}
                  dot={{ r: 4, fill: '#fff', stroke: '#4f46e5', strokeWidth: 2 }}
                  activeDot={{ r: 8, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
                  filter="url(#shadow)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Penjualan per Kategori</h3>
          <div className="h-72 sm:h-80">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${value} item`, 'Terjual']}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Belum ada data penjualan
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stok Barang Habis */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h3 className="text-lg font-bold text-gray-900">Stok Barang Habis</h3>
          <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full ml-2">
            {outOfStockProducts.length}
          </span>
        </div>
        
        {outOfStockProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">ID Barang</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">Nama Barang</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">Kategori</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">Sisa Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {outOfStockProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">{product.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{product.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{product.category}</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-bold text-right">{product.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <CheckSquare className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-50" />
            <p>Semua stok barang aman.</p>
          </div>
        )}
      </div>
      </>
      ) : activeTab === 'laporan-pelaporan' ? (
        <>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Rekap Penjualan</h1>
              <p className="text-gray-500 text-sm">Detail riwayat penjualan barang</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Daftar Penjualan
              </h2>
              <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                onClick={handleDownloadPDF}
                disabled={pelaporanData.length === 0}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Unduh PDF"
              >
                <FileDown className="w-5 h-5" />
              </button>
              <div className="relative w-full sm:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cari No. Nota, Nama Barang, Pembeli..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
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
              {(startDate || endDate || searchQuery) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setSearchQuery('');
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
            {pelaporanData.length > 0 && (
              <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAll}
                    className="text-gray-500 hover:text-indigo-600 transition-colors"
                    title={selectedRows.length === pelaporanData.length ? "Batal pilih semua" : "Pilih semua"}
                  >
                    {selectedRows.length > 0 && selectedRows.length === pelaporanData.length ? (
                      <CheckSquare className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                  <span className="text-sm font-medium text-gray-600">
                    {selectedRows.length > 0 ? `${selectedRows.length} dipilih` : 'Pilih Semua'}
                  </span>
                </div>
                {selectedRows.length > 0 && (
                  <button
                    onClick={() => setRowToDelete('multiple')}
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
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">No. Nota</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">Tanggal</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">Nama Pembeli</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">ID Barang</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">Nama Barang</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Harga</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-center">Qty</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Jumlah</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pelaporanData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleSelect(`${row.noNota}_${row.idBarang}`)}
                        className="text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        {selectedRows.includes(`${row.noNota}_${row.idBarang}`) ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{row.no}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{row.noNota}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {format(new Date(row.tanggal), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{row.namaPembeli}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-mono">{row.idBarang}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{row.namaBarang}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">
                      Rp {row.harga.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-sm text-indigo-600 font-medium text-center">
                      {row.qty}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium text-right">
                      Rp {row.jumlah.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setRowToDelete(`${row.noNota}_${row.idBarang}`)}
                        className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {pelaporanData.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-gray-500">
                      {(startDate || endDate || searchQuery) ? 'Tidak ada data pelaporan yang sesuai dengan filter.' : 'Belum ada data pelaporan.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {rowToDelete && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Hapus Data Penjualan</h3>
                <p className="text-gray-500 text-sm mb-6">
                  {rowToDelete === 'multiple' 
                    ? `Apakah Anda yakin ingin menghapus ${selectedRows.length} data penjualan terpilih? Stok barang akan dikembalikan.`
                    : 'Apakah Anda yakin ingin menghapus data penjualan ini? Stok barang akan dikembalikan.'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRowToDelete(null)}
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
        </>
      ) : activeTab === 'laporan-stok-penjualan' ? (
        <>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Laporan Stok Penjualan</h1>
              <p className="text-gray-500 text-sm">Detail stok dan penjualan barang</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Daftar Stok Penjualan
              </h2>
              <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                onClick={handleDownloadStokPenjualanPDF}
                disabled={stokPenjualanData.length === 0}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Unduh PDF"
              >
                <FileDown className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <select
                  className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm appearance-none bg-white"
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value as 'tanggal' | 'bulan');
                    setStartDate('');
                    setEndDate('');
                    setSelectedMonth('');
                  }}
                >
                  <option value="tanggal">Tanggal</option>
                  <option value="bulan">Bulan</option>
                </select>

                {filterType === 'tanggal' ? (
                  <>
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
                  </>
                ) : (
                  <select
                    className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm appearance-none bg-white min-w-[150px]"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  >
                    <option value="">Pilih Bulan</option>
                    {months.map((month, index) => (
                      <option key={index} value={index.toString()}>{month}</option>
                    ))}
                  </select>
                )}
              </div>
              {(startDate || endDate || selectedMonth) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setSelectedMonth('');
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
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">No. Urut</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">ID Barang</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">Nama Barang</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Harga</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-center">Qty</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Jumlah</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-center">Sisa Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stokPenjualanData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600">{row.no}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-mono">{row.idBarang}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{row.namaBarang}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">
                      Rp {row.harga.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-sm text-indigo-600 font-medium text-center">
                      {row.qty}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium text-right">
                      Rp {row.jumlah.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium text-center">
                      {row.sisaStok}
                    </td>
                  </tr>
                ))}
                {stokPenjualanData.length > 0 && (
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={4} className="px-6 py-4 text-sm text-gray-900 text-center">TOTAL</td>
                    <td className="px-6 py-4 text-sm text-indigo-600 text-center">
                      {stokPenjualanData.reduce((sum, row) => sum + row.qty, 0)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      Rp {stokPenjualanData.reduce((sum, row) => sum + row.jumlah, 0).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-center">
                      {stokPenjualanData.reduce((sum, row) => sum + row.sisaStok, 0)}
                    </td>
                  </tr>
                )}
                {stokPenjualanData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      Belum ada data barang.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      ) : activeTab === 'laporan-rekap-barang' ? (
        <>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
              <ListChecks className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Rekap Barang Masuk dan Keluar</h1>
              <p className="text-gray-500 text-sm">Ringkasan pergerakan stok barang</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-indigo-600" />
                Daftar Rekap Barang
              </h2>
              <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                onClick={handleDownloadRekapBarangPDF}
                disabled={rekapBarangData.length === 0}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Unduh PDF"
              >
                <FileDown className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <select
                  className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm appearance-none bg-white"
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value as 'tanggal' | 'bulan');
                    setStartDate('');
                    setEndDate('');
                    setSelectedMonth('');
                  }}
                >
                  <option value="tanggal">Tanggal</option>
                  <option value="bulan">Bulan</option>
                </select>

                {filterType === 'tanggal' ? (
                  <>
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
                  </>
                ) : (
                  <select
                    className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm appearance-none bg-white min-w-[150px]"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  >
                    <option value="">Pilih Bulan</option>
                    {months.map((month, index) => (
                      <option key={index} value={index.toString()}>{month}</option>
                    ))}
                  </select>
                )}
              </div>
              {(startDate || endDate || selectedMonth) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setSelectedMonth('');
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
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">No. Urut</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">ID Barang</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">Nama Barang</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-center">Barang Masuk</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-center">Barang Keluar</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-center">Sisa Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rekapBarangData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600">{row.no}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-mono">{row.idBarang}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{row.namaBarang}</td>
                    <td className="px-6 py-4 text-sm text-indigo-600 font-medium text-center">
                      {row.barangMasuk}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600 font-medium text-center">
                      {row.barangKeluar}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium text-center">
                      {row.sisaStok}
                    </td>
                  </tr>
                ))}
                {rekapBarangData.length > 0 && (
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={3} className="px-6 py-4 text-sm text-gray-900 text-center">TOTAL</td>
                    <td className="px-6 py-4 text-sm text-indigo-600 text-center">
                      {rekapBarangData.reduce((sum, row) => sum + row.barangMasuk, 0)}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600 text-center">
                      {rekapBarangData.reduce((sum, row) => sum + row.barangKeluar, 0)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-center">
                      {rekapBarangData.reduce((sum, row) => sum + row.sisaStok, 0)}
                    </td>
                  </tr>
                )}
                {rekapBarangData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Belum ada data barang.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      ) : null}
    </div>
  );
}
