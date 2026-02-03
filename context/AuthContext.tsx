// AuthContext.tsx
import React, {
  createContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import { User, UserRole } from '../types';

interface RegisterPayload {
  name: string;
  apellido: string;
  rut: string;
  email: string;
  planta: string;
  password: string;
  roles: UserRole;
}

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  planta: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (rut: string, pass: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => void;
}

// ✅ URL base configurable por env (Vite)
// Soporta VITE_API_URL (sugerido) y VITE_API_BASE_URL (compatibilidad con tu env actual)
const rawApiUrl =
  (import.meta as any).env?.VITE_API_URL ||
  (import.meta as any).env?.VITE_API_BASE_URL ||
  'http://localhost:4000';

// ✅ Evita doble "//" al concatenar rutas
const API_URL = String(rawApiUrl).replace(/\/+$/, '');

export const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  planta: null,
  isAuthenticated: false,
  isLoading: false,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // ✅ true al inicio para verificar sesión

  // ✅ REHIDRATAR SESIÓN desde localStorage al iniciar
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        console.error('Error al rehidratar sesión:', e);
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  // El rol actual se deriva del primer rol del usuario logueado
  const role = useMemo(() => user?.roles[0] || null, [user]);

  // ✅ Planta del usuario
  const planta = useMemo(() => user?.planta || null, [user]);

  const isAuthenticated = useMemo(() => !!user, [user]);

  // ✅ LOGIN REAL - Llamada al backend
  const login = useCallback(async (rutInput: string, passInput: string) => {
    setIsLoading(true);

    try {
      // Normalización de entradas
      const rut = rutInput.trim();
      const password = passInput.trim();

      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || 'Credenciales inválidas');
      }

      // Construir objeto User (backend envía 'rol' singular, lo convertimos a array)
      const loggedUser: User = {
        name: data.name,
        apellido: data.apellido,
        rut: data.rut,
        email: data.email,
        planta: data.planta,
        roles: [data.rol], // ✅ Convertir string a array
      };

      setUser(loggedUser);
      localStorage.setItem('user', JSON.stringify(loggedUser));
    } catch (error: any) {
      throw new Error(error?.message || 'Error de autenticación');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ✅ REGISTER REAL - Llamada al backend
  const register = useCallback(async (payload: RegisterPayload) => {
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || 'Error al registrar');
      }

      // No guardamos el usuario automáticamente, debe hacer login después
    } catch (error: any) {
      throw new Error(error?.message || 'Error al registrar usuario');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('user');
  }, []);

  const value = useMemo(
    () => ({
      user,
      role,
      planta,
      isAuthenticated,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, role, planta, isAuthenticated, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
