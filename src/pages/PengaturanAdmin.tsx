import React, { useState } from 'react';
import { User } from '../types';
import { Users, Plus, Edit2, Trash2, Shield, User as UserIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastContext';

interface PengaturanAdminProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const AVAILABLE_PERMISSIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'transaksi', label: 'Transaksi' },
  { id: 'data-barang', label: 'Data Barang' },
  { id: 'barang-masuk', label: 'Barang Masuk' },
  { id: 'rekap-penjualan', label: 'Rekap Nota' },
  { id: 'laporan', label: 'Laporan' },
  { id: 'pengaturan', label: 'Pengaturan' }
];

export default function PengaturanAdmin({ users, setUsers }: PengaturanAdminProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'kasir' as 'admin' | 'kasir',
    permissions: [] as string[]
  });

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        username: user.username,
        password: '', // Don't show existing password
        role: user.role,
        permissions: user.permissions || []
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        username: '',
        password: '',
        role: 'kasir',
        permissions: ['transaksi'] // Default permission
      });
    }
    setIsModalOpen(true);
  };

  const handlePermissionChange = (permissionId: string) => {
    setFormData(prev => {
      const newPermissions = prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId];
      return { ...prev, permissions: newPermissions };
    });
  };

  const handleRoleChange = (role: 'admin' | 'kasir') => {
    setFormData(prev => ({
      ...prev,
      role,
      // If admin, automatically grant all permissions
      permissions: role === 'admin' ? AVAILABLE_PERMISSIONS.map(p => p.id) : prev.permissions
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingUser) {
      const updatedUser = {
        name: formData.name,
        username: formData.username,
        role: formData.role,
        permissions: formData.permissions,
        ...(formData.password ? { password: formData.password } : {})
      };

      if (supabase) {
        try {
          const { error } = await supabase
            .from('users')
            .update(updatedUser)
            .eq('id', editingUser.id);
          
          if (error) throw error;
        } catch (error: any) {
          console.error('Error updating user:', error);
          showToast('Gagal memperbarui pengguna di database: ' + error.message + '. Data hanya diperbarui di aplikasi.', 'error');
        }
      }

      setUsers(users.map(u => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            ...updatedUser
          };
        }
        return u;
      }));
      showToast('Pengguna berhasil diperbarui!', 'success');
    } else {
      // Generate a UUID-like string for the ID to satisfy Supabase UUID requirements
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      const newUser: User = {
        id: generateUUID(),
        name: formData.name,
        username: formData.username,
        role: formData.role,
        permissions: formData.permissions,
        password: formData.password
      };

      if (supabase) {
        let insertSuccess = false;
        let lastError = null;

        // Try 1: As is (with UUID)
        try {
          const { error } = await supabase.from('users').insert(newUser);
          if (error) throw error;
          insertSuccess = true;
        } catch (e: any) {
          lastError = e;
          // Try 2: With numeric ID (fits in integer/bigint)
          try {
            const numericId = Math.floor(Math.random() * 1000000).toString();
            const numericUser = { ...newUser, id: numericId };
            const { error } = await supabase.from('users').insert(numericUser);
            if (error) throw error;
            newUser.id = numericId;
            insertSuccess = true;
          } catch (e2: any) {
            lastError = e2;
            // Try 3: Without ID (let DB generate)
            try {
              const { id, ...userWithoutId } = newUser;
              const { data, error } = await supabase.from('users').insert(userWithoutId).select().single();
              if (error) throw error;
              if (data && data.id) newUser.id = data.id.toString();
              insertSuccess = true;
            } catch (e3: any) {
              lastError = e3;
              // Try 4: Without password (maybe column doesn't exist)
              try {
                const { password, ...userWithoutPwd } = newUser;
                const { error } = await supabase.from('users').insert(userWithoutPwd);
                if (error) throw error;
                insertSuccess = true;
              } catch (e4: any) {
                lastError = e4;
                // Try 5: Without ID and without password
                try {
                  const { id, password, ...userWithoutIdPwd } = newUser;
                  const { data, error } = await supabase.from('users').insert(userWithoutIdPwd).select().single();
                  if (error) throw error;
                  if (data && data.id) newUser.id = data.id.toString();
                  insertSuccess = true;
                } catch (e5: any) {
                  lastError = e5;
                }
              }
            }
          }
        }

        if (!insertSuccess) {
          console.error('All insert attempts failed. Last error:', lastError);
          showToast(`Gagal menyimpan ke database: ${lastError?.message || 'Unknown error'}. Data hanya disimpan di aplikasi.`, 'error');
        } else {
          showToast('Pengguna berhasil ditambahkan!', 'success');
        }
      } else {
        showToast('Pengguna berhasil ditambahkan!', 'success');
      }

      setUsers([...users, newUser]);
    }
    
    setIsModalOpen(false);
  };

  const handleDeleteClick = (id: string) => {
    setUserToDelete(id);
  };

  const handleDeleteConfirm = async () => {
    if (userToDelete) {
      if (supabase) {
        try {
          const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userToDelete);
          
          if (error) throw error;
          showToast('Pengguna berhasil dihapus!', 'success');
        } catch (error: any) {
          console.error('Error deleting user:', error);
          showToast('Gagal menghapus pengguna di database: ' + error.message + '. Data hanya dihapus di aplikasi.', 'error');
        }
      } else {
        showToast('Pengguna berhasil dihapus!', 'success');
      }
      setUsers(users.filter(u => u.id !== userToDelete));
      setUserToDelete(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pengaturan Admin</h1>
            <p className="text-gray-500 text-sm">Kelola akses pengguna dan kasir</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Tambah Pengguna
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Nama</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Username</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Role</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.username}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role === 'admin' ? <Shield className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />}
                      {user.role === 'admin' ? 'Administrator' : 'Kasir'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(user)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit Pengguna"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(user.id)}
                        disabled={user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Hapus Pengguna"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Hapus Pengguna</h3>
              <p className="text-gray-500 text-sm mb-6">
                Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setUserToDelete(null)}
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

      {/* Modal Tambah/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingUser ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Trash2 className="w-4 h-4 opacity-0" /> {/* Placeholder for spacing */}
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-3" autoComplete="off">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Password {editingUser && <span className="text-gray-400 font-normal">(Kosongkan jika tidak ingin mengubah)</span>}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  value={formData.role}
                  onChange={(e) => handleRoleChange(e.target.value as 'admin' | 'kasir')}
                >
                  <option value="kasir">Kasir</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Akses Halaman</label>
                <div className="space-y-1 border border-gray-200 rounded-xl p-3 bg-gray-50 max-h-32 overflow-y-auto">
                  {AVAILABLE_PERMISSIONS.map((permission) => (
                    <label key={permission.id} className="flex items-center gap-2.5 p-1.5 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        checked={formData.permissions.includes(permission.id)}
                        onChange={() => handlePermissionChange(permission.id)}
                        disabled={formData.role === 'admin'} // Admins always have all access
                      />
                      <span className="text-xs text-gray-700 font-medium">{permission.label}</span>
                    </label>
                  ))}
                </div>
                {formData.role === 'admin' && (
                  <p className="text-[10px] text-gray-500 mt-1.5">Administrator memiliki akses ke semua halaman secara otomatis.</p>
                )}
              </div>
              
              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
