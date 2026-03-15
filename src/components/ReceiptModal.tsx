import React from 'react';
import { Transaction, StoreSettings } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Printer, X } from 'lucide-react';

interface ReceiptModalProps {
  transaction: Transaction;
  settings: StoreSettings;
  onClose: () => void;
}

export default function ReceiptModal({ transaction, settings, onClose }: ReceiptModalProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] print:shadow-none print:max-w-full print:h-auto print:max-h-none">
        
        {/* Header - Hidden on print */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 print:hidden shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Cetak Struk</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Content */}
        <div className="p-6 overflow-y-auto print:overflow-visible print:p-0 font-mono text-sm text-gray-800" id="printable-receipt">
          <div className="text-center mb-6">
            {settings.logoUrl && (
              <img
                src={settings.logoUrl}
                alt="Store Logo"
                className="w-16 h-16 mx-auto mb-3 object-contain grayscale"
                referrerPolicy="no-referrer"
              />
            )}
            <h1 className="font-bold text-xl uppercase tracking-wider">{settings.storeName}</h1>
            <p className="text-xs mt-1 whitespace-pre-wrap">{settings.storeAddress}</p>
            {settings.phoneNumber && (
              <p className="text-xs mt-0.5">Telp: {settings.phoneNumber}</p>
            )}
          </div>

          <div className="border-t border-dashed border-gray-400 py-3 mb-3 text-xs">
            <div className="flex justify-between mb-1">
              <span>Waktu:</span>
              <span>{format(new Date(transaction.date), 'dd/MM/yyyy HH:mm', { locale: id })}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>No. TRX:</span>
              <span>{transaction.id}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Kasir:</span>
              <span>Admin</span>
            </div>
            {transaction.customerName && (
              <div className="flex justify-between">
                <span>Pelanggan:</span>
                <span>{transaction.customerName}</span>
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-gray-400 py-3 mb-3">
            <table className="w-full text-xs">
              <tbody>
                {transaction.items.map((item, index) => (
                  <tr key={index}>
                    <td className="py-1 align-top">
                      <div>{item.name}</div>
                      <div className="text-gray-500">
                        {item.quantity} x {item.price.toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td className="py-1 align-bottom text-right">
                      {(item.quantity * item.price).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-dashed border-gray-400 py-3 mb-3 text-xs space-y-1">
            <div className="flex justify-between font-bold text-sm">
              <span>TOTAL</span>
              <span>Rp {transaction.total.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 py-3 mb-6 text-xs space-y-1">
            <div className="flex justify-between">
              <span>Metode Bayar</span>
              <span>{transaction.paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span>Tunai / Dibayar</span>
              <span>{transaction.amountPaid.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>Kembalian</span>
              <span>{transaction.change.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="text-center text-xs whitespace-pre-wrap">
            {settings.receiptMessage || 'Terima Kasih Atas Kunjungan Anda\nBarang yang sudah dibeli tidak dapat ditukar/dikembalikan'}
          </div>
        </div>

        {/* Footer - Hidden on print */}
        <div className="p-4 border-t border-gray-200 print:hidden shrink-0 bg-gray-50">
          <button
            onClick={handlePrint}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <Printer className="w-5 h-5" />
            Cetak Struk
          </button>
        </div>
      </div>
    </div>
  );
}
