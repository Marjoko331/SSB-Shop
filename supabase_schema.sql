-- Hapus tabel lama jika ada (Hati-hati, ini akan menghapus data yang ada)
DROP TABLE IF EXISTS public.transaction_items CASCADE;
DROP TABLE IF EXISTS public.inbound_transactions CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.store_settings CASCADE;

-- Tabel untuk Pengaturan Admin (Manajemen Pengguna & Kasir)
CREATE TABLE public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'kasir')),
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default admin user
INSERT INTO public.users (id, name, username, password, role, permissions)
VALUES (
    '1', 
    'Admin Utama', 
    'admin', 
    'admin', 
    'admin', 
    '["dashboard", "transaksi", "data-barang", "barang-masuk", "rekap-penjualan", "laporan", "pengaturan"]'::jsonb
);

-- Tabel untuk Pengaturan Toko (Store Settings)
CREATE TABLE public.store_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    store_name TEXT NOT NULL,
    store_address TEXT NOT NULL,
    logo_url TEXT,
    phone_number TEXT,
    receipt_message TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default store settings
INSERT INTO public.store_settings (id, store_name, store_address, phone_number, receipt_message)
VALUES (
    1, 
    'Toko Kasir Pintar', 
    'Jl. Contoh Alamat No. 123, Kota', 
    '081234567890', 
    'Terima kasih atas kunjungan Anda!'
);

-- Tabel Produk (Data Barang)
CREATE TABLE public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Transaksi (Penjualan)
CREATE TABLE public.transactions (
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

-- Tabel Detail Transaksi (Item yang dibeli)
CREATE TABLE public.transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT REFERENCES public.transactions(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    price NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Barang Masuk (Inbound Transactions)
CREATE TABLE public.inbound_transactions (
    id TEXT PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    current_stock INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Mengatur Replica Identity menjadi FULL untuk Realtime
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.store_settings REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.transaction_items REPLICA IDENTITY FULL;
ALTER TABLE public.inbound_transactions REPLICA IDENTITY FULL;

-- Menambahkan tabel ke publication realtime
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.products;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.users;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.store_settings;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.transactions;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.transaction_items;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.inbound_transactions;

ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inbound_transactions;
