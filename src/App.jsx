import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { 
  ShoppingBag, 
  Users, 
  Truck, 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  LogOut, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Eye, 
  CheckCircle, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  X, 
  RefreshCw,
  Home,
  Receipt,
  ShieldAlert,
  UserCheck
} from 'lucide-react';

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
// URL del backend. En Vite, VITE_API_BASE_URL se inyecta durante el build.
const getApiBaseUrl = () => {
  const viteUrl = import.meta.env.VITE_API_BASE_URL;
  if (viteUrl) return viteUrl.replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.VITE_API_BASE_URL) {
    return window.VITE_API_BASE_URL.replace(/\/+$/, '');
  }
  return 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();

// Currency & Date Formatters for Spanish (Colombia)
const formatCOP = (amount) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(num);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch (e) {
    return dateStr;
  }
};

const getItemId = (item, idField = 'id') => item?.[idField] ?? item?.id ?? item?._id;

// ==========================================
// HTTP CLIENT WITH TIMEOUT & ERROR NORMALIZATION
// ==========================================
const fetchWithAuth = async (endpoint, options = {}, onUnauthorized) => {
  const token = localStorage.getItem('dona_velez_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 401) {
      if (onUnauthorized) onUnauthorized();
      throw { detail: 'Sesión expirada o no autorizada.', code: 'UNAUTHORIZED' };
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Normalize errors according to backend specs
      if (response.status === 422 && (Array.isArray(data.errors) || Array.isArray(data.detail))) {
        throw {
          detail: 'Error de validación en el formulario',
          code: 'VALIDATION_ERROR',
          errors: data.errors || data.detail, // [{loc, msg, type}]
        };
      }
      const backendCode = String(data.code || data.detail || '').toUpperCase();
      if (response.status === 409 && backendCode === 'STOCK_INSUFICIENTE') {
        throw {
          detail: 'Stock insuficiente para uno o más productos de la venta.',
          code: 'STOCK_INSUFICIENTE',
        };
      }
      const detail = typeof data.detail === 'string'
        ? data.detail
        : 'Ocurrió un error inesperado en el servidor.';
      throw {
        detail,
        code: data.code || 'SERVER_ERROR',
      };
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw { detail: 'Tiempo de espera agotado (20s). Intente de nuevo.', code: 'TIMEOUT' };
    }
    throw err;
  }
};

