import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import Input from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useToast } from '../context/ToastContext';

const Login: React.FC = () => {
  const { login, isLoading } = useContext(AuthContext);
  const { addToast } = useToast();
  
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');

  // ✅ NUEVO: Función para formatear RUT automáticamente
  const formatRut = (value: string): string => {
    // Remover todo excepto números y 'k' o 'K'
    const cleaned = value.replace(/[^0-9kK]/g, '');
    
    if (cleaned.length === 0) return '';
    
    // Separar cuerpo y dígito verificador
    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1).toUpperCase();
    
    if (body.length === 0) return dv;
    
    // Formatear el cuerpo con puntos
    const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    // Si solo hay cuerpo (aún escribiendo), no agregar guion
    if (cleaned.length <= 1) return cleaned;
    
    // Retornar formato completo
    return `${formattedBody}-${dv}`;
  };

  // ✅ NUEVO: Handler para el cambio de RUT con formateo automático
  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatRut(value);
    
    // Limitar longitud máxima (12 caracteres: XX.XXX.XXX-X)
    if (formatted.length <= 12) {
      setRut(formatted);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rut || !password) {
      addToast({ message: 'Por favor ingrese RUT y contraseña', type: 'warning' });
      return;
    }

    try {
      await login(rut, password);
      addToast({ message: 'Sesión iniciada correctamente', type: 'success' });
    } catch (error) {
      addToast({ message: 'RUT o contraseña incorrectos', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
            <img
              src="https://www.unifrutti.com/wp-content/uploads/2021/11/LOGO-UNIFRUTTI-2021.png"
              alt="Unifrutti Logo"
              className="h-16 mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-cku-blue">Planillas CKU</h1>
            <p className="text-gray-500 mt-2">Sistema de Aseguramiento de Calidad</p>
        </div>

        <Card className="shadow-xl border-t-4 border-t-cku-blue">
            <CardHeader>
                <h2 className="text-xl font-semibold text-gray-800 text-center">Iniciar Sesión</h2>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <Input 
                            label="RUT" 
                            placeholder="Ej: 11.111.111-1" 
                            value={rut}
                            onChange={handleRutChange}
                            disabled={isLoading}
                            autoFocus
                            maxLength={12}
                        />
                    </div>
                    <div>
                        <Input 
                            label="Contraseña" 
                            type="password"
                            placeholder="Ingrese su contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    
                    <Button 
                        type="submit" 
                        className="w-full bg-cku-blue hover:bg-blue-800 text-white" 
                        disabled={isLoading}
                    >
                        {isLoading ? 'Verificando...' : 'Ingresar'}
                    </Button>
                </form>

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

export default Login;