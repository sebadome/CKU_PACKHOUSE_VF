// components/Layout.tsx
import React, { useContext, useMemo, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useGlobalSettings } from "../context/GlobalSettingsContext";
import Select from "./ui/Select";
import { useNavigationBlocker } from "../context/NavigationBlockerContext";
import { Button } from "./ui/Button";

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-cku-black flex flex-col">
      <Header />
      <Nav />
      <main className="p-4 sm:p-6 lg:p-8 flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

const Header: React.FC = () => {
  const { user, role, logout } = useContext(AuthContext);
  const { planta, setPlanta, temporada, setTemporada } = useGlobalSettings();
  const { confirmExit, shouldConfirmExit } = useNavigationBlocker();
  const navigate = useNavigate();

  // ✅ NUEVO: Sincronizar planta del usuario con GlobalSettings
  useEffect(() => {
    if (user?.planta) {
      // Convertir "Santiago" -> "santiago", "San Felipe" -> "san_felipe"
      const plantaValue = user.planta.toLowerCase().replace(/\s+/g, '_');
      setPlanta(plantaValue);
    }
  }, [user?.planta, setPlanta]);

  const handleSafeNavigate = async (path: string) => {
    if (shouldConfirmExit()) {
      const confirmed = await confirmExit();
      if (!confirmed) return;
    }
    navigate(path);
  };
  
  const getInitials = (name: string) => {
    if (!name) return '??';
    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length > 1) {
        const firstInitial = nameParts[0][0];
        const lastInitial = nameParts[nameParts.length - 1][0];
        return `${firstInitial}${lastInitial}`.toUpperCase();
    }
    if (nameParts.length === 1 && nameParts[0].length > 0) {
        return nameParts[0].substring(0, 2).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleLogout = async () => {
    if (shouldConfirmExit()) {
        const confirmed = await confirmExit();
        if (!confirmed) return;
    }
    logout();
  };

  // ✅ NUEVO: Formatear nombre de planta para mostrar
  const getFormattedPlanta = (plantaValue: string) => {
    const plantaNames: Record<string, string> = {
      'copiapo': 'Copiapó',
      'coquimbo': 'Coquimbo',
      'san_felipe': 'San Felipe',
      'linderos': 'Linderos',
      'requinoa': 'Requinoa',
      'teno': 'Teno',
      'linares': 'Linares',
      'santiago': 'Santiago',
      'romeral': 'Romeral',
      'rancagua': 'Rancagua',
    };
    return plantaNames[plantaValue] || plantaValue;
  };

  return (
    <header className="bg-cku-white shadow-md sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20 gap-4">
          {/* Logo Section */}
          <button
            type="button"
            onClick={() => handleSafeNavigate("/")}
            className="flex-shrink-0 flex items-center cursor-pointer focus:outline-none"
            aria-label="Ir a Inicio"
          >
            <img
              src="https://www.unifrutti.com/wp-content/uploads/2021/11/LOGO-UNIFRUTTI-2021.png"
              alt="Unifrutti Logo"
              className="h-8 md:h-10 w-auto"
            />
            <span className="ml-3 text-xl font-bold text-cku-blue hidden md:block">
              Planillas CKU
            </span>
          </button>

          {/* Controls Section */}
          <div className="flex items-center space-x-2 sm:space-x-4 overflow-x-auto no-scrollbar py-2 flex-shrink min-w-0">
            
            {/* ✅ ACTUALIZADO: Planta bloqueada, viene de la BD */}
            <div className="w-28 md:w-36 lg:w-48 text-xs sm:text-sm flex-shrink-0">
              <div className="block w-full px-3 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg shadow-sm cursor-not-allowed">
                Planta: {getFormattedPlanta(planta)}
              </div>
            </div>

            {/* ✅ ACTUALIZADO: Temporada seleccionable con 3 opciones */}
            <Select 
              name="temporada" 
              value={temporada}
              onChange={(e) => setTemporada(e.target.value)}
              aria-label="Temporada" 
              className="w-28 md:w-36 lg:w-48 text-xs sm:text-sm flex-shrink-0"
            >
              <option value="24-25">Temporada: 24-25</option>
              <option value="25-26">Temporada: 25-26</option>
              <option value="26-27">Temporada: 26-27</option>
            </Select>

            {/* Role Badge - Visualización Dinámica */}
            <span className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap flex-shrink-0 border ${
                role === 'Administrador' ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-blue-100 text-cku-blue border-blue-200'
            }`}>
                {role || 'Usuario'}
            </span>

            {/* User Avatar */}
            {user && (
                <div 
                className="w-8 h-8 md:w-10 md:h-10 bg-cku-blue rounded-full flex-shrink-0 flex items-center justify-center text-cku-white font-bold text-xs md:text-sm select-none shadow-sm"
                title={user.name}
                >
                {getInitials(user.name)}
                </div>
            )}

            {/* Logout Button */}
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout} 
                className="text-gray-500 hover:text-cku-red hover:bg-red-50 flex-shrink-0"
                title="Cerrar Sesión"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

const SafeNavLink: React.FC<{ to: string; children: React.ReactNode; end?: boolean }> = ({
  to,
  children,
  end,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { confirmExit, shouldConfirmExit } = useNavigationBlocker();

  const isActive = end ? location.pathname === to : location.pathname.startsWith(to);

  const className = useMemo(
    () =>
      `px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
        isActive ? "bg-cku-red text-white" : "text-gray-700 hover:bg-gray-200"
      }`,
    [isActive]
  );

  const handleClick = async () => {
    if (shouldConfirmExit()) {
      const confirmed = await confirmExit();
      if (!confirmed) return;
    }
    navigate(to);
  };

  return (
    <button type="button" onClick={handleClick} className={className} aria-current={isActive ? "page" : undefined}>
      {children}
    </button>
  );
};

const Nav: React.FC = () => {
  const { role } = useContext(AuthContext);

  return (
    <nav className="bg-white shadow-sm sticky top-16 md:top-20 z-10 overflow-x-auto no-scrollbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-start h-12 space-x-2 sm:space-x-4">
          <SafeNavLink to="/" end>
            Inicio
          </SafeNavLink>

          {role === "Trabajador CKU" && (
            <>
              <SafeNavLink to="/library">Biblioteca</SafeNavLink>
              <SafeNavLink to="/drafts">Borradores</SafeNavLink>
            </>
          )}

          {role === "Administrador" && (
            <>
              <SafeNavLink to="/drafts">Borradores</SafeNavLink>
              <SafeNavLink to="/records">Biblioteca de Registros</SafeNavLink>
              <SafeNavLink to="/admin">Administración</SafeNavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

const Footer: React.FC = () => (
  <footer className="bg-gray-100 text-gray-600 text-sm text-center p-4 mt-auto">
    <p>v1.2.0 | Ayuda y Soporte</p>
  </footer>
);

export default Layout;