// ==========================================
// AUTH CONTEXT
// ==========================================
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('dona_velez_token'));
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const logout = (reason) => {
    localStorage.removeItem('dona_velez_token');
    setToken(null);
    setUser(null);
    if (reason) setAuthError(reason);
  };

  const fetchMe = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const userData = await fetchWithAuth('/api/auth/me', {}, () => logout('Sesión expirada. Por favor inicie sesión nuevamente.'));
      setUser(userData);
      setAuthError(null);
    } catch (err) {
      logout(err.detail || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, [token]);

  const login = async (email, password) => {
    setAuthError(null);
    try {
      const res = await fetchWithAuth('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const jwt = res.accessToken || res.access_token || res.token;
      if (!jwt) throw { detail: 'Respuesta de login inválida' };
      localStorage.setItem('dona_velez_token', jwt);
      setToken(jwt);
      // fetch me will trigger due to token change
      return true;
    } catch (err) {
      setAuthError(err.detail || 'Credenciales incorrectas');
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, authError, setAuthError }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// ==========================================
// TOAST NOTIFICATIONS STATE & COMPONENT
// ==========================================
const Toast = ({ message, type, onClose }) => {
  if (!message) return null;
  const isError = type === 'error';
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 p-4 border-2 border-[#3E2723] rounded-xl font-bold uppercase tracking-wider text-sm shadow-[4px_4px_0px_#3E2723] transition-all animate-bounce ${
      isError ? 'bg-[#D94452] text-white' : 'bg-[#3F9B4F] text-white'
    }`}>
      {isError ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-75 focus:outline-none">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// ==========================================
// MEMPHIS DECORATIVE ELEMENTS & LOGO
// ==========================================
const GuavaLogo = ({ className = "w-10 h-10" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Guava Fruit Base */}
    <circle cx="50" cy="55" r="38" fill="#3F9B4F" stroke="#3E2723" strokeWidth="6" />
    <circle cx="50" cy="55" r="28" fill="#D94452" stroke="#3E2723" strokeWidth="4" />
    <circle cx="50" cy="55" r="18" fill="#E91E63" />
    {/* Seeds */}
    <circle cx="44" cy="48" r="3" fill="#FBF3E0" />
    <circle cx="56" cy="48" r="3" fill="#FBF3E0" />
    <circle cx="50" cy="62" r="3" fill="#FBF3E0" />
    <circle cx="42" cy="58" r="2.5" fill="#FBF3E0" />
    <circle cx="58" cy="58" r="2.5" fill="#FBF3E0" />
    {/* Leaf */}
    <path d="M50 18C50 18 65 8 75 20C75 20 65 35 50 18Z" fill="#3F9B4F" stroke="#3E2723" strokeWidth="4" />
    <path d="M50 18L62 21" stroke="#3E2723" strokeWidth="3" />
  </svg>
);

const MemphisDots = ({ className = "" }) => (
  <div className={`grid grid-cols-4 gap-2 opacity-30 ${className}`}>
    {[...Array(16)].map((_, i) => (
      <div key={i} className="w-2 h-2 rounded-full bg-[#3E2723]" />
    ))}
  </div>
);

const MemphisSticker = ({ text, color = "bg-[#E91E63]", rotate = "-rotate-3" }) => (
  <span className={`inline-block px-3 py-1 border-2 border-[#3E2723] rounded-lg font-black text-xs text-white uppercase shadow-[2px_2px_0px_#3E2723] transform ${rotate} ${color}`}>
    {text}
  </span>
);

// ==========================================
// LOGIN VIEW
// ==========================================
const LoginView = () => {
  const { login, authError, setAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      // Error handled in auth provider
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF3E0] text-[#3E2723] flex items-center justify-center p-4 relative overflow-hidden font-['Outfit']">
      {/* Decorative Memphis Background Objects */}
      <div className="absolute top-10 left-10 transform -rotate-12 hidden md:block">
        <MemphisDots />
      </div>
      <div className="absolute bottom-12 right-12 transform rotate-45 hidden md:block">
        <div className="w-24 h-6 bg-[#E91E63] border-2 border-[#3E2723] shadow-[3px_3px_0px_#3E2723]" />
      </div>
      <div className="absolute top-1/4 right-1/6 w-12 h-12 rounded-full border-4 border-[#3F9B4F] border-dashed animate-spin-slow hidden md:block" />

      {/* Login Card */}
      <div className="w-full max-w-md bg-white border-2 border-[#3E2723] rounded-2xl p-8 shadow-[8px_8px_0px_#3E2723] relative z-10">
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-2xl shadow-[3px_3px_0px_#3E2723] mb-3 transform -rotate-3">
            <GuavaLogo className="w-14 h-14" />
          </div>
          <h1 className="font-['Rubik'] font-black text-2xl uppercase tracking-wider text-[#3E2723]">
            Fábrica Doña Vélez
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest text-[#D94452] mt-1">
            Bocadillos Veleños Tradicionales
          </p>
        </div>

        {authError && (
          <div className="mb-6 p-4 bg-[#D94452] text-white border-2 border-[#3E2723] rounded-xl shadow-[3px_3px_0px_#3E2723] text-xs font-bold uppercase flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p>{authError}</p>
              <button 
                onClick={() => setAuthError(null)} 
                className="mt-1 underline text-white hover:text-[#FBF3E0] font-black"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block font-['Rubik'] font-black text-xs uppercase mb-2 text-[#3E2723]">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@donavelez.com"
              className="w-full px-4 py-3 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl font-bold text-sm text-[#3E2723] focus:outline-none focus:border-[#D94452] transition-colors"
            />
          </div>

          <div>
            <label className="block font-['Rubik'] font-black text-xs uppercase mb-2 text-[#3E2723]">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl font-bold text-sm text-[#3E2723] focus:outline-none focus:border-[#D94452] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-4 bg-[#D94452] hover:bg-[#c03543] text-white font-['Rubik'] font-black text-sm uppercase tracking-wider border-2 border-[#3E2723] rounded-xl shadow-[4px_4px_0px_#3E2723] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Iniciando...
              </>
            ) : (
              'Ingresar al Sistema'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t-2 border-[#3E2723]/20 text-center">
          <p className="text-xs font-bold uppercase text-[#3E2723]/60">
            Control de Calidad e Inventario v2.0
          </p>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// DASHBOARD (INICIO) VIEW
// ==========================================
const DashboardView = ({ onNavigate }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalClientes: 0,
    totalProductos: 0,
    totalProveedores: 0,
    totalVentas: 0,
    stockBajoCount: 0,
    ultimasVentas: [],
    lowStockItems: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const promises = [
        fetchWithAuth('/api/clientes?pagina=1&tamano=1').catch(() => ({ total: 0 })),
        fetchWithAuth('/api/productos?pagina=1&tamano=100').catch(() => ({ items: [], total: 0 })),
        fetchWithAuth('/api/proveedores?pagina=1&tamano=1').catch(() => ({ total: 0 })),
        fetchWithAuth('/api/ventas?pagina=1&tamano=5').catch(() => ({ items: [], total: 0 })),
      ];

      const [resClientes, resProductos, resProveedores, resVentas] = await Promise.all(promises);

      const prods = resProductos.items || [];
      const lowStock = prods.filter((p) => p.stock <= 5);

      setStats({
        totalClientes: resClientes.total || 0,
        totalProductos: resProductos.total || prods.length || 0,
        totalProveedores: resProveedores.total || 0,
        totalVentas: resVentas.total || 0,
        stockBajoCount: lowStock.length,
        ultimasVentas: resVentas.items || [],
        lowStockItems: lowStock,
      });
    } catch (err) {
      setError('No se pudieron cargar algunas métricas del servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="w-10 h-10 text-[#D94452] animate-spin mb-4" />
        <p className="font-['Rubik'] font-black uppercase text-sm tracking-wider">Cargando Panel Principal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Neo-Memphis Hero Card */}
      <div className="relative bg-[#FFFFFF] border-2 border-[#3E2723] rounded-2xl p-6 md:p-8 shadow-[6px_6px_0px_#3E2723] overflow-hidden">
        <div className="absolute top-3 right-3 flex gap-2">
          <MemphisSticker text="Artesanal" color="bg-[#E91E63]" rotate="-rotate-6" />
          <MemphisSticker text="100% Guayaba" color="bg-[#3F9B4F]" rotate="rotate-3" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <h1 className="font-['Rubik'] font-black text-2xl md:text-3xl uppercase tracking-wide text-[#3E2723] mb-2">
            ¡Hola, {user?.nombre || user?.email || 'Usuario'}!
          </h1>
          <p className="font-bold text-sm md:text-base text-[#3E2723]/80 mb-4">
            Bienvenido al panel de administración de <span className="text-[#D94452] font-extrabold">Doña Vélez</span>. 
            Monitorea el inventario de bocadillos y la gestión comercial.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_#3E2723]">
            <UserCheck className="w-4 h-4 text-[#3F9B4F]" />
            Rol Activo: <span className="text-[#E91E63]">{user?.rol || 'GENERAL'}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl shadow-[3px_3px_0px_#3E2723] flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-[#D94452]">{error}</span>
          <button onClick={loadDashboardData} className="px-3 py-1 bg-[#D94452] text-white text-xs font-black uppercase rounded-lg border-2 border-[#3E2723]">
            Reintentar
          </button>
        </div>
      )}

      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card Clientes */}
        <div 
          onClick={() => onNavigate('clientes')} 
          className="bg-white border-2 border-[#3E2723] rounded-xl p-5 shadow-[4px_4px_0px_#3E2723] hover:-translate-x-0.5 hover:-translate-y-0.5 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex justify-between items-start mb-3">
            <span className="font-['Rubik'] font-black text-xs uppercase text-[#3E2723]/70">Clientes</span>
            <div className="p-2 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-lg shadow-[2px_2px_0px_#3E2723]">
              <Users className="w-5 h-5 text-[#3E2723]" />
            </div>
          </div>
          <span className="font-['Rubik'] font-black text-3xl text-[#3E2723]">{stats.totalClientes}</span>
        </div>

        {/* Card Productos */}
        <div 
          onClick={() => onNavigate('productos')} 
          className="bg-white border-2 border-[#3E2723] rounded-xl p-5 shadow-[4px_4px_0px_#3E2723] hover:-translate-x-0.5 hover:-translate-y-0.5 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex justify-between items-start mb-3">
            <span className="font-['Rubik'] font-black text-xs uppercase text-[#3E2723]/70">Productos</span>
            <div className="p-2 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-lg shadow-[2px_2px_0px_#3E2723]">
              <Package className="w-5 h-5 text-[#3E2723]" />
            </div>
          </div>
          <span className="font-['Rubik'] font-black text-3xl text-[#3E2723]">{stats.totalProductos}</span>
        </div>

        {/* Card Proveedores */}
        <div 
          onClick={() => onNavigate('proveedores')} 
          className="bg-white border-2 border-[#3E2723] rounded-xl p-5 shadow-[4px_4px_0px_#3E2723] hover:-translate-x-0.5 hover:-translate-y-0.5 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex justify-between items-start mb-3">
            <span className="font-['Rubik'] font-black text-xs uppercase text-[#3E2723]/70">Proveedores</span>
            <div className="p-2 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-lg shadow-[2px_2px_0px_#3E2723]">
              <Truck className="w-5 h-5 text-[#3E2723]" />
            </div>
          </div>
          <span className="font-['Rubik'] font-black text-3xl text-[#3E2723]">{stats.totalProveedores}</span>
        </div>

        {/* Card Ventas */}
        <div 
          onClick={() => onNavigate('ventas')} 
          className="bg-white border-2 border-[#3E2723] rounded-xl p-5 shadow-[4px_4px_0px_#3E2723] hover:-translate-x-0.5 hover:-translate-y-0.5 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex justify-between items-start mb-3">
            <span className="font-['Rubik'] font-black text-xs uppercase text-[#3E2723]/70">Ventas</span>
            <div className="p-2 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-lg shadow-[2px_2px_0px_#3E2723]">
              <Receipt className="w-5 h-5 text-[#3E2723]" />
            </div>
          </div>
          <span className="font-['Rubik'] font-black text-3xl text-[#3E2723]">{stats.totalVentas}</span>
        </div>

        {/* Card Stock Bajo */}
        <div 
          onClick={() => onNavigate('productos')} 
          className={`border-2 border-[#3E2723] rounded-xl p-5 shadow-[4px_4px_0px_#3E2723] hover:-translate-x-0.5 hover:-translate-y-0.5 cursor-pointer transition-all flex flex-col justify-between ${
            stats.stockBajoCount > 0 ? 'bg-[#D94452] text-white' : 'bg-white text-[#3E2723]'
          }`}
        >
          <div className="flex justify-between items-start mb-3">
            <span className={`font-['Rubik'] font-black text-xs uppercase ${stats.stockBajoCount > 0 ? 'text-white' : 'text-[#3E2723]/70'}`}>
              Stock Bajo (≤ 5)
            </span>
            <div className="p-2 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-lg shadow-[2px_2px_0px_#3E2723]">
              <AlertTriangle className="w-5 h-5 text-[#D94452]" />
            </div>
          </div>
          <span className="font-['Rubik'] font-black text-3xl">{stats.stockBajoCount}</span>
        </div>
      </div>

      {/* LOWER DASHBOARD SECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Stock Alerts List */}
        <div className="bg-white border-2 border-[#3E2723] rounded-2xl p-6 shadow-[6px_6px_0px_#3E2723]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-[#3E2723]">
            <h2 className="font-['Rubik'] font-black text-lg uppercase tracking-wide text-[#3E2723] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#D94452]" />
              Alertas de Stock Bajo
            </h2>
            <button 
              onClick={() => onNavigate('productos')} 
              className="text-xs font-black uppercase text-[#D94452] hover:underline"
            >
              Ver Todos
            </button>
          </div>

          {stats.lowStockItems.length === 0 ? (
            <div className="text-center py-8 bg-[#FBF3E0] rounded-xl border-2 border-dashed border-[#3E2723]/40 p-4">
              <CheckCircle className="w-10 h-10 text-[#3F9B4F] mx-auto mb-2" />
              <p className="font-['Rubik'] font-black text-xs uppercase text-[#3E2723]">
                Inventario óptimo. Ningún producto tiene stock crítico.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.lowStockItems.map((prod) => (
                <div 
                  key={getItemId(prod, 'idProducto')} 
                  className="flex items-center justify-between p-3 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl font-bold text-sm"
                >
                  <div>
                    <p className="font-black text-[#3E2723] uppercase">{prod.nombreProducto}</p>
                    <p className="text-xs text-[#3E2723]/70">{formatCOP(prod.precio)}</p>
                  </div>
                  <span className="px-3 py-1 bg-[#D94452] text-white border-2 border-[#3E2723] rounded-lg font-black text-xs uppercase shadow-[2px_2px_0px_#3E2723]">
                    Quedan: {prod.stock}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest Sales */}
        <div className="bg-white border-2 border-[#3E2723] rounded-2xl p-6 shadow-[6px_6px_0px_#3E2723]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-[#3E2723]">
            <h2 className="font-['Rubik'] font-black text-lg uppercase tracking-wide text-[#3E2723] flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#3F9B4F]" />
              Últimas 5 Ventas
            </h2>
            <button 
              onClick={() => onNavigate('ventas')} 
              className="text-xs font-black uppercase text-[#3F9B4F] hover:underline"
            >
              Ir a Ventas
            </button>
          </div>

          {stats.ultimasVentas.length === 0 ? (
            <div className="text-center py-8 bg-[#FBF3E0] rounded-xl border-2 border-dashed border-[#3E2723]/40 p-4">
              <p className="font-['Rubik'] font-black text-xs uppercase text-[#3E2723]/60">
                No hay ventas registradas recientemente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.ultimasVentas.map((v) => (
                <div 
                  key={getItemId(v, 'idVenta')} 
                  className="flex items-center justify-between p-3 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl font-bold text-sm"
                >
                  <div>
                    <p className="font-black text-[#3E2723] uppercase">
                      Venta #{v.idVenta}
                    </p>
                    <p className="text-xs text-[#3E2723]/70">{formatDate(v.fecha || v.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-[#3F9B4F]">{formatCOP(v.total || 0)}</p>
                    <span className="text-[10px] uppercase font-bold text-[#3E2723]/60">
                      {v.detalles?.length || 0} prod(s)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// GENERIC PAGINATED CRUD LIST COMPONENT
// ==========================================
const CRUDView = ({ 
  title, 
  icon: Icon, 
  endpoint, 
  idField = 'id',
  columns, 
  canCreate, 
  canEdit, 
  canDelete, 
  formFields, 
  onShowToast,
  transformPayload
}) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = search ? `&buscar=${encodeURIComponent(search)}` : '';
      const data = await fetchWithAuth(`${endpoint}?pagina=${page}&tamano=${pageSize}${q}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.detail || 'Error al cargar los datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, search, endpoint]);

  const handleOpenModal = (item = null) => {
    setEditingItem(item);
    setFieldErrors({});
    if (item) {
      const initial = {};
      formFields.forEach((f) => {
        initial[f.name] = item[f.name] !== undefined ? item[f.name] : '';
      });
      setFormData(initial);
    } else {
      const initial = {};
      formFields.forEach((f) => {
        initial[f.name] = f.defaultValue !== undefined ? f.defaultValue : '';
      });
      setFormData(initial);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      let payload = { ...formData };
      if (transformPayload) {
        payload = transformPayload(payload);
      }

      const isEdit = !!editingItem;
       const url = isEdit ? `${endpoint}/${getItemId(editingItem, idField)}` : endpoint;
      const method = isEdit ? 'PUT' : 'POST';

      await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload),
      });

      onShowToast(`Registro ${isEdit ? 'actualizado' : 'creado'} con éxito`, 'success');
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      if (err.errors) {
        // Map 422 errors to field name
        const errs = {};
        err.errors.forEach((e) => {
          const field = e.loc ? e.loc[e.loc.length - 1] : 'general';
          errs[field] = e.msg || e.message;
        });
        setFieldErrors(errs);
      } else {
        onShowToast(err.detail || 'Error al guardar el registro', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetchWithAuth(`${endpoint}/${id}`, { method: 'DELETE' });
      onShowToast('Registro eliminado con éxito', 'success');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err) {
      onShowToast(err.detail || 'Error al eliminar el registro', 'error');
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border-2 border-[#3E2723] rounded-2xl p-6 shadow-[6px_6px_0px_#3E2723]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl shadow-[2px_2px_0px_#3E2723]">
            <Icon className="w-6 h-6 text-[#D94452]" />
          </div>
          <div>
            <h1 className="font-['Rubik'] font-black text-xl uppercase text-[#3E2723] tracking-wide">{title}</h1>
            <p className="text-xs font-bold uppercase text-[#3E2723]/60">Gestión de datos y registros</p>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={() => handleOpenModal()}
            className="px-5 py-3 bg-[#D94452] text-white font-['Rubik'] font-black text-xs uppercase tracking-wider border-2 border-[#3E2723] rounded-xl shadow-[4px_4px_0px_#3E2723] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Crear {title.slice(0, -1)}
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white border-2 border-[#3E2723] rounded-xl p-3 shadow-[4px_4px_0px_#3E2723]">
        <Search className="w-5 h-5 text-[#3E2723]/60 ml-2" />
        <input
          type="text"
          placeholder={`BUSCAR EN ${title.toUpperCase()}...`}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full bg-transparent font-bold text-sm text-[#3E2723] focus:outline-none uppercase placeholder:text-[#3E2723]/40"
        />
        {search && (
          <button onClick={() => setSearch('')} className="p-1 hover:bg-[#FBF3E0] rounded-lg">
            <X className="w-4 h-4 text-[#3E2723]" />
          </button>
        )}
      </div>

      {/* Content Table / Cards */}
      {loading ? (
        <div className="p-12 text-center bg-white border-2 border-[#3E2723] rounded-2xl shadow-[6px_6px_0px_#3E2723]">
          <RefreshCw className="w-8 h-8 text-[#D94452] animate-spin mx-auto mb-2" />
          <p className="font-['Rubik'] font-black text-xs uppercase tracking-wider">Cargando información...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-[#FBF3E0] border-2 border-[#3E2723] rounded-2xl shadow-[6px_6px_0px_#3E2723]">
          <AlertTriangle className="w-10 h-10 text-[#D94452] mx-auto mb-2" />
          <p className="font-['Rubik'] font-black text-sm uppercase text-[#D94452] mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-[#3E2723] text-white font-['Rubik'] font-black text-xs uppercase rounded-xl border-2 border-[#3E2723]"
          >
            Reintentar
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center bg-white border-2 border-[#3E2723] rounded-2xl shadow-[6px_6px_0px_#3E2723] relative overflow-hidden">
          <MemphisDots className="absolute top-4 right-4" />
          <p className="font-['Rubik'] font-black text-base uppercase text-[#3E2723] mb-1">
            No se encontraron registros
          </p>
          <p className="text-xs font-bold uppercase text-[#3E2723]/60">
            {search ? 'Prueba con otra búsqueda' : 'Haz clic en crear para añadir el primero.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table */}
          <div className="hidden md:block bg-white border-2 border-[#3E2723] rounded-2xl shadow-[6px_6px_0px_#3E2723] overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#3E2723] text-[#FBF3E0] font-['Rubik'] font-black text-xs uppercase tracking-wider border-b-2 border-[#3E2723]">
                  {columns.map((col, idx) => (
                    <th key={idx} className="p-4">{col.header}</th>
                  ))}
                  {(canEdit || canDelete) && <th className="p-4 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#3E2723]/10 font-bold text-sm">
                {items.map((item, idx) => (
                   <tr key={getItemId(item, idField) || idx} className="hover:bg-[#FBF3E0]/50 transition-colors">
                    {columns.map((col, cIdx) => (
                      <td key={cIdx} className="p-4">
                        {col.render ? col.render(item) : item[col.accessor]}
                      </td>
                    ))}
                    {(canEdit || canDelete) && (
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <button
                              onClick={() => handleOpenModal(item)}
                              className="p-2 bg-[#FBF3E0] hover:bg-[#E91E63] hover:text-white border-2 border-[#3E2723] rounded-lg shadow-[2px_2px_0px_#3E2723] transition-all"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                               onClick={() => setDeleteConfirmId(getItemId(item, idField))}
                              className="p-2 bg-[#D94452] text-white hover:bg-[#b53240] border-2 border-[#3E2723] rounded-lg shadow-[2px_2px_0px_#3E2723] transition-all"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {items.map((item, idx) => (
              <div 
                 key={getItemId(item, idField) || idx} 
                className="bg-white border-2 border-[#3E2723] rounded-xl p-4 shadow-[4px_4px_0px_#3E2723] space-y-2"
              >
                {columns.map((col, cIdx) => (
                  <div key={cIdx} className="flex justify-between items-center text-xs">
                    <span className="font-['Rubik'] font-black uppercase text-[#3E2723]/60">{col.header}:</span>
                    <span className="font-bold text-[#3E2723]">{col.render ? col.render(item) : item[col.accessor]}</span>
                  </div>
                ))}
                {(canEdit || canDelete) && (
                  <div className="pt-2 border-t border-[#3E2723]/20 flex justify-end gap-2">
                    {canEdit && (
                      <button
                        onClick={() => handleOpenModal(item)}
                        className="px-3 py-1.5 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-lg font-black text-xs uppercase"
                      >
                        Editar
                      </button>
                    )}
                    {canDelete && (
                      <button
                         onClick={() => setDeleteConfirmId(getItemId(item, idField))}
                        className="px-3 py-1.5 bg-[#D94452] text-white border-2 border-[#3E2723] rounded-lg font-black text-xs uppercase"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border-2 border-[#3E2723] rounded-xl p-4 shadow-[4px_4px_0px_#3E2723]">
            <span className="text-xs font-black uppercase text-[#3E2723]">
              Página {page} de {totalPages} (Total: {total})
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="p-2 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-lg disabled:opacity-40 font-black"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="p-2 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-lg disabled:opacity-40 font-black"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#3E2723]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#3E2723] rounded-2xl max-w-lg w-full p-6 shadow-[8px_8px_0px_#3E2723] relative animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b-2 border-[#3E2723]">
              <h2 className="font-['Rubik'] font-black text-lg uppercase text-[#3E2723]">
                {editingItem ? `Editar ${title.slice(0, -1)}` : `Nuevo ${title.slice(0, -1)}`}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-[#FBF3E0] rounded-lg border-2 border-[#3E2723]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {formFields.map((field) => (
                <div key={field.name}>
                  <label className="block font-['Rubik'] font-black text-xs uppercase mb-1 text-[#3E2723]">
                    {field.label} {field.required && <span className="text-[#D94452]">*</span>}
                  </label>

                  {field.type === 'select' ? (
                    <select
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl font-bold text-sm text-[#3E2723] focus:outline-none focus:border-[#D94452]"
                    >
                      <option value="">SELECCIONE...</option>
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl font-bold text-sm text-[#3E2723] focus:outline-none focus:border-[#D94452]"
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      step={field.step}
                      required={field.required}
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl font-bold text-sm text-[#3E2723] focus:outline-none focus:border-[#D94452]"
                    />
                  )}

                  {fieldErrors[field.name] && (
                    <span className="text-xs font-black text-[#D94452] uppercase mt-1 block">
                      {fieldErrors[field.name]}
                    </span>
                  )}
                </div>
              ))}

              <div className="pt-4 border-t-2 border-[#3E2723] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl font-['Rubik'] font-black text-xs uppercase shadow-[2px_2px_0px_#3E2723]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#D94452] text-white border-2 border-[#3E2723] rounded-xl font-['Rubik'] font-black text-xs uppercase shadow-[3px_3px_0px_#3E2723] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-2"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editingItem ? 'Guardar Cambios' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DIALOG */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-[#3E2723]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#3E2723] rounded-2xl max-w-sm w-full p-6 shadow-[8px_8px_0px_#3E2723] text-center">
            <AlertTriangle className="w-12 h-12 text-[#D94452] mx-auto mb-3" />
            <h3 className="font-['Rubik'] font-black text-lg uppercase text-[#3E2723] mb-2">¿Confirmar Eliminación?</h3>
            <p className="text-xs font-bold text-[#3E2723]/80 uppercase mb-6">
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl font-['Rubik'] font-black text-xs uppercase shadow-[2px_2px_0px_#3E2723]"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-5 py-2 bg-[#D94452] text-white border-2 border-[#3E2723] rounded-xl font-['Rubik'] font-black text-xs uppercase shadow-[3px_3px_0px_#3E2723]"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// CLIENTES MODULE
// ==========================================
const ClientesView = ({ onShowToast }) => {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';
  const canManage = isAdmin || user?.rol === 'VENTAS';

  const columns = [
    { header: 'Nombre / Razón Social', accessor: 'nombreCliente' },
    { header: 'Teléfono', accessor: 'telefono' },
    { header: 'Email', accessor: 'correo' },
    { header: 'Dirección', accessor: 'direccion' },
  ];

  const formFields = [
    { name: 'nombreCliente', label: 'Nombre Completo', required: true },
    { name: 'telefono', label: 'Teléfono' },
    { name: 'correo', label: 'Correo Electrónico', type: 'email' },
    { name: 'direccion', label: 'Dirección de Entrega' },
  ];

  return (
    <CRUDView
      title="Clientes"
      icon={Users}
      endpoint="/api/clientes"
      idField="idCliente"
      columns={columns}
       canCreate={canManage}
       canEdit={canManage}
      canDelete={isAdmin}
      formFields={formFields}
      onShowToast={onShowToast}
    />
  );
};

// ==========================================
// PROVEEDORES MODULE
// ==========================================
const ProveedoresView = ({ onShowToast }) => {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';
  const canManage = isAdmin || user?.rol === 'ALMACEN';

  const columns = [
    { header: 'Empresa / Nombre', accessor: 'nombreProveedor' },
    { header: 'Teléfono', accessor: 'telefonoProveedor' },
    { header: 'Correo', accessor: 'correoProveedor' },
    { header: 'Dirección', accessor: 'direccionProveedor' },
  ];

  const formFields = [
    { name: 'nombreProveedor', label: 'Nombre / Empresa', required: true },
    { name: 'telefonoProveedor', label: 'Teléfono' },
    { name: 'correoProveedor', label: 'Correo Electrónico', type: 'email' },
    { name: 'direccionProveedor', label: 'Dirección' },
  ];

  return (
    <CRUDView
      title="Proveedores"
      icon={Truck}
      endpoint="/api/proveedores"
      idField="idProveedor"
      columns={columns}
       canCreate={canManage}
       canEdit={canManage}
      canDelete={isAdmin}
      formFields={formFields}
      onShowToast={onShowToast}
    />
  );
};

// ==========================================
// PRODUCTOS MODULE
// ==========================================
const ProductosView = ({ onShowToast }) => {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';
  const isAlmacen = user?.rol === 'ALMACEN';
  const canManage = isAdmin || isAlmacen;

  const columns = [
    { header: 'Producto', accessor: 'nombreProducto' },
    { 
      header: 'Precio', 
      render: (item) => <span className="font-black text-[#3F9B4F]">{formatCOP(item.precio)}</span>
    },
    { 
      header: 'Stock Disponible', 
      render: (item) => (
        <span className={`px-3 py-1 rounded-lg border-2 border-[#3E2723] font-black text-xs uppercase shadow-[2px_2px_0px_#3E2723] ${
          item.stock <= 5 ? 'bg-[#D94452] text-white' : 'bg-[#3F9B4F] text-white'
        }`}>
          {item.stock} unidades {item.stock <= 5 ? '(BAJO)' : ''}
        </span>
      )
    },
    { header: 'Tipo / Presentación', accessor: 'tipo' },
  ];

  const formFields = [
    { name: 'nombreProducto', label: 'Nombre del Bocadillo', required: true },
    { name: 'precio', label: 'Precio (COP - Ej: 12000.00)', required: true },
    { name: 'stock', label: 'Stock Inicial', type: 'number', required: true, defaultValue: 10 },
    { name: 'tipo', label: 'Tipo / Presentación (Ej: Lonja, Cojinete, Hoja)' },
  ];

  // Price formatting requirement: send as text with 2 decimals
  const transformPayload = (data) => {
    let p = data.precio;
    if (p !== undefined && p !== null) {
      const num = parseFloat(p);
      p = isNaN(num) ? "0.00" : num.toFixed(2);
    }
    return {
      ...data,
      precio: p,
      stock: parseInt(data.stock, 10) || 0,
    };
  };

  return (
    <CRUDView
      title="Productos"
      icon={Package}
      endpoint="/api/productos"
      idField="idProducto"
      columns={columns}
      canCreate={canManage}
      canEdit={canManage}
      canDelete={isAdmin}
      formFields={formFields}
      onShowToast={onShowToast}
      transformPayload={transformPayload}
    />
  );
};

// ==========================================
// NUEVA VENTA (CREATE SALE) MODULE
// ==========================================
const NuevaVentaView = ({ onNavigate, onShowToast }) => {
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [detalles, setDetalles] = useState([{ idProducto: '', cantidad: 1 }]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    const loadResources = async () => {
      try {
        const [resC, resP] = await Promise.all([
          fetchWithAuth('/api/clientes?pagina=1&tamano=100'),
          fetchWithAuth('/api/productos?pagina=1&tamano=100'),
        ]);
        setClientes(resC.items || []);
        setProductos(resP.items || []);
      } catch (err) {
        setFormError('Error al cargar datos de clientes o productos.');
      } finally {
        setLoading(false);
      }
    };
    loadResources();
  }, []);

  const handleAddLine = () => {
    setDetalles([...detalles, { idProducto: '', cantidad: 1 }]);
  };

  const handleRemoveLine = (index) => {
    if (detalles.length === 1) return;
    setDetalles(detalles.filter((_, i) => i !== index));
  };

  const handleLineChange = (index, field, value) => {
    const updated = [...detalles];
    updated[index][field] = value;
    setDetalles(updated);
  };

  // Informational calculation only! NEVER sent to backend.
  const estimatedTotal = useMemo(() => {
    return detalles.reduce((sum, item) => {
      const prod = productos.find((p) => p.idProducto?.toString() === item.idProducto?.toString());
      if (!prod) return sum;
      const price = typeof prod.precio === 'string' ? parseFloat(prod.precio) : prod.precio;
      const qty = parseInt(item.cantidad, 10) || 0;
      return sum + (price || 0) * qty;
    }, 0);
  }, [detalles, productos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedCliente) {
      setFormError('Debe seleccionar un cliente.');
      return;
    }

    // Filter valid lines
    const validLines = detalles.filter((d) => d.idProducto && parseInt(d.cantidad, 10) > 0);
    if (validLines.length === 0) {
      setFormError('Debe agregar al menos un producto con cantidad válida.');
      return;
    }

    // Format strict payload required by contract: ONLY idCliente and detalles[{idProducto, cantidad}]
    const payload = {
      idCliente: selectedCliente,
      detalles: validLines.map((d) => ({
        idProducto: d.idProducto,
        cantidad: parseInt(d.cantidad, 10),
      })),
    };

    setSubmitting(true);
    try {
      await fetchWithAuth('/api/ventas', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onShowToast('Venta registrada con éxito', 'success');
      onNavigate('ventas');
    } catch (err) {
      if (err.code === 'STOCK_INSUFICIENTE') {
        setFormError('No hay stock suficiente en uno o varios productos seleccionados.');
      } else {
        setFormError(err.detail || 'Ocurrió un error al procesar la venta.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="w-8 h-8 text-[#D94452] animate-spin mx-auto mb-2" />
        <p className="font-['Rubik'] font-black text-xs uppercase">Cargando formulario de venta...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white border-2 border-[#3E2723] rounded-2xl p-6 shadow-[6px_6px_0px_#3E2723] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl shadow-[2px_2px_0px_#3E2723]">
            <Receipt className="w-6 h-6 text-[#3F9B4F]" />
          </div>
          <div>
            <h1 className="font-['Rubik'] font-black text-xl uppercase text-[#3E2723]">Nueva Venta</h1>
            <p className="text-xs font-bold uppercase text-[#3E2723]/60">Registrar salida de producto y facturar</p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('ventas')}
          className="px-4 py-2 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl font-['Rubik'] font-black text-xs uppercase"
        >
          Volver
        </button>
      </div>

      {formError && (
        <div className="p-4 bg-[#D94452] text-white border-2 border-[#3E2723] rounded-xl shadow-[4px_4px_0px_#3E2723] flex items-center gap-3 text-xs font-black uppercase">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border-2 border-[#3E2723] rounded-2xl p-6 shadow-[6px_6px_0px_#3E2723] space-y-6">
        {/* Cliente selector */}
        <div>
          <label className="block font-['Rubik'] font-black text-xs uppercase mb-2 text-[#3E2723]">
            Cliente <span className="text-[#D94452]">*</span>
          </label>
          <select
            required
            value={selectedCliente}
            onChange={(e) => setSelectedCliente(e.target.value)}
            className="w-full px-4 py-3 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl font-bold text-sm text-[#3E2723] focus:outline-none focus:border-[#D94452]"
          >
            <option value="">-- SELECCIONAR CLIENTE --</option>
            {clientes.map((c) => (
                <option key={c.idCliente} value={c.idCliente}>
                  {c.nombreCliente}
              </option>
            ))}
          </select>
        </div>

        {/* Product details lines */}
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b-2 border-[#3E2723]">
            <h3 className="font-['Rubik'] font-black text-sm uppercase text-[#3E2723]">
              Detalle de Productos
            </h3>
            <button
              type="button"
              onClick={handleAddLine}
              className="px-3 py-1.5 bg-[#3F9B4F] text-white font-['Rubik'] font-black text-xs uppercase border-2 border-[#3E2723] rounded-lg shadow-[2px_2px_0px_#3E2723] flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Agregar Línea
            </button>
          </div>

          {detalles.map((item, idx) => {
            return (
              <div key={idx} className="p-4 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl flex flex-col sm:flex-row items-end gap-3 relative">
                <div className="flex-1 w-full">
                  <label className="block font-['Rubik'] font-black text-[10px] uppercase mb-1 text-[#3E2723]/70">
                    Producto #{idx + 1}
                  </label>
                  <select
                    required
                    value={item.idProducto}
                    onChange={(e) => handleLineChange(idx, 'idProducto', e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-[#3E2723] rounded-lg font-bold text-xs"
                  >
                    <option value="">-- ELEGIR PRODUCTO --</option>
                    {productos.map((p) => (
                      <option key={p.idProducto} value={p.idProducto}>
                        {p.nombreProducto} (Stock: {p.stock}) - {formatCOP(p.precio)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full sm:w-32">
                  <label className="block font-['Rubik'] font-black text-[10px] uppercase mb-1 text-[#3E2723]/70">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={item.cantidad}
                    onChange={(e) => handleLineChange(idx, 'cantidad', e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-[#3E2723] rounded-lg font-bold text-xs"
                  />
                </div>

                {detalles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    className="p-2 bg-[#D94452] text-white border-2 border-[#3E2723] rounded-lg shadow-[2px_2px_0px_#3E2723]"
                    title="Eliminar línea"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Informational Total Summary */}
        <div className="p-4 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl flex items-center justify-between shadow-[3px_3px_0px_#3E2723]">
          <div>
            <p className="font-['Rubik'] font-black text-xs uppercase text-[#3E2723]/70">Total Estimado (Informativo)</p>
            <p className="text-[10px] font-bold text-[#3E2723]/50 uppercase">El total definitivo es calculado por el servidor</p>
          </div>
          <span className="font-['Rubik'] font-black text-2xl text-[#3F9B4F]">
            {formatCOP(estimatedTotal)}
          </span>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#3E2723]">
          <button
            type="button"
            onClick={() => onNavigate('ventas')}
            className="px-5 py-3 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl font-['Rubik'] font-black text-xs uppercase"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-3 bg-[#3F9B4F] text-white border-2 border-[#3E2723] rounded-xl font-['Rubik'] font-black text-xs uppercase shadow-[4px_4px_0px_#3E2723] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-2"
          >
            {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
            Finalizar Venta
          </button>
        </div>
      </form>
    </div>
  );
};

// ==========================================
// VENTAS LIST & DETAIL VIEW
// ==========================================
const VentasView = ({ onNavigate, onShowToast }) => {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';

  const [ventas, setVentas] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detail Modal
  const [selectedVenta, setSelectedVenta] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchVentas = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth(`/api/ventas?pagina=${page}&tamano=10`);
      setVentas(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.detail || 'Error al cargar el historial de ventas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVentas();
  }, [page]);

  const handleOpenDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const detail = await fetchWithAuth(`/api/ventas/${id}`);
      setSelectedVenta(detail);
    } catch (err) {
      onShowToast(err.detail || 'Error al obtener detalle de la venta', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteVenta = async (id) => {
    try {
      await fetchWithAuth(`/api/ventas/${id}`, { method: 'DELETE' });
      onShowToast('Venta eliminada con éxito', 'success');
      setDeleteConfirmId(null);
      fetchVentas();
    } catch (err) {
      onShowToast(err.detail || 'Error al eliminar la venta', 'error');
    }
  };

  const totalPages = Math.ceil(total / 10) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border-2 border-[#3E2723] rounded-2xl p-6 shadow-[6px_6px_0px_#3E2723]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl shadow-[2px_2px_0px_#3E2723]">
            <Receipt className="w-6 h-6 text-[#3F9B4F]" />
          </div>
          <div>
            <h1 className="font-['Rubik'] font-black text-xl uppercase text-[#3E2723]">Ventas Realizadas</h1>
            <p className="text-xs font-bold uppercase text-[#3E2723]/60">Historial de comprobantes y facturación</p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('ventas-nueva')}
          className="px-5 py-3 bg-[#3F9B4F] text-white font-['Rubik'] font-black text-xs uppercase border-2 border-[#3E2723] rounded-xl shadow-[4px_4px_0px_#3E2723] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nueva Venta
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white border-2 border-[#3E2723] rounded-2xl shadow-[6px_6px_0px_#3E2723]">
          <RefreshCw className="w-8 h-8 text-[#3F9B4F] animate-spin mx-auto mb-2" />
          <p className="font-['Rubik'] font-black text-xs uppercase">Cargando ventas...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-[#FBF3E0] border-2 border-[#3E2723] rounded-2xl shadow-[6px_6px_0px_#3E2723]">
          <AlertTriangle className="w-10 h-10 text-[#D94452] mx-auto mb-2" />
          <p className="font-['Rubik'] font-black text-sm uppercase text-[#D94452] mb-3">{error}</p>
          <button onClick={fetchVentas} className="px-4 py-2 bg-[#3E2723] text-white font-['Rubik'] font-black text-xs uppercase rounded-xl">
            Reintentar
          </button>
        </div>
      ) : ventas.length === 0 ? (
        <div className="p-12 text-center bg-white border-2 border-[#3E2723] rounded-2xl shadow-[6px_6px_0px_#3E2723]">
          <p className="font-['Rubik'] font-black text-base uppercase text-[#3E2723] mb-1">No hay ventas registradas</p>
          <p className="text-xs font-bold uppercase text-[#3E2723]/60">Haz clic en Nueva Venta para realizar la primera.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="hidden md:block bg-white border-2 border-[#3E2723] rounded-2xl shadow-[6px_6px_0px_#3E2723] overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#3E2723] text-[#FBF3E0] font-['Rubik'] font-black text-xs uppercase border-b-2 border-[#3E2723]">
                  <th className="p-4">ID Venta</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Total</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#3E2723]/10 font-bold text-sm">
                 {ventas.map((v) => (
                   <tr key={v.idVenta} className="hover:bg-[#FBF3E0]/50 transition-colors">
                     <td className="p-4 font-black">#{v.idVenta}</td>
                    <td className="p-4 text-xs">{formatDate(v.fecha || v.created_at)}</td>
                     <td className="p-4 uppercase">Cliente #{v.idCliente}</td>
                    <td className="p-4 font-black text-[#3F9B4F]">{formatCOP(v.total)}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                           onClick={() => handleOpenDetail(v.idVenta)}
                          className="p-2 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-lg shadow-[2px_2px_0px_#3E2723]"
                          title="Ver Detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                             onClick={() => setDeleteConfirmId(v.idVenta)}
                            className="p-2 bg-[#D94452] text-white border-2 border-[#3E2723] rounded-lg shadow-[2px_2px_0px_#3E2723]"
                            title="Eliminar Venta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden space-y-3">
             {ventas.map((v) => (
               <div key={v.idVenta} className="bg-white border-2 border-[#3E2723] rounded-xl p-4 shadow-[4px_4px_0px_#3E2723] space-y-2">
                <div className="flex justify-between items-center">
                   <span className="font-['Rubik'] font-black text-sm uppercase">Venta #{v.idVenta}</span>
                  <span className="font-black text-[#3F9B4F]">{formatCOP(v.total)}</span>
                </div>
                <p className="text-xs font-bold text-[#3E2723]/70">{formatDate(v.fecha || v.created_at)}</p>
                <div className="pt-2 border-t border-[#3E2723]/20 flex justify-end gap-2">
                  <button
                     onClick={() => handleOpenDetail(v.idVenta)}
                    className="px-3 py-1 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-lg font-black text-xs uppercase"
                  >
                    Ver Detalle
                  </button>
                  {isAdmin && (
                    <button
                       onClick={() => setDeleteConfirmId(v.idVenta)}
                      className="px-3 py-1 bg-[#D94452] text-white border-2 border-[#3E2723] rounded-lg font-black text-xs uppercase"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between bg-white border-2 border-[#3E2723] rounded-xl p-4 shadow-[4px_4px_0px_#3E2723]">
            <span className="text-xs font-black uppercase">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-lg disabled:opacity-40">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-lg disabled:opacity-40">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedVenta && (
        <div className="fixed inset-0 z-50 bg-[#3E2723]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#3E2723] rounded-2xl max-w-lg w-full p-6 shadow-[8px_8px_0px_#3E2723] relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-[#3E2723]">
              <h2 className="font-['Rubik'] font-black text-lg uppercase text-[#3E2723]">
                 Comprobante Venta #{selectedVenta.idVenta}
              </h2>
              <button onClick={() => setSelectedVenta(null)} className="p-1 hover:bg-[#FBF3E0] rounded-lg border-2 border-[#3E2723]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 font-bold text-sm">
              <div className="p-3 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl space-y-1">
                <p><span className="font-black text-xs uppercase text-[#3E2723]/60">Fecha:</span> {formatDate(selectedVenta.fecha || selectedVenta.created_at)}</p>
                 <p><span className="font-black text-xs uppercase text-[#3E2723]/60">Cliente:</span> Cliente #{selectedVenta.idCliente}</p>
              </div>

              <div>
                <h4 className="font-['Rubik'] font-black text-xs uppercase text-[#3E2723] mb-2">Detalle de Líneas</h4>
                <div className="border-2 border-[#3E2723] rounded-xl overflow-hidden divide-y-2 divide-[#3E2723]">
                  {(selectedVenta.detalles || []).map((d, idx) => (
                    <div key={idx} className="p-3 bg-white flex justify-between items-center">
                      <div>
                       <p className="font-black uppercase text-xs">{`Prod #${d.idProducto}`}</p>
                        <p className="text-[10px] text-[#3E2723]/60">{d.cantidad} x {formatCOP(d.precioUnitario || d.precio)}</p>
                      </div>
                      <span className="font-black text-xs text-[#3F9B4F]">
                        {formatCOP(d.subtotal || (d.cantidad * (d.precioUnitario || d.precio || 0)))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t-2 border-[#3E2723] flex justify-between items-center text-base">
                <span className="font-['Rubik'] font-black uppercase text-[#3E2723]">TOTAL CALCULADO:</span>
                <span className="font-['Rubik'] font-black text-xl text-[#3F9B4F]">{formatCOP(selectedVenta.total)}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedVenta(null)}
                className="px-5 py-2.5 bg-[#3E2723] text-white font-['Rubik'] font-black text-xs uppercase rounded-xl border-2 border-[#3E2723]"
              >
                Cerrar Comprobante
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-[#3E2723]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#3E2723] rounded-2xl max-w-sm w-full p-6 shadow-[8px_8px_0px_#3E2723] text-center">
            <AlertTriangle className="w-12 h-12 text-[#D94452] mx-auto mb-3" />
            <h3 className="font-['Rubik'] font-black text-lg uppercase mb-2">Eliminar Venta</h3>
            <p className="text-xs font-bold text-[#3E2723]/80 uppercase mb-6">
              ¿Está seguro? Se revertirá la venta en el historial.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl font-black text-xs uppercase">
                Cancelar
              </button>
              <button onClick={() => handleDeleteVenta(deleteConfirmId)} className="px-5 py-2 bg-[#D94452] text-white border-2 border-[#3E2723] rounded-xl font-black text-xs uppercase">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// MAIN APP COMPONENT & LAYOUT
// ==========================================
const AppContent = () => {
  const { user, logout } = useAuth();
  const [currentRoute, setCurrentRoute] = useState('inicio');
  const [toast, setToast] = useState({ message: null, type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Role permissions check
  const role = user?.rol || 'GENERAL';
  const canSeeClientes = role === 'ADMIN' || role === 'VENTAS';
  const canSeeProveedores = role === 'ADMIN' || role === 'ALMACEN';
  const canSeeProductos = true; // Everyone logged in can see productos
  const canSeeVentas = role === 'ADMIN' || role === 'VENTAS';

  const navItems = [
    { id: 'inicio', label: 'Inicio', icon: Home, show: true },
    { id: 'clientes', label: 'Clientes', icon: Users, show: canSeeClientes },
    { id: 'proveedores', label: 'Proveedores', icon: Truck, show: canSeeProveedores },
    { id: 'productos', label: 'Productos', icon: Package, show: canSeeProductos },
    { id: 'ventas', label: 'Ventas', icon: Receipt, show: canSeeVentas },
  ];

  const renderRoute = () => {
    switch (currentRoute) {
      case 'inicio':
        return <DashboardView onNavigate={setCurrentRoute} />;
      case 'clientes':
        return canSeeClientes ? <ClientesView onShowToast={showToast} /> : <AccessDenied />;
      case 'proveedores':
        return canSeeProveedores ? <ProveedoresView onShowToast={showToast} /> : <AccessDenied />;
      case 'productos':
        return <ProductosView onShowToast={showToast} />;
      case 'ventas':
        return canSeeVentas ? <VentasView onNavigate={setCurrentRoute} onShowToast={showToast} /> : <AccessDenied />;
      case 'ventas-nueva':
        return canSeeVentas ? <NuevaVentaView onNavigate={setCurrentRoute} onShowToast={showToast} /> : <AccessDenied />;
      default:
        return <DashboardView onNavigate={setCurrentRoute} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF3E0] text-[#3E2723] font-['Outfit'] flex flex-col md:flex-row pb-20 md:pb-0">
      {/* Toast Notification */}
      <Toast 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ message: null, type: 'success' })} 
      />

      {/* DESKTOP SIDEBAR (>= 900px) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r-2 border-[#3E2723] p-5 justify-between min-h-screen sticky top-0 shadow-[4px_0px_0px_#3E2723] z-30">
        <div>
          {/* Logo Brand */}
          <div className="flex items-center gap-3 p-3 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-2xl shadow-[3px_3px_0px_#3E2723] mb-8">
            <GuavaLogo className="w-10 h-10 flex-shrink-0" />
            <div>
              <h2 className="font-['Rubik'] font-black text-sm uppercase leading-tight text-[#3E2723]">
                Doña Vélez
              </h2>
              <p className="text-[10px] font-bold uppercase text-[#D94452]">Fábrica Bocadillos</p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-2">
            {navItems.filter(i => i.show).map((item) => {
              const Icon = item.icon;
              const isActive = currentRoute === item.id || (currentRoute === 'ventas-nueva' && item.id === 'ventas');
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentRoute(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-2 border-[#3E2723] rounded-xl font-['Rubik'] font-black text-xs uppercase tracking-wider transition-all ${
                    isActive
                      ? 'bg-[#D94452] text-white shadow-[3px_3px_0px_#3E2723] translate-x-1'
                      : 'bg-white hover:bg-[#FBF3E0] text-[#3E2723]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout */}
        <div className="pt-4 border-t-2 border-[#3E2723]">
          <div className="mb-3 px-3 py-2 bg-[#FBF3E0] border-2 border-[#3E2723] rounded-xl">
            <p className="font-black text-xs uppercase truncate text-[#3E2723]">{user?.nombre || user?.email}</p>
            <p className="text-[10px] font-extrabold uppercase text-[#E91E63]">ROL: {user?.rol}</p>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3E2723] text-white font-['Rubik'] font-black text-xs uppercase border-2 border-[#3E2723] rounded-xl hover:bg-[#D94452] transition-colors shadow-[2px_2px_0px_#3E2723]"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <header className="md:hidden bg-white border-b-2 border-[#3E2723] p-4 flex items-center justify-between sticky top-0 z-30 shadow-[0px_3px_0px_#3E2723]">
        <div className="flex items-center gap-2">
          <GuavaLogo className="w-8 h-8" />
          <span className="font-['Rubik'] font-black text-base uppercase text-[#3E2723]">Doña Vélez</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-[#FBF3E0] border border-[#3E2723] rounded-lg text-[10px] font-black uppercase text-[#E91E63]">
            {user?.rol}
          </span>
          <button onClick={() => logout()} className="p-2 bg-[#D94452] text-white border-2 border-[#3E2723] rounded-lg">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {renderRoute()}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-[#3E2723] p-2 flex justify-around items-center z-40 shadow-[0px_-4px_0px_#3E2723]">
        {navItems.filter(i => i.show).map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.id || (currentRoute === 'ventas-nueva' && item.id === 'ventas');
          return (
            <button
              key={item.id}
              onClick={() => setCurrentRoute(item.id)}
              className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all ${
                isActive
                  ? 'bg-[#D94452] text-white border-[#3E2723] shadow-[2px_2px_0px_#3E2723]'
                  : 'border-transparent text-[#3E2723]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-['Rubik'] font-black uppercase mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

const AccessDenied = () => (
  <div className="p-12 text-center bg-white border-2 border-[#3E2723] rounded-2xl shadow-[6px_6px_0px_#3E2723]">
    <ShieldAlert className="w-16 h-16 text-[#D94452] mx-auto mb-4" />
    <h2 className="font-['Rubik'] font-black text-xl uppercase text-[#3E2723] mb-2">Acceso Restringido</h2>
    <p className="text-xs font-bold uppercase text-[#3E2723]/60">Su rol de usuario no tiene permiso para ingresar a esta sección.</p>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}

const MainLayout = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBF3E0] flex flex-col items-center justify-center p-4">
        <GuavaLogo className="w-16 h-16 animate-bounce mb-4" />
        <p className="font-['Rubik'] font-black text-sm uppercase tracking-widest text-[#3E2723]">
          Iniciando Doña Vélez...
        </p>
      </div>
    );
  }

  return user ? <AppContent /> : <LoginView />;
}
