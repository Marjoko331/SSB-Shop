import React, { useState, useRef } from 'react';
import { Product, Category, StoreSettings, Transaction } from '../types';
import { Plus, Search, Edit2, Trash2, X, QrCode, Download, FileDown, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import QRScannerModal from '../components/QRScannerModal';
import { useToast } from '../components/ToastContext';

interface DataBarangProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  settings: StoreSettings;
  transactions?: Transaction[];
}

export default function DataBarang({ products, setProducts, settings, transactions = [] }: DataBarangProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showQrModal, setShowQrModal] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | 'multiple' | null>(null);
  const [isProductInUse, setIsProductInUse] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState<Partial<Product>>({
    id: '',
    name: '',
    category: 'Makanan',
    price: 0,
    stock: 0,
    image: '',
  });
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const filteredProducts = products
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({
        id: '',
        name: '',
        category: 'Makanan',
        price: 0,
        stock: 0,
        image: `https://picsum.photos/seed/${Math.random()}/200/200`,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      setProducts((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? { ...p, ...formData } as Product : p))
      );
      if (supabase) {
        try {
          const { error } = await supabase.from('products').update({
            name: formData.name,
            category: formData.category,
            price: formData.price,
            stock: formData.stock,
            image: formData.image
          }).eq('id', editingProduct.id);
          
          if (error) throw error;
          showToast('Barang berhasil diperbarui!', 'success');
        } catch (error: any) {
          console.error('Error updating product in Supabase:', error);
          showToast('Gagal update ke database: ' + error.message, 'error');
          return;
        }
      } else {
        showToast('Barang berhasil diperbarui!', 'success');
      }
    } else {
      let newId = formData.id;
      if (!newId) {
        let maxId = 0;
        products.forEach(p => {
          if (p.id.startsWith('DB-')) {
            const numStr = p.id.substring(3);
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num > maxId) {
              maxId = num;
            }
          }
        });
        const nextId = maxId + 1;
        newId = `DB-${nextId.toString().padStart(10, '0')}`;
      } else {
        if (products.some(p => p.id === newId)) {
          showToast('ID Barang sudah digunakan!', 'error');
          return;
        }
      }
      
      const newProduct: Product = {
        ...formData,
        id: newId,
      } as Product;
      setProducts((prev) => [...prev, newProduct]);
      
      if (supabase) {
        try {
          const { error } = await supabase.from('products').insert(newProduct);
          if (error) throw error;
          showToast('Barang berhasil ditambahkan!', 'success');
        } catch (error: any) {
          console.error('Error inserting product to Supabase:', error);
          showToast('Gagal menambah ke database: ' + error.message, 'error');
          return;
        }
      } else {
        showToast('Barang berhasil ditambahkan!', 'success');
      }
    }
    handleCloseModal();
  };

  const handleDeleteClick = (id: string) => {
    const isUsed = transactions.some(t => t.items.some(item => item.id === id));
    setIsProductInUse(isUsed);
    setProductToDelete(id);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    
    const idsToDelete = productToDelete === 'multiple' ? selectedIds : [productToDelete as string];
    
    setProducts((prev) => prev.filter((p) => !idsToDelete.includes(p.id)));
    setProductToDelete(null);
    setSelectedIds([]);
    
    if (supabase) {
      try {
        const { error } = await supabase.from('products').delete().in('id', idsToDelete);
        if (error) throw error;
        showToast('Barang berhasil dihapus!', 'success');
      } catch (error: any) {
        console.error('Error deleting product from Supabase:', error);
        showToast('Gagal menghapus dari database: ' + error.message, 'error');
      }
    } else {
      showToast('Barang berhasil dihapus!', 'success');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(p => p.id));
    }
  };

  const handleDeleteSelectedClick = () => {
    const isAnyUsed = transactions.some(t => 
      t.items.some(item => selectedIds.includes(item.id))
    );
    setIsProductInUse(isAnyUsed);
    setProductToDelete('multiple');
  };

  const handleDownloadAllQR = async () => {
    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();
      
      // We need to render all QR codes temporarily to get their SVG data
      // We'll use a hidden div to render them
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      for (const product of products) {
        // Create a temporary container for this QR code
        const qrContainer = document.createElement('div');
        container.appendChild(qrContainer);

        // We can't easily use QRCodeSVG component directly in DOM without React rendering it.
        // Instead we can use a canvas-based approach or just generate the SVG string directly if possible.
        // Since we are in React, we can render a hidden list of QRCodes in the component
        // and just query them here.
      }
      
      // Clean up
      document.body.removeChild(container);
    } catch (error) {
      console.error('Failed to download QR codes', error);
      showToast('Gagal mengunduh QR Code', 'error');
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleDownloadDataBarangPDF = () => {
    const doc = new jsPDF();
    
    const tableRows = filteredProducts.map((product, index) => [
      index + 1,
      product.id,
      product.name,
      product.category,
      `Rp ${product.price.toLocaleString('id-ID')}`
    ]);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DATA BARANG', 105, 15, { align: 'center' });
    
    doc.setFontSize(16);
    doc.text(settings.storeName.toUpperCase(), 105, 23, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.text(settings.storeAddress || 'Alamat Toko', 105, 29, { align: 'center' });

    autoTable(doc, {
      head: [
        [
          { content: 'No.\nUrut', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'ID Barang', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Nama Barang', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Kategori', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } },
          { content: 'Harga', styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] } }
        ]
      ],
      body: tableRows,
      startY: 40,
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
        4: { halign: 'right', cellWidth: 35 }
      },
      margin: { top: 15, left: 15, right: 15 }
    });

    doc.save('Data_Barang.pdf');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Data Barang</h1>
        <div className="flex w-full sm:w-auto gap-3 flex-wrap justify-end">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari barang..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={handleDownloadDataBarangPDF}
            disabled={filteredProducts.length === 0}
            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Unduh PDF Data Barang"
          >
            <FileDown className="w-5 h-5" />
          </button>
          <button
            onClick={async () => {
              setIsDownloadingAll(true);
              try {
                const zip = new JSZip();
                
                // Get all SVG elements that we rendered hidden
                const svgs = document.querySelectorAll('.hidden-qr-codes svg');
                
                const promises = Array.from(svgs).map((svg, index) => {
                  return new Promise<void>((resolve) => {
                    const product = products[index];
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                      canvas.width = img.width;
                      canvas.height = img.height;
                      // Fill white background
                      if (ctx) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                        
                        // Add text (product name and ID)
                        ctx.fillStyle = '#000000';
                        ctx.font = '16px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(product.name, canvas.width / 2, canvas.height - 25);
                        ctx.font = '12px sans-serif';
                        ctx.fillStyle = '#666666';
                        ctx.fillText(`ID: ${product.id}`, canvas.width / 2, canvas.height - 10);
                      }
                      
                      const base64Data = canvas.toDataURL('image/png').replace(/^data:image\/(png|jpg);base64,/, "");
                      zip.file(`QR-${product.name.replace(/[^a-z0-9]/gi, '_')}.png`, base64Data, {base64: true});
                      resolve();
                    };
                    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                  });
                });

                await Promise.all(promises);
                const content = await zip.generateAsync({type: "blob"});
                saveAs(content, "Semua_QRCode_Barang.zip");
                showToast('Semua QR Code berhasil diunduh!', 'success');
              } catch (error) {
                console.error('Failed to download QR codes', error);
                showToast('Gagal mengunduh QR Code', 'error');
              } finally {
                setIsDownloadingAll(false);
              }
            }}
            disabled={isDownloadingAll || products.length === 0}
            className="p-2 bg-red-600 text-white border border-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Unduh Semua QR"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {/* Hidden QR Codes for downloading all */}
      <div className="hidden-qr-codes" style={{ display: 'none' }}>
        {products.map(product => (
          <QRCodeSVG 
            key={`hidden-qr-${product.id}`}
            value={product.id} 
            size={250} // Make it slightly larger to accommodate text at bottom
            level="H"
            includeMargin={true}
          />
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredProducts.length > 0 && (
          <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="text-gray-500 hover:text-indigo-600 transition-colors"
                title={selectedIds.length === filteredProducts.length ? "Batal pilih semua" : "Pilih semua"}
              >
                {selectedIds.length > 0 && selectedIds.length === filteredProducts.length ? (
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4">No. Urut</th>
                <th className="px-6 py-4">ID Barang</th>
                <th className="px-6 py-4">Produk</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Harga</th>
                <th className="px-6 py-4 text-center">QR Code</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product, index) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleSelect(product.id)}
                      className="text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                      {selectedIds.includes(product.id) ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">
                    {product.id}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                        referrerPolicy="no-referrer"
                      />
                      <span className="font-medium text-gray-900">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-900 font-medium">
                    Rp {product.price.toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => setShowQrModal(product)}
                      className="inline-flex items-center justify-center p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Lihat QR Code"
                    >
                      <QrCode className="w-5 h-5" />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(product)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(product.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Tidak ada barang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">QR Code Barang</h2>
              <button
                onClick={() => setShowQrModal(null)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 flex flex-col items-center justify-center space-y-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <QRCodeSVG 
                  value={showQrModal.id} 
                  size={200}
                  level="H"
                  includeMargin={true}
                  className="qr-code-svg"
                />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-gray-900 text-lg">{showQrModal.name}</h3>
                <p className="text-gray-500 text-sm mt-1">ID: {showQrModal.id}</p>
              </div>
              <button
                onClick={() => {
                  const svg = document.querySelector('.qr-code-svg');
                  if (svg) {
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                      canvas.width = img.width;
                      canvas.height = img.height;
                      ctx?.drawImage(img, 0, 0);
                      const pngFile = canvas.toDataURL('image/png');
                      const downloadLink = document.createElement('a');
                      downloadLink.download = `QR-${showQrModal.name}.png`;
                      downloadLink.href = `${pngFile}`;
                      downloadLink.click();
                    };
                    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                  }
                }}
                className="w-full bg-red-600 text-white py-2.5 rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                Unduh QR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                {editingProduct ? 'Edit Barang' : 'Tambah Barang'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Barang / Barcode (Opsional)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.id || ''}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    disabled={!!editingProduct}
                    placeholder="Kosongkan untuk auto-generate"
                  />
                  {!editingProduct && (
                    <button
                      type="button"
                      onClick={() => setIsScanning(true)}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                      title="Scan Barcode"
                    >
                      <QrCode className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Barang</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as Category })}
                >
                  <option value="Makanan">Makanan</option>
                  <option value="Minuman">Minuman</option>
                  <option value="Snack">Snack</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Harga (Rp)</label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Gambar</label>
                <div className="space-y-2">
                  <input
                    type="url"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  />
                  {formData.image && (
                    <div className="w-full h-32 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                      <img
                        src={formData.image}
                        alt="Preview"
                        className="w-full h-full object-contain"
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
              </div>
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isProductInUse ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {isProductInUse ? 'Tidak Dapat Menghapus' : 'Hapus Barang'}
              </h3>
              <p className="text-gray-500 text-sm mb-6">
                {isProductInUse 
                  ? (productToDelete === 'multiple' ? "Beberapa barang yang dipilih sudah pernah dibeli (ada di riwayat transaksi). Untuk menjaga data riwayat transaksi, barang-barang tersebut tidak dapat dihapus." : "Barang ini sudah pernah dibeli (ada di riwayat transaksi). Untuk menjaga data riwayat transaksi, barang ini tidak dapat dihapus.")
                  : (productToDelete === 'multiple' ? `Apakah Anda yakin ingin menghapus ${selectedIds.length} barang terpilih? Tindakan ini tidak dapat dibatalkan.` : "Apakah Anda yakin ingin menghapus barang ini? Tindakan ini tidak dapat dibatalkan.")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setProductToDelete(null)}
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

      {/* QR Scanner Modal */}
      {isScanning && (
        <QRScannerModal
          onScan={(decodedText) => {
            setFormData({ ...formData, id: decodedText });
            setIsScanning(false);
          }}
          onClose={() => setIsScanning(false)}
        />
      )}
    </div>
  );
}
