import React, { useState, useEffect } from 'react';
import { User, StoreSettings } from '../types';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { useToast } from '../components/ToastContext';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[];
  settings: StoreSettings;
}

export default function Login({ onLogin, users, settings }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const { showToast } = useToast();

  const slideImages = [
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1556745753-b2904692b3cd?auto=format&fit=crop&q=80&w=1000"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Find user by username
    const user = users.find(u => u.username === username);

    if (!user) {
      setError('Username tidak ditemukan');
      return;
    }

    // In a real app, we would hash and compare passwords.
    // For this demo, we'll just check if the password matches the user's password field
    // Since we didn't store passwords in the initial mock data, let's assume password is the same as username for default users,
    // or whatever is stored in the user object.
    const userPassword = user.password || user.username;

    if (password !== userPassword) {
      setError('Password salah');
      return;
    }

    showToast(`Selamat datang, ${user.name}!`, 'success');
    onLogin(user);
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Slider */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gray-900">
        {/* Images */}
        {slideImages.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <img 
              src={img} 
              alt={`Slide ${index + 1}`} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {/* Dark Overlay */}
            <div className="absolute inset-0 bg-black/40"></div>
          </div>
        ))}

        {/* Content over slider */}
        <div className="absolute inset-0 z-20 flex flex-col justify-end p-8 lg:p-12">
          {/* Bottom Text & Indicators */}
          <div>
            <h1 className="text-3xl font-bold mb-3 leading-tight text-white drop-shadow-lg">
              Solusi Kasir Pintar<br/>Untuk Bisnis Anda
            </h1>
            <p className="text-base text-white/90 mb-6 max-w-md drop-shadow-md">
              Kelola transaksi, stok, dan laporan dengan mudah.
            </p>
            
            {/* Indicators */}
            <div className="flex gap-2">
              {slideImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentSlide ? 'w-8 bg-[#00a67c]' : 'w-2 bg-white/50 hover:bg-white/80'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex flex-col justify-center py-6 px-4 sm:px-6 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-sm">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-5">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.storeName} className="w-14 h-14 object-contain rounded-2xl shadow-sm mb-2" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-14 h-14 bg-[#00a67c] rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-sm mb-2">
                {settings.storeName.charAt(0)}
              </div>
            )}
            <h2 className="text-lg font-bold text-gray-900 mb-0.5">{settings.storeName}</h2>
            <p className="text-[11px] text-gray-500 mb-4">{settings.storeAddress}</p>
            
            <h3 className="text-base font-bold text-gray-900 mb-0.5">Login</h3>
            <p className="text-[11px] text-gray-600">
              Kamu dapat masuk sebagai Admin ataupun Kasir
            </p>
          </div>

          {/* Form */}
          <form className="space-y-3" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-sm font-medium border border-red-100">
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-gray-700 mb-1">
                User
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#00a67c] focus:border-[#00a67c] sm:text-sm"
                placeholder="User"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#00a67c] focus:border-[#00a67c] sm:text-sm pr-10"
                  placeholder="Password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              <div className="flex justify-end mt-1.5">
                <a href="#" className="text-xs font-medium text-[#00a67c] hover:text-[#008f6a]">
                  Lupa Password?
                </a>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-[#00a67c] hover:bg-[#008f6a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00a67c] transition-colors"
              >
                Login
              </button>
            </div>
          </form>

          <div className="mt-6 text-center flex flex-col gap-2">
            <div className="text-xs text-gray-600">
              Belum punya akun?{' '}
              <a href="#" className="font-medium text-[#00a67c] hover:text-[#008f6a]">
                Daftar disini
              </a>
            </div>
            <div className="text-[10px] text-gray-400">
              @2026_Desigh Mard | KasirQ v.00.01
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
