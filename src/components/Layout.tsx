import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ArrowDownToLine,
  Receipt,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  ListChecks,
  Shield,
  User as UserIcon,
  Indent,
  Outdent,
  LogOut,
  UserCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  storeName: string;
  storeLogo?: string;
  storeAddress?: string;
  currentUser: User;
  onLogout: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transaksi', label: 'Transaksi', icon: ShoppingCart },
  { id: 'data-barang', label: 'Data Barang', icon: Package },
  { 
    id: 'barang-masuk', 
    label: 'Barang Masuk', 
    icon: ArrowDownToLine,
    subItems: [
      { id: 'barang-masuk-entri', label: 'Barang Masuk', icon: ArrowDownToLine },
      { id: 'barang-masuk-rekap', label: 'Rekap Barang Masuk', icon: ListChecks }
    ]
  },
  { 
    id: 'rekap-penjualan', 
    label: 'Rekap Nota', 
    icon: Receipt,
    subItems: [
      { id: 'rekap-penjualan-utama', label: 'Rekap Nota', icon: Receipt },
      { id: 'laporan-pelaporan', label: 'Rekap Penjualan', icon: FileText }
    ]
  },
  { 
    id: 'laporan', 
    label: 'Laporan', 
    icon: BarChart3,
    subItems: [
      { id: 'laporan-stok-penjualan', label: 'Laporan Stok Penjualan', icon: FileText },
      { id: 'laporan-rekap-barang', label: 'Rekap Barang Masuk dan Keluar', icon: ListChecks }
    ]
  },
  { 
    id: 'pengaturan', 
    label: 'Pengaturan', 
    icon: Settings,
    subItems: [
      { id: 'pengaturan-toko', label: 'Pengaturan Toko', icon: Settings },
      { id: 'pengaturan-admin', label: 'Pengaturan Admin', icon: Settings }
    ]
  },
];

export default function Layout({ children, activeTab, setActiveTab, storeName, storeLogo, storeAddress, currentUser, onLogout }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768 && window.innerWidth < 1280;
    }
    return false;
  });
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1280) {
        setIsSidebarCollapsed(true);
      } else if (window.innerWidth >= 1280) {
        setIsSidebarCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    'laporan': activeTab.startsWith('laporan') && activeTab !== 'laporan-pelaporan',
    'rekap-penjualan': activeTab.startsWith('rekap-penjualan') || activeTab === 'laporan-pelaporan',
    'barang-masuk': activeTab.startsWith('barang-masuk'),
    'pengaturan': activeTab.startsWith('pengaturan')
  });

  const toggleMenu = (id: string) => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
    }
    setOpenMenus(prev => {
      // If it's already open, close it. If it's closed, open it and close all others.
      if (prev[id]) {
        return { ...prev, [id]: false };
      } else {
        return { [id]: true };
      }
    });
  };

  const filteredNavItems = navItems.filter(item => {
    if (currentUser.role === 'admin') return true;
    return currentUser.permissions?.includes(item.id);
  });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans transition-colors">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transform transition-all duration-300 ease-in-out md:translate-x-0 md:static md:flex-shrink-0 flex flex-col ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}
      >
        <div className="h-full flex flex-col relative">
          <div className={`h-16 flex items-center border-b border-gray-200 ${isSidebarCollapsed ? 'justify-center px-0' : 'px-6'}`}>
            <div className="flex items-center gap-3 text-[#2A93A6] overflow-hidden">
              {storeLogo ? (
                <img src={storeLogo} alt="Logo" className="w-8 h-8 object-contain shrink-0" referrerPolicy="no-referrer" />
              ) : (
                <LayoutDashboard className="w-8 h-8 shrink-0" />
              )}
              {!isSidebarCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-lg font-bold tracking-tight truncate leading-tight">{storeName}</span>
                  {storeAddress && (
                    <span className="text-[10px] text-gray-500 truncate leading-tight mt-0.5">{storeAddress}</span>
                  )}
                </div>
              )}
            </div>
            <button
              className="ml-auto md:hidden text-gray-500 hover:text-gray-700 mr-4 shrink-0"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || (item.subItems && item.subItems.some(sub => sub.id === activeTab));
              
              if (item.subItems) {
                const isOpen = openMenus[item.id] && !isSidebarCollapsed;
                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      onClick={() => toggleMenu(item.id)}
                      title={isSidebarCollapsed ? item.label : undefined}
                      className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                        isActive
                          ? 'bg-[#2A93A6]/10 text-[#2A93A6]'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#2A93A6]' : 'text-gray-400'}`} />
                        {!isSidebarCollapsed && <span>{item.label}</span>}
                      </div>
                      {!isSidebarCollapsed && (
                        isOpen ? (
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )
                      )}
                    </button>
                    
                    {isOpen && !isSidebarCollapsed && (
                      <div className="pl-10 pr-2 py-1 space-y-1">
                        {item.subItems.map((subItem) => {
                          const SubIcon = subItem.icon;
                          const isSubActive = activeTab === subItem.id;
                          return (
                            <button
                              key={subItem.id}
                              onClick={() => {
                                setActiveTab(subItem.id);
                                setIsMobileMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                                isSubActive
                                  ? 'bg-[#2A93A6]/10 text-[#2A93A6]'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <SubIcon className={`w-4 h-4 shrink-0 ${isSubActive ? 'text-[#2A93A6]' : 'text-gray-400'}`} />
                              <span className="truncate">{subItem.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setOpenMenus({}); // Close all dropdowns when a non-dropdown menu is clicked
                    setIsMobileMenuOpen(false);
                  }}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                    isActive
                      ? 'bg-[#2A93A6]/10 text-[#2A93A6]'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#2A93A6]' : 'text-gray-400'}`} />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
          
          {!isSidebarCollapsed && (
            <div className="p-4 border-t border-gray-200">
              <p className="text-xs text-center text-gray-400">
                @2026_Design Mard | KasirQ v.00.01
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 transition-colors">
          <div className="flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg md:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 -ml-2 mr-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg hidden md:block transition-colors"
              title={isSidebarCollapsed ? "Perlebar Sidebar" : "Perkecil Sidebar"}
            >
              {isSidebarCollapsed ? <Indent className="w-5 h-5" /> : <Outdent className="w-5 h-5" />}
            </button>
            <span className="ml-2 text-lg font-semibold text-gray-900 md:hidden">
              {navItems.find((i) => i.id === activeTab || (i.subItems && i.subItems.some(sub => sub.id === activeTab)))?.label}
            </span>
            <span className="hidden md:block text-lg font-semibold text-gray-900">
              {navItems.find((i) => i.id === activeTab || (i.subItems && i.subItems.some(sub => sub.id === activeTab)))?.label}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-sm font-medium text-gray-500 hidden sm:block">
              {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}
            </div>
            <div className="relative">
              <button 
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-3 pl-6 border-l border-gray-200 hover:bg-gray-50 p-2 rounded-lg transition-colors"
              >
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-bold text-gray-900">{currentUser.name}</div>
                  <div className="text-xs text-gray-500 capitalize">{currentUser.role}</div>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  currentUser.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {currentUser.role === 'admin' ? <Shield className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                </div>
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                    {currentUser.role === 'admin' && (
                      <>
                        <button 
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            setActiveTab('pengaturan-admin');
                            setOpenMenus(prev => ({ ...prev, 'pengaturan': true }));
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <UserCircle className="w-4 h-4" />
                          Profil
                        </button>
                        <div className="h-px bg-gray-100 my-1" />
                      </>
                    )}
                    <button 
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Keluar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 transition-colors">
          <div className="h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
