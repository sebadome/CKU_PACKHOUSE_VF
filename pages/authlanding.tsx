import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const AuthLanding: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Logo + título */}
        <div className="text-center mb-8">
          <img
            src="https://www.unifrutti.com/wp-content/uploads/2021/11/LOGO-UNIFRUTTI-2021.png"
            alt="Unifrutti Logo"
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-cku-blue">Planillas CKU</h1>
          <p className="text-gray-500 mt-2">
            Sistema de Aseguramiento de Calidad
          </p>
        </div>

        {/* Card */}
        <Card className="shadow-xl border-t-4 border-t-cku-blue">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-800 text-center">
              Bienvenido
            </h2>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button
              className="w-full bg-cku-blue hover:bg-blue-800 text-white"
              onClick={() => navigate('/login')}
            >
              Iniciar sesión
            </Button>

            {/* ✅ COMENTADO: Botón de registro oculto para usuarios públicos */}
            {/* <Button
              className="w-full bg-white hover:bg-gray-50 text-cku-blue border-2 border-cku-blue"
              onClick={() => navigate('/register')}
            >
              Registrarse
            </Button> */}

            <div className="mt-6 text-center text-xs text-gray-400">
              <p>Acceso restringido a personal autorizado.</p>
              <p>Unifrutti Chile &copy; {new Date().getFullYear()}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthLanding;