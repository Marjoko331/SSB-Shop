import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

const sqlQueries = `
-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC NOT NULL,
    stock INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create store_settings table
CREATE TABLE IF NOT EXISTS public.store_settings (
    id INTEGER PRIMARY KEY,
    store_name TEXT NOT NULL,
    store_address TEXT,
    logo_url TEXT,
    phone_number TEXT,
    receipt_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    subtotal NUMERIC NOT NULL,
    total NUMERIC NOT NULL,
    payment_method TEXT NOT NULL,
    amount_paid NUMERIC NOT NULL,
    change NUMERIC NOT NULL,
    customer_name TEXT,
    cashier_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create transaction_items table
CREATE TABLE IF NOT EXISTS public.transaction_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id TEXT REFERENCES public.transactions(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    price NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create inbound_transactions table
CREATE TABLE IF NOT EXISTS public.inbound_transactions (
    id TEXT PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    current_stock INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    permissions TEXT[] DEFAULT '{}'::TEXT[],
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert initial store settings
INSERT INTO public.store_settings (id, store_name, store_address, logo_url, phone_number, receipt_message)
VALUES (
    1, 
    'KasirQ', 
    'Jl. Sudirman No. 123, Jakarta', 
    'https://picsum.photos/seed/kasirqlogo/150/150', 
    '081234567890', 
    'Terima Kasih Atas Kunjungan Anda\nBarang yang sudah dibeli tidak dapat ditukar/dikembalikan'
) ON CONFLICT (id) DO NOTHING;

-- Insert default admin user
INSERT INTO public.users (id, name, username, role, permissions, password)
VALUES (
    '1', 
    'Admin Utama', 
    'admin', 
    'admin', 
    ARRAY['dashboard', 'transaksi', 'data-barang', 'barang-masuk', 'rekap-penjualan', 'laporan', 'pengaturan'], 
    'admin'
) ON CONFLICT (id) DO NOTHING;
`;

export default function DatabaseSQL() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlQueries);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Database SQL</h1>
        <p className="text-gray-500 mt-1">Gunakan query SQL di bawah ini untuk membuat tabel di database Supabase Anda.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-700 font-mono">schema.sql</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-green-600">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Salin SQL</span>
              </>
            )}
          </button>
        </div>
        <div className="p-4 bg-gray-900 overflow-x-auto">
          <pre className="text-sm text-gray-300 font-mono whitespace-pre">
            <code>{sqlQueries.trim()}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
