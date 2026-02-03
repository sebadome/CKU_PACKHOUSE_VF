// backend/src/routes/auth.ts
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getPool, sql } from '../db/pool';

const router = Router();

const ROLES_VALIDOS = ['Administrador', 'Trabajador CKU'];

/**
 * REGISTER - Registro de nuevos usuarios
 */
router.post('/register', async (req: Request, res: Response) => {
  const { name, apellido, rut, email, planta, password, roles, cargo } = req.body;

  // Validación de campos requeridos
  if (!name || !apellido || !rut || !email || !planta || !password || !roles) {
    return res.status(400).json({ message: 'Faltan campos obligatorios' });
  }

  // Validación de rol
  if (!ROLES_VALIDOS.includes(roles)) {
    return res.status(400).json({ message: 'Rol inválido' });
  }

  try {
    const pool = await getPool();

    // Verificar si el usuario ya existe
    const exists = await pool.request()
      .input('rut', sql.VarChar(12), rut)
      .input('email', sql.VarChar(200), email)
      .query(`
        SELECT rut, email
        FROM dbo.CKU_Usuarios
        WHERE rut = @rut OR email = @email
      `);

    if (exists.recordset.length > 0) {
      const encontrado = exists.recordset[0];

      if (encontrado.email === email) {
        return res.status(409).json({ message: 'Email ya registrado' });
      }
      if (encontrado.rut === rut) {
        return res.status(409).json({ message: 'RUT ya registrado' });
      }
    }

    // Hash de la contraseña
    const hash = await bcrypt.hash(password, 10);

    // Usar el rol también como cargo si no se proporciona cargo
    const cargoFinal = cargo || roles;

    // Insertar nuevo usuario
    await pool.request()
      .input('name', sql.VarChar(100), name)
      .input('apellido', sql.VarChar(100), apellido)
      .input('rut', sql.VarChar(12), rut)
      .input('email', sql.VarChar(200), email)
      .input('planta', sql.VarChar(100), planta)
      .input('hash', sql.VarChar, hash)
      .input('roles', sql.VarChar(50), roles)
      .input('cargo', sql.VarChar(100), cargoFinal)
      .query(`
        INSERT INTO dbo.CKU_Usuarios
        (nombre, apellido, rut, email, planta, password_hash, rol, cargo, activo)
        VALUES
        (@name, @apellido, @rut, @email, @planta, @hash, @roles, @cargo, 1)
      `);

    res.status(201).json({ message: 'Usuario creado exitosamente' });

  } catch (err: any) {
    console.error('❌ ERROR REGISTER:', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

/**
 * LOGIN - Inicio de sesión
 */
router.post('/login', async (req: Request, res: Response) => {
  const { rut, password } = req.body;

  if (!rut || !password) {
    return res.status(400).json({ message: 'RUT y contraseña son requeridos' });
  }

  try {
    const pool = await getPool();

    // Buscar usuario por RUT (SIN activo por ahora hasta verificar que funcione)
    const result = await pool.request()
      .input('rut', sql.VarChar(12), rut)
      .query(`SELECT * FROM dbo.CKU_Usuarios WHERE rut = @rut`);

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = result.recordset[0];

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Preparar respuesta (sin enviar password_hash)
    const userResponse = {
      id: user.id,
      name: user.nombre,
      apellido: user.apellido,
      rut: user.rut,
      email: user.email,
      planta: user.planta,
      rol: user.rol
    };

    res.json(userResponse);

  } catch (err: any) {
    console.error('❌ ERROR LOGIN:', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

export default router;