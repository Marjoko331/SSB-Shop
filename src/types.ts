export type Category = 'Makanan' | 'Minuman' | 'Snack' | 'Lainnya';

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  stock: number;
  image: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Transaction {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  paymentMethod: 'Cash' | 'QRIS';
  amountPaid: number;
  change: number;
  customerName?: string;
}

export interface StoreSettings {
  storeName: string;
  storeAddress: string;
  logoUrl?: string;
  phoneNumber?: string;
  receiptMessage?: string;
}

export interface InboundTransaction {
  id: string;
  date: string;
  productId: string;
  productName: string;
  quantity: number;
  currentStock: number;
}

export interface User {
  id: string;
  name: string;
  username: string;
  role: string;
  permissions?: string[];
  password?: string;
}
