import { Product, StoreSettings, Transaction } from './types';

export const initialProducts: Product[] = [];

export const initialSettings: StoreSettings = {
  storeName: 'KasirQ',
  storeAddress: 'Jl. Sudirman No. 123, Jakarta',
  logoUrl: 'https://picsum.photos/seed/kasirqlogo/150/150',
  phoneNumber: '081234567890',
  receiptMessage: 'Terima Kasih Atas Kunjungan Anda\nBarang yang sudah dibeli tidak dapat ditukar/dikembalikan',
};

export const initialTransactions: Transaction[] = [];
