import React, { useState, useContext } from "react";
import Input from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { Card, CardContent, CardHeader } from "../components/ui/Card";

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useContext(AuthContext);

  const [name, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [planta, setPlanta] = useState("");
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargo, setCargo] = useState(""); // ✅ NUEVO: Estado para cargo
  const [roles, setRol] = useState<"Trabajador CKU" | "Administrador">(
    "Trabajador CKU"
  );
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("error");

  // Función para formatear RUT automáticamente
  const formatRut = (value: string): string => {
    const cleaned = value.replace(/[^0-9kK]/g, '');
    
    if (cleaned.length === 0) return '';
    
    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1).toUpperCase();
    
    if (body.length === 0) return dv;
    
    const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    if (cleaned.length <= 1) return cleaned;
    
    return `${formattedBody}-${dv}`;
  };

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatRut(value);
    
    if (formatted.length <= 12) {
      setRut(formatted);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");

    const payload = {
      name: name.trim(),
      apellido: apellido.trim(),
      planta: planta.trim(),
      rut: rut.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
      roles,
      cargo: cargo.trim() || roles, // ✅ ACTUALIZADO: Usar cargo ingresado o rol como fallback
    };

    if (
      !payload.name ||
      !payload.apellido ||
      !payload.rut ||
      !payload.email ||
      !payload.password ||
      !payload.planta
    ) {
      setMsg("Todos los campos son obligatorios");
      setMsgType("error");
      return;
    }

    try {
      await register(payload);
      setMsg("✅ Usuario creado correctamente. Redirigiendo a login...");
      setMsgType("success");
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2000);
    } catch (err: any) {
      setMsg(err.message || "Error al registrar");
      setMsgType("error");
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
          <p className="text-gray-500 mt-2">Registro de nuevo usuario</p>
        </div>

        <Card className="shadow-xl border-t-4 border-t-cku-blue">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-800 text-center">
              Crear Cuenta
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <Input
                label="Nombre"
                value={name}
                onChange={(e) => setNombre(e.target.value)}
                disabled={isLoading}
                required
              />
              <Input
                label="Apellido"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                disabled={isLoading}
                required
              />
              <Input
                label="RUT"
                value={rut}
                maxLength={12}
                placeholder="11.111.111-1"
                onChange={handleRutChange}
                disabled={isLoading}
                required
              />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
              <Input
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Planta
                </label>
                <select
                  value={planta}
                  onChange={(e) => setPlanta(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cku-blue"
                  disabled={isLoading}
                  required
                >
                  <option value="">Seleccione planta</option>
                  {[
                    "Linares",
                    "Teno",
                    "Romeral",
                    "Requinoa",
                    "Linderos",
                    "San Felipe",
                    "Coquimbo",
                    "Rancagua",
                    "Copiapo",
                    "Santiago",
                  ].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* ✅ NUEVO: Campo Cargo */}
              <Input
                label="Cargo"
                value={cargo}
                placeholder="Ej: Jefe de Calidad, Inspector, etc."
                onChange={(e) => setCargo(e.target.value)}
                disabled={isLoading}
                hint="Opcional. Si no se especifica, se usará el rol como cargo."
              />

              <div>
                <label className="block text-sm font-medium mb-1">Rol</label>
                <select
                  value={roles}
                  onChange={(e) => setRol(e.target.value as any)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cku-blue"
                  disabled={isLoading}
                >
                  <option value="Trabajador CKU">Trabajador CKU</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>

              <Button
                type="submit"
                className="w-full bg-cku-blue hover:bg-blue-800 text-white"
                disabled={isLoading}
              >
                {isLoading ? "Registrando..." : "Registrar"}
              </Button>

              {msg && (
                <p
                  className={`text-center text-sm mt-2 ${
                    msgType === "success" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {msg}
                </p>
              )}

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-cku-blue hover:underline text-sm"
                  disabled={isLoading}
                >
                  ¿Ya tienes cuenta? Inicia sesión
                </button>
              </div>
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

export default Register;