import React, { useState } from 'react';
import { StoreSettings } from '../types';
import { Settings, Save, Store, MapPin, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastContext';

interface PengaturanProps {
  settings: StoreSettings;
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings>>;
}

export default function Pengaturan({ settings, setSettings }: PengaturanProps) {
  const [formData, setFormData] = useState<StoreSettings>(settings);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (supabase) {
      try {
        const { error } = await supabase.from('store_settings').upsert({
          id: 1,
          store_name: formData.storeName,
          store_address: formData.storeAddress,
          logo_url: formData.logoUrl,
          phone_number: formData.phoneNumber,
          receipt_message: formData.receiptMessage
        });
        
        if (error) throw error;
      } catch (error: any) {
        console.error('Error saving settings to Supabase:', error);
        showToast('Gagal menyimpan ke database Supabase: ' + error.message, 'error');
        return; // Berhenti jika gagal simpan ke database
      }
    }
    
    setSettings(formData);
    showToast('Pengaturan berhasil disimpan!', 'success');
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pengaturan Toko</h1>
          <p className="text-gray-500 text-sm">Kelola informasi dan preferensi toko Anda</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">
              Informasi Dasar
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Toko
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Store className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alamat Toko
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <textarea
                    required
                    rows={3}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow resize-none"
                    value={formData.storeAddress}
                    onChange={(e) => setFormData({ ...formData, storeAddress: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL Logo Toko
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ImageIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                    value={formData.logoUrl || ''}
                    onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  />
                </div>
                {formData.logoUrl && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-500 mb-2">Preview Logo:</p>
                    <img
                      src={formData.logoUrl}
                      alt="Logo Preview"
                      className="h-16 w-auto object-contain border border-gray-200 rounded-lg p-1"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                      onLoad={(e) => {
                        (e.target as HTMLImageElement).style.display = 'block';
                      }}
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  No. Telepon
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400 font-medium text-sm">📞</span>
                  </div>
                  <input
                    type="tel"
                    placeholder="081234567890"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                    value={formData.phoneNumber || ''}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pesan Bawah Struk
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <span className="text-gray-400 font-medium text-sm">📝</span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Terima kasih atas kunjungan Anda!"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow resize-none"
                    value={formData.receiptMessage || ''}
                    onChange={(e) => setFormData({ ...formData, receiptMessage: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
