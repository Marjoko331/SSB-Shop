import React, { useState, useMemo, useEffect } from 'react';
import { Product, CartItem, Transaction, StoreSettings } from '../types';
import { ShoppingCart, Plus, Minus, Trash2, Search, CreditCard, Banknote, QrCode, ScanLine, X } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import QRScannerModal from '../components/QRScannerModal';
import { useToast } from '../components/ToastContext';

interface TransaksiProps {
  products: Product[];
  settings: StoreSettings;
  transactions: Transaction[];
  onCheckout: (transaction: Transaction) => void;
}

export default function Transaksi({ products, settings, transactions, onCheckout }: TransaksiProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'QRIS'>('Cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [showReceipt, setShowReceipt] = useState<Transaction | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const { showToast } = useToast();

  const hasOutOfStock = products.some((p) => p.stock <= 0);
  const categories = [
    'Semua',
    ...Array.from(new Set(products.map((p) => p.category))),
    ...(hasOutOfStock ? ['Stok Habis'] : [])
  ];

  useEffect(() => {
    if (selectedCategory === 'Stok Habis' && !hasOutOfStock) {
      setSelectedCategory('Semua');
    }
  }, [hasOutOfStock, selectedCategory]);

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      let matchesCategory = false;
      if (selectedCategory === 'Semua') {
        matchesCategory = true;
      } else if (selectedCategory === 'Stok Habis') {
        matchesCategory = p.stock <= 0;
      } else {
        matchesCategory = p.category === selectedCategory;
      }
      return matchesSearch && matchesCategory;
    });

    // Sort so that out of stock items are at the bottom
    return filtered.sort((a, b) => {
      if (a.stock <= 0 && b.stock > 0) return 1;
      if (a.stock > 0 && b.stock <= 0) return -1;
      return 0; // Keep original order for items with same stock status
    });
  }, [products, searchQuery, selectedCategory]);

  const addToCart = (product: Product) => {
    const currentInCart = cart.find((item) => item.id === product.id)?.quantity || 0;
    if (currentInCart >= product.stock) {
      showToast('Stok tidak mencukupi!', 'error');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQuantity = item.quantity + delta;
            if (newQuantity <= 0) return null;
            if (newQuantity > product.stock) {
              showToast('Stok tidak mencukupi!', 'error');
              return item;
            }
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    
    const paid = parseFloat(amountPaid) || 0;
    if (paymentMethod === 'Cash' && paid < total) {
      showToast('Uang tunai kurang!', 'error');
      return;
    }

    let maxId = 0;
    for (const t of transactions) {
      if (t.id.startsWith('NT-')) {
        const numStr = t.id.substring(3);
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }
    }
    const nextId = maxId + 1;

    const transaction: Transaction = {
      id: `NT-${nextId.toString().padStart(10, '0')}`,
      date: new Date().toISOString(),
      items: [...cart],
      subtotal,
      total,
      paymentMethod,
      amountPaid: paymentMethod === 'Cash' ? paid : total,
      change: paymentMethod === 'Cash' ? paid - total : 0,
      customerName: customerName.trim() || undefined,
    };

    onCheckout(transaction);
    setShowReceipt(transaction);
    setCart([]);
    setAmountPaid('');
    setCustomerName('');
  };

  const handleScan = (decodedText: string) => {
    // Try to find product by ID or Name
    const product = products.find(
      p => p.id === decodedText || p.name.toLowerCase() === decodedText.toLowerCase()
    );

    if (product) {
      addToCart(product);
      setShowScanner(false);
    } else {
      showToast(`Barang dengan kode/nama "${decodedText}" tidak ditemukan.`, 'error');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {showReceipt && (
        <ReceiptModal
          transaction={showReceipt}
          settings={settings}
          onClose={() => setShowReceipt(null)}
        />
      )}
      {showScanner && (
        <QRScannerModal
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
      {/* Product List */}
      <div className="flex-1 flex flex-col min-h-0 bg-gray-50 border-r border-gray-200 pb-20 lg:pb-0">
        <div className="p-4 bg-white border-b border-gray-200 shrink-0 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari menu..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-medium border border-indigo-200"
              title="Scan QR Code"
            >
              <ScanLine className="w-5 h-5" />
              <span className="hidden sm:inline">Scan</span>
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? cat === 'Stok Habis'
                      ? 'bg-red-600 text-white'
                      : 'bg-indigo-600 text-white'
                    : cat === 'Stok Habis'
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => {
              const currentInCart = cart.find((item) => item.id === product.id)?.quantity || 0;
              const availableStock = product.stock - currentInCart;
              const isOutOfStock = availableStock <= 0;

              return (
                <div
                  key={product.id}
                  onClick={() => !isOutOfStock && addToCart(product)}
                  className={`rounded-xl shadow-sm border overflow-hidden transition-all ${
                    isOutOfStock 
                      ? 'bg-red-50 border-red-200 opacity-75 cursor-not-allowed' 
                      : 'bg-white border-gray-200 cursor-pointer hover:shadow-md hover:border-indigo-300 active:scale-95'
                  }`}
                >
                  <div className="h-16 sm:h-20 bg-gray-100 relative">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-sm px-3 py-1 bg-red-500 rounded-full">
                          Habis
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 leading-tight mb-1">
                      {product.name}
                    </h3>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-indigo-600 font-bold text-sm">
                        Rp {product.price.toLocaleString('id-ID')}
                      </span>
                      <span className={`text-xs font-medium ${availableStock <= 5 ? 'text-red-500' : 'text-gray-500'}`}>
                        Stok: {availableStock}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Cart Toggle Button */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <button
          onClick={() => setShowMobileCart(true)}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors flex items-center justify-between px-6"
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            <span>{cart.reduce((sum, item) => sum + item.quantity, 0)} Item</span>
          </div>
          <span>Rp {total.toLocaleString('id-ID')}</span>
        </button>
      </div>

      {/* Cart Sidebar Overlay (Mobile) */}
      {showMobileCart && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowMobileCart(false)}
        />
      )}

      {/* Cart Sidebar */}
      <div className={`fixed lg:static inset-y-0 right-0 w-full sm:w-[400px] lg:w-96 bg-white flex flex-col shrink-0 h-full border-l border-gray-200 z-50 transform transition-transform duration-300 ease-in-out ${
        showMobileCart ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
            Pesanan Saat Ini
          </h2>
          <div className="flex items-center gap-3">
            <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-full">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} Item
            </span>
            <button 
              className="lg:hidden p-2 -mr-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              onClick={() => setShowMobileCart(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
              <ShoppingCart className="w-12 h-12 opacity-20" />
              <p className="text-sm">Belum ada pesanan</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex items-start gap-3 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-12 h-12 rounded-md object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h4>
                  <div className="text-indigo-600 text-sm font-medium">
                    Rp {item.price.toLocaleString('id-ID')}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center bg-gray-50 rounded-md border border-gray-200">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-1 hover:bg-gray-200 text-gray-600 rounded-l-md transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-1 hover:bg-gray-200 text-gray-600 rounded-r-md transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-md ml-auto transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 shrink-0 space-y-4">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Metode Pembayaran</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'Cash', icon: Banknote },
                { id: 'QRIS', icon: QrCode },
              ].map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id as any)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-medium gap-1 transition-colors ${
                      paymentMethod === method.id
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {method.id}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pembeli (Opsional)</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="Masukkan nama pembeli..."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          {paymentMethod === 'Cash' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Bayar (Rp)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
              </div>
              {amountPaid !== '' && !isNaN(parseFloat(amountPaid)) && (
                parseFloat(amountPaid) >= total ? (
                  <div className="flex justify-between items-center p-3 bg-green-50 border border-green-100 rounded-lg">
                    <span className="text-sm font-medium text-green-800">Kembalian</span>
                    <span className="text-lg font-bold text-green-600">
                      Rp {(parseFloat(amountPaid) - total).toLocaleString('id-ID')}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center p-3 bg-red-50 border border-red-100 rounded-lg">
                    <span className="text-sm font-medium text-red-800">Kurang Bayar</span>
                    <span className="text-lg font-bold text-red-600">
                      Rp {(total - parseFloat(amountPaid)).toLocaleString('id-ID')}
                    </span>
                  </div>
                )
              )}
            </div>
          )}

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>Rp {total.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || (paymentMethod === 'Cash' && (amountPaid === '' || isNaN(parseFloat(amountPaid)) || parseFloat(amountPaid) < total))}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            Bayar Pesanan
          </button>
        </div>
      </div>
    </div>
  );
}
