/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Transaksi from './pages/Transaksi';
import DataBarang from './pages/DataBarang';
import BarangMasuk from './pages/BarangMasuk';
import RekapPenjualan from './pages/RekapPenjualan';
import Laporan from './pages/Laporan';
import Pengaturan from './pages/Pengaturan';
import PengaturanAdmin from './pages/PengaturanAdmin';
import DatabaseSQL from './pages/DatabaseSQL';
import Login from './pages/Login';
import { initialProducts, initialSettings, initialTransactions } from './data';
import { Product, StoreSettings, Transaction, User, InboundTransaction } from './types';
import { supabase } from './lib/supabase';
import { useToast } from './components/ToastContext';

const AVAILABLE_PERMISSIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'transaksi', label: 'Transaksi' },
  { id: 'data-barang', label: 'Data Barang' },
  { id: 'barang-masuk', label: 'Barang Masuk' },
  { id: 'rekap-penjualan', label: 'Rekap Nota' },
  { id: 'laporan', label: 'Laporan' },
  { id: 'pengaturan', label: 'Pengaturan' }
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('currentUser');
  });
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'dashboard';
  });
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [inboundTransactions, setInboundTransactions] = useState<InboundTransaction[]>([]);
  const [users, setUsers] = useState<User[]>(() => {
    const savedUsers = localStorage.getItem('users');
    if (savedUsers) {
      return JSON.parse(savedUsers);
    }
    return [
      { id: '1', name: 'Admin Utama', username: 'admin', role: 'admin', permissions: AVAILABLE_PERMISSIONS.map(p => p.id), password: 'admin' },
      { id: '2', name: 'Kasir 1', username: 'kasir1', role: 'kasir', permissions: ['transaksi'], password: 'kasir' },
    ];
  });
  const { showToast } = useToast();

  useEffect(() => {
    localStorage.setItem('users', JSON.stringify(users));
  }, [users]);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!supabase) return;

    const fetchData = async () => {
      try {
        const [
          productsRes,
          settingsRes,
          transactionsRes,
          inboundRes,
          usersRes
        ] = await Promise.all([
          supabase.from('products').select('*'),
          supabase.from('store_settings').select('*').eq('id', 1).maybeSingle(),
          supabase.from('transactions').select('*, transaction_items(*)'),
          supabase.from('inbound_transactions').select('*'),
          supabase.from('users').select('*')
        ]);

        if (productsRes.error) console.error('Error fetching products:', productsRes.error);
        if (settingsRes.error) console.error('Error fetching settings:', settingsRes.error);
        if (transactionsRes.error) console.error('Error fetching transactions:', transactionsRes.error);
        if (inboundRes.error) console.error('Error fetching inbound:', inboundRes.error);
        if (usersRes.error) console.error('Error fetching users:', usersRes.error);

        const productsData = productsRes.data;
        const settingsData = settingsRes.data;
        const transactionsData = transactionsRes.data;
        const inboundData = inboundRes.data;
        const usersData = usersRes.data;

        if (productsData) setProducts(productsData);
        if (usersData && usersData.length > 0) setUsers(usersData);
        if (settingsData) setSettings({
          storeName: settingsData.store_name,
          storeAddress: settingsData.store_address,
          logoUrl: settingsData.logo_url,
          phoneNumber: settingsData.phone_number,
          receiptMessage: settingsData.receipt_message
        });
        if (transactionsData) {
          const formattedTransactions = transactionsData.map((t: any) => ({
            id: t.id,
            date: t.date,
            subtotal: t.subtotal,
            total: t.total,
            paymentMethod: t.payment_method,
            amountPaid: t.amount_paid,
            change: t.change,
            customerName: t.customer_name,
            cashierName: t.cashier_name,
            items: t.transaction_items?.map((item: any) => {
              const product = productsData?.find(p => p.id === item.product_id);
              return {
                id: item.product_id,
                quantity: item.quantity,
                price: item.price,
                name: product?.name || 'Unknown',
                category: product?.category || 'Lainnya'
              };
            }) || []
          }));
          setTransactions(formattedTransactions);
        }
        if (inboundData) {
          const formattedInbound = inboundData.map((i: any) => ({
            id: i.id,
            date: i.date,
            productId: i.product_id,
            productName: i.product_name,
            quantity: i.quantity,
            currentStock: i.current_stock
          }));
          setInboundTransactions(formattedInbound);
        }
      } catch (error) {
        console.error('Error fetching data from Supabase:', error);
      }
    };

    fetchData();

    // Set up real-time subscriptions
    const productsSubscription = supabase
      .channel('public:products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        if (payload.eventType === 'INSERT') {
          setProducts(prev => {
            if (prev.find(p => p.id === payload.new.id)) return prev;
            return [...prev, payload.new as Product];
          });
        } else if (payload.eventType === 'UPDATE') {
          setProducts(prev => prev.map(p => p.id === payload.new.id ? payload.new as Product : p));
        } else if (payload.eventType === 'DELETE') {
          setProducts(prev => prev.filter(p => p.id === payload.old.id));
        }
      })
      .subscribe();

    const settingsSubscription = supabase
      .channel('public:store_settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, payload => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          setSettings({
            storeName: payload.new.store_name,
            storeAddress: payload.new.store_address,
            logoUrl: payload.new.logo_url,
            phoneNumber: payload.new.phone_number,
            receiptMessage: payload.new.receipt_message
          });
        }
      })
      .subscribe();

    const inboundSubscription = supabase
      .channel('public:inbound_transactions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inbound_transactions' }, payload => {
        setInboundTransactions(prev => {
          if (prev.find(t => t.id === payload.new.id)) return prev;
          return [{
            id: payload.new.id,
            date: payload.new.date,
            productId: payload.new.product_id,
            productName: payload.new.product_name,
            quantity: payload.new.quantity,
            currentStock: payload.new.current_stock
          }, ...prev];
        });
      })
      .subscribe();

    const usersSubscription = supabase
      .channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, payload => {
        if (payload.eventType === 'INSERT') {
          setUsers(prev => {
            if (prev.find(u => u.id === payload.new.id)) return prev;
            return [...prev, payload.new as User];
          });
        } else if (payload.eventType === 'UPDATE') {
          setUsers(prev => prev.map(u => u.id === payload.new.id ? payload.new as User : u));
        } else if (payload.eventType === 'DELETE') {
          setUsers(prev => prev.filter(u => u.id !== payload.old.id));
        }
      })
      .subscribe();

    const transactionsSubscription = supabase
      .channel('public:transactions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, async (payload) => {
        // Fetch the transaction items for this new transaction
        const { data: itemsData } = await supabase
          .from('transaction_items')
          .select('*')
          .eq('transaction_id', payload.new.id);
          
        // We also need product names, but we can use the current products state
        // However, state in event listener might be stale, so we'll just use the payload
        
        setTransactions(prev => {
          if (prev.find(t => t.id === payload.new.id)) return prev;
          
          const newTx: Transaction = {
            id: payload.new.id,
            date: payload.new.date,
            subtotal: payload.new.subtotal,
            total: payload.new.total,
            paymentMethod: payload.new.payment_method,
            amountPaid: payload.new.amount_paid,
            change: payload.new.change,
            customerName: payload.new.customer_name,
            cashierName: payload.new.cashier_name,
            items: itemsData ? itemsData.map((item: any) => ({
              id: item.product_id,
              quantity: item.quantity,
              price: item.price,
              name: 'Loading...', // Will be updated on next full fetch or we can leave it
              category: 'Lainnya'
            })) : []
          };
          return [newTx, ...prev];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(productsSubscription);
      supabase.removeChannel(settingsSubscription);
      supabase.removeChannel(inboundSubscription);
      supabase.removeChannel(usersSubscription);
      supabase.removeChannel(transactionsSubscription);
    };
  }, []);

  const handleCheckout = async (transaction: Transaction) => {
    // Tambahkan nama kasir
    const newTransaction = {
      ...transaction,
      cashierName: currentUser.name,
    };

    // Update stok barang
    setProducts((prevProducts) => {
      const updatedProducts = [...prevProducts];
      transaction.items.forEach((item) => {
        const productIndex = updatedProducts.findIndex((p) => p.id === item.id);
        if (productIndex !== -1) {
          updatedProducts[productIndex] = {
            ...updatedProducts[productIndex],
            stock: updatedProducts[productIndex].stock - item.quantity,
          };
        }
      });
      return updatedProducts;
    });

    // Tambah transaksi
    setTransactions((prev) => [newTransaction, ...prev]);
    
    // Save to Supabase
    if (supabase) {
      try {
        const { error: insertError } = await supabase.from('transactions').insert({
          id: newTransaction.id,
          date: newTransaction.date,
          subtotal: newTransaction.subtotal,
          total: newTransaction.total,
          payment_method: newTransaction.paymentMethod,
          amount_paid: newTransaction.amountPaid,
          change: newTransaction.change,
          customer_name: newTransaction.customerName,
          cashier_name: newTransaction.cashierName,
        });
        if (insertError) throw insertError;

        const transactionItems = newTransaction.items.map(item => ({
          transaction_id: newTransaction.id,
          product_id: item.id,
          quantity: item.quantity,
          price: item.price
        }));

        const { error: itemsError } = await supabase.from('transaction_items').insert(transactionItems);
        if (itemsError) throw itemsError;

        // Update product stocks in Supabase
        for (const item of newTransaction.items) {
          const product = products.find(p => p.id === item.id);
          if (product) {
            const { error: updateError } = await supabase.from('products')
              .update({ stock: product.stock - item.quantity })
              .eq('id', item.id);
            if (updateError) throw updateError;
          }
        }
      } catch (error: any) {
        console.error('Error saving transaction to Supabase:', error);
        showToast('Gagal menyimpan transaksi ke database: ' + error.message, 'error');
        return;
      }
    }

    showToast('Transaksi berhasil!', 'success');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'transaksi':
        return <Transaksi products={products} settings={settings} transactions={transactions} onCheckout={handleCheckout} />;
      case 'data-barang':
        return <DataBarang products={products} setProducts={setProducts} settings={settings} transactions={transactions} />;
      case 'barang-masuk':
      case 'barang-masuk-entri':
      case 'barang-masuk-rekap':
        return <BarangMasuk activeTab={activeTab === 'barang-masuk-rekap' ? 'rekap' : 'entri'} products={products} setProducts={setProducts} inboundTransactions={inboundTransactions} setInboundTransactions={setInboundTransactions} settings={settings} transactions={transactions} />;
      case 'rekap-penjualan':
      case 'rekap-penjualan-utama':
        return <RekapPenjualan transactions={transactions} setTransactions={setTransactions} products={products} setProducts={setProducts} settings={settings} />;
      case 'dashboard':
      case 'laporan':
      case 'laporan-stok-penjualan':
      case 'laporan-pelaporan':
      case 'laporan-rekap-barang':
        return <Laporan transactions={transactions} setTransactions={setTransactions} products={products} setProducts={setProducts} inboundTransactions={inboundTransactions} settings={settings} activeTab={activeTab === 'laporan' ? 'laporan-stok-penjualan' : activeTab} />;
      case 'pengaturan':
      case 'pengaturan-toko':
        return <Pengaturan settings={settings} setSettings={setSettings} />;
      case 'pengaturan-admin':
        return <PengaturanAdmin users={users} setUsers={setUsers} />;
      case 'pengaturan-database':
        return <DatabaseSQL />;
      default:
        return <Transaksi products={products} settings={settings} transactions={transactions} onCheckout={handleCheckout} />;
    }
  };

  if (!isAuthenticated || !currentUser) {
    return <Login onLogin={(user) => {
      setCurrentUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('currentUser', JSON.stringify(user));
      // Set active tab based on permissions
      if (user.role === 'admin') {
        setActiveTab('dashboard');
      } else if (user.permissions && user.permissions.length > 0) {
        // Find the first available tab for this user
        const firstPerm = user.permissions[0];
        if (firstPerm === 'laporan') setActiveTab('dashboard');
        else setActiveTab(firstPerm);
      } else {
        setActiveTab('transaksi');
      }
    }} users={users} settings={settings} />;
  }

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      storeName={settings.storeName}
      storeLogo={settings.logoUrl}
      storeAddress={settings.storeAddress}
      currentUser={currentUser}
      onLogout={() => {
        setIsAuthenticated(false);
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
      }}
    >
      {renderContent()}
    </Layout>
  );
}
