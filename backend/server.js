import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dbQuery, dbGet, dbRun } from './db.js';
import { uploadToDrive, isDriveEnabled } from './googleDrive.js';
import { sendDocumentAlert } from './mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || '*'
}));
app.use(express.json());

// Servir archivos estáticos subidos
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ==========================================
// 1. AUTENTICACIÓN
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await dbGet(`
      SELECT u.id, u.username, u.nombre, u.email, u.rol_id, r.nombre as rol_nombre 
      FROM usuarios u 
      JOIN roles r ON u.rol_id = r.id 
      WHERE u.username = ? AND u.password_hash = ? AND u.activo = 1
    `, [username, password]); // Comparación directa para MVP

    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ==========================================
// 2. CATÁLOGOS
// ==========================================
app.get('/api/procesos', async (req, res) => {
  try {
    const procesos = await dbQuery('SELECT * FROM procesos_areas ORDER BY nombre');
    res.json(procesos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tipos', async (req, res) => {
  try {
    const tipos = await dbQuery('SELECT * FROM tipos_documento ORDER BY nombre');
    res.json(tipos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/usuarios', async (req, res) => {
  try {
    const usuarios = await dbQuery(`
      SELECT u.id, u.nombre, u.email, r.nombre as rol 
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE u.activo = 1
      ORDER BY u.nombre
    `);
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. DOCUMENTOS - LISTAR Y BUSCAR
// ==========================================
app.get('/api/documentos', async (req, res) => {
  const { search, proceso_id, tipo_documento_id, estado, responsable_id } = req.query;
  
  let query = `
    SELECT d.*, p.nombre as proceso_nombre, p.codigo as proceso_codigo,
           t.nombre as tipo_nombre, t.prefijo as tipo_prefijo,
           u.nombre as responsable_nombre
    FROM documentos d
    JOIN procesos_areas p ON d.proceso_id = p.id
    JOIN tipos_documento t ON d.tipo_documento_id = t.id
    JOIN usuarios u ON d.responsable_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ` AND (d.codigo LIKE ? OR d.nombre LIKE ? OR d.observaciones LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  if (proceso_id) {
    query += ` AND d.proceso_id = ?`;
    params.push(proceso_id);
  }

  if (tipo_documento_id) {
    query += ` AND d.tipo_documento_id = ?`;
    params.push(tipo_documento_id);
  }

  if (estado) {
    query += ` AND d.estado = ?`;
    params.push(estado);
  }

  if (responsable_id) {
    query += ` AND d.responsable_id = ?`;
    params.push(responsable_id);
  }

  query += ` ORDER BY d.creado_en DESC`;

  try {
    const docs = await dbQuery(query, params);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// OBTENER DETALLE DE UN DOCUMENTO
app.get('/api/documentos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await dbGet(`
      SELECT d.*, p.nombre as proceso_nombre, p.codigo as proceso_codigo,
             t.nombre as tipo_nombre, t.prefijo as tipo_prefijo,
             u.nombre as responsable_nombre,
             uc.nombre as creador_nombre,
             ua.nombre as actualizador_nombre
      FROM documentos d
      JOIN procesos_areas p ON d.proceso_id = p.id
      JOIN tipos_documento t ON d.tipo_documento_id = t.id
      JOIN usuarios u ON d.responsable_id = u.id
      LEFT JOIN usuarios uc ON d.creado_por = uc.id
      LEFT JOIN usuarios ua ON d.actualizado_por = ua.id
      WHERE d.id = ?
    `, [id]);

    if (!doc) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    // Obtener versiones
    const versiones = await dbQuery(`
      SELECT v.*, u.nombre as creador_nombre
      FROM versiones_documento v
      JOIN usuarios u ON v.creado_por = u.id
      WHERE v.documento_id = ?
      ORDER BY v.creado_en DESC
    `, [id]);

    // Obtener auditoría
    const auditoria = await dbQuery(`
      SELECT a.*, u.nombre as usuario_nombre
      FROM historial_auditoria a
      JOIN usuarios u ON a.usuario_id = u.id
      WHERE a.documento_id = ?
      ORDER BY a.fecha_hora DESC
    `, [id]);

    res.json({ ...doc, versiones, auditoria });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. REGISTRO Y EDICIÓN DE DOCUMENTOS
// ==========================================

// CREAR DOCUMENTO
app.post('/api/documentos', upload.single('archivo'), async (req, res) => {
  const { nombre, proceso_id, tipo_documento_id, version_actual, fecha_emision, fecha_revision, responsable_id, observaciones, usuario_id } = req.body;
  
  let archivo_path = null;
  if (req.file) {
    if (isDriveEnabled()) {
      try {
        const localPath = req.file.path;
        const driveUrl = await uploadToDrive(localPath, req.file.originalname, req.file.mimetype);
        archivo_path = driveUrl;
        fs.unlinkSync(localPath); // Borrar archivo temporal
      } catch (err) {
        console.error('Error al subir a Google Drive, usando local fallback:', err.message);
        archivo_path = `uploads/${req.file.filename}`;
      }
    } else {
      archivo_path = `uploads/${req.file.filename}`;
    }
  }

  try {
    // 1. Obtener códigos de área y tipo para autogenerar el código del documento
    const proceso = await dbGet('SELECT codigo FROM procesos_areas WHERE id = ?', [proceso_id]);
    const tipo = await dbGet('SELECT prefijo FROM tipos_documento WHERE id = ?', [tipo_documento_id]);
    
    if (!proceso || !tipo) {
      return res.status(400).json({ message: 'Proceso o Tipo Documental inválido.' });
    }

    // 2. Generar correlativo
    const countRow = await dbGet('SELECT COUNT(*) as total FROM documentos WHERE proceso_id = ? AND tipo_documento_id = ?', [proceso_id, tipo_documento_id]);
    const nextIndex = String(countRow.total + 1).padStart(3, '0');
    const codigo = `QA-${proceso.codigo}-${tipo.prefijo}-${nextIndex}`;

    // 3. Crear documento (estado inicial: Borrador)
    const estadoInicial = 'Borrador';
    const result = await dbRun(`
      INSERT INTO documentos (
        codigo, nombre, proceso_id, tipo_documento_id, version_actual, 
        fecha_emision, fecha_revision, estado, responsable_id, 
        observaciones, archivo_path, creado_por, creado_en, actualizado_por, actualizado_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))
    `, [
      codigo, nombre, proceso_id, tipo_documento_id, version_actual || '1.0',
      fecha_emision, fecha_revision, estadoInicial, responsable_id,
      observaciones, archivo_path, usuario_id, usuario_id
    ]);

    const docId = result.id;

    // 4. Crear registro en tabla versiones
    await dbRun(`
      INSERT INTO versiones_documento (documento_id, version, fecha_emision, archivo_path, observaciones, creado_por, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [docId, version_actual || '1.0', fecha_emision, archivo_path, 'Carga inicial del borrador.', usuario_id, 'Borrador']);

    // 5. Registrar en auditoría
    await dbRun(`
      INSERT INTO historial_auditoria (documento_id, usuario_id, accion, detalles)
      VALUES (?, ?, 'CREAR', ?)
    `, [docId, usuario_id, `Se creó el documento en estado Borrador con código ${codigo}.`]);

    res.status(201).json({ success: true, docId, codigo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// EDITAR DATOS BÁSICOS DE DOCUMENTO
app.put('/api/documentos/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, responsable_id, observaciones, usuario_id } = req.body;

  try {
    const oldDoc = await dbGet('SELECT * FROM documentos WHERE id = ?', [id]);
    if (!oldDoc) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    await dbRun(`
      UPDATE documentos 
      SET nombre = ?, responsable_id = ?, observaciones = ?, actualizado_por = ?, actualizado_en = datetime('now')
      WHERE id = ?
    `, [nombre, responsable_id, observaciones, usuario_id, id]);

    // Registrar en auditoría
    await dbRun(`
      INSERT INTO historial_auditoria (documento_id, usuario_id, accion, detalles)
      VALUES (?, ?, 'ACTUALIZAR', ?)
    `, [id, usuario_id, `Se actualizaron los datos básicos del documento.`]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SUBIR NUEVA VERSIÓN (INCREMENTAL)
app.post('/api/documentos/:id/version', upload.single('archivo'), async (req, res) => {
  const { id } = req.params;
  const { version, fecha_emision, fecha_revision, observaciones, usuario_id } = req.body;
  
  let archivo_path = null;
  if (req.file) {
    if (isDriveEnabled()) {
      try {
        const localPath = req.file.path;
        const driveUrl = await uploadToDrive(localPath, req.file.originalname, req.file.mimetype);
        archivo_path = driveUrl;
        fs.unlinkSync(localPath); // Borrar archivo temporal
      } catch (err) {
        console.error('Error al subir a Google Drive, usando local fallback:', err.message);
        archivo_path = `uploads/${req.file.filename}`;
      }
    } else {
      archivo_path = `uploads/${req.file.filename}`;
    }
  }

  try {
    const doc = await dbGet('SELECT * FROM documentos WHERE id = ?', [id]);
    if (!doc) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    // 1. Registrar la versión nueva
    await dbRun(`
      INSERT INTO versiones_documento (documento_id, version, fecha_emision, archivo_path, observaciones, creado_por, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, version, fecha_emision, archivo_path || doc.archivo_path, observaciones, usuario_id, 'En Revisión']);

    // 2. Si se sube una nueva versión, el documento pasa automáticamente a "En Revisión" para ser validado.
    // Además, actualizamos la versión, el archivo path actual, la fecha de emisión/revisión y el actualizador.
    await dbRun(`
      UPDATE documentos 
      SET version_actual = ?, 
          fecha_emision = ?, 
          fecha_revision = ?,
          estado = 'En Revisión',
          archivo_path = ?,
          actualizado_por = ?, 
          actualizado_en = datetime('now')
      WHERE id = ?
    `, [version, fecha_emision, fecha_revision, archivo_path || doc.archivo_path, usuario_id, id]);

    // 3. Auditoría
    await dbRun(`
      INSERT INTO historial_auditoria (documento_id, usuario_id, accion, detalles)
      VALUES (?, ?, 'SUBIR_VERSION', ?)
    `, [id, usuario_id, `Se cargó la versión ${version}. El documento pasa a estado En Revisión.`]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. FLUJO DE TRABAJO (ESTADOS DE APROBACIÓN)
// ==========================================
app.post('/api/documentos/:id/estado', async (req, res) => {
  const { id } = req.params;
  const { nuevo_estado, observaciones, usuario_id } = req.body;

  try {
    const doc = await dbGet('SELECT * FROM documentos WHERE id = ?', [id]);
    if (!doc) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    const anteriorEstado = doc.estado;

    // Actualizar estado del documento
    await dbRun(`
      UPDATE documentos 
      SET estado = ?, actualizado_por = ?, actualizado_en = datetime('now')
      WHERE id = ?
    `, [nuevo_estado, usuario_id, id]);

    // Si pasa a Publicado, debemos marcar la versión correspondiente como "Vigente" en historial
    if (nuevo_estado === 'Publicado') {
      // Poner todas las versiones de este doc como obsoletas/no vigentes excepto la última aprobada
      await dbRun(`
        UPDATE versiones_documento 
        SET estado = 'Obsoleto' 
        WHERE documento_id = ? AND version != ?
      `, [id, doc.version_actual]);

      await dbRun(`
        UPDATE versiones_documento 
        SET estado = 'Vigente' 
        WHERE documento_id = ? AND version = ?
      `, [id, doc.version_actual]);
    } else if (nuevo_estado === 'Obsoleto') {
      // Marcar todas como Obsoletas
      await dbRun(`
        UPDATE versiones_documento 
        SET estado = 'Obsoleto' 
        WHERE documento_id = ?
      `, [id]);
    } else {
      // Actualizar el estado de la versión actual en la tabla historial de versiones
      await dbRun(`
        UPDATE versiones_documento 
        SET estado = ? 
        WHERE documento_id = ? AND version = ?
      `, [nuevo_estado, id, doc.version_actual]);
    }

    // Registrar auditoría de transición
    await dbRun(`
      INSERT INTO historial_auditoria (documento_id, usuario_id, accion, detalles)
      VALUES (?, ?, ?, ?)
    `, [id, usuario_id, nuevo_estado.toUpperCase(), `Cambio de estado: de "${anteriorEstado}" a "${nuevo_estado}". Observaciones: ${observaciones || 'Ninguna'}`]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. HISTORIAL DE AUDITORÍA GLOBAL
// ==========================================
app.get('/api/auditoria', async (req, res) => {
  try {
    const log = await dbQuery(`
      SELECT a.*, u.nombre as usuario_nombre, r.nombre as usuario_rol, d.codigo as doc_codigo, d.nombre as doc_nombre
      FROM historial_auditoria a
      JOIN usuarios u ON a.usuario_id = u.id
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN documentos d ON a.documento_id = d.id
      ORDER BY a.fecha_hora DESC
      LIMIT 100
    `);
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6.5. GESTIÓN DE USUARIOS (ADMINISTRADOR)
// ==========================================
app.get('/api/usuarios/admin', async (req, res) => {
  try {
    const usuarios = await dbQuery(`
      SELECT u.id, u.username, u.password_hash, u.nombre, u.email, u.rol_id, u.activo, u.creado_en, r.nombre as rol_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      ORDER BY u.activo DESC, u.nombre ASC
    `);
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/roles', async (req, res) => {
  try {
    const roles = await dbQuery('SELECT * FROM roles ORDER BY id');
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/usuarios', async (req, res) => {
  const { username, password, nombre, email, rol_id, admin_id } = req.body;
  try {
    const existe = await dbGet('SELECT id FROM usuarios WHERE username = ?', [username]);
    if (existe) {
      return res.status(400).json({ success: false, message: 'El nombre de usuario ya está registrado' });
    }

    const result = await dbRun(`
      INSERT INTO usuarios (username, password_hash, nombre, email, rol_id, activo, creado_en)
      VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
    `, [username, password, nombre, email, rol_id]);

    await dbRun(`
      INSERT INTO historial_auditoria (usuario_id, accion, detalles)
      VALUES (?, 'CREAR_USUARIO', ?)
    `, [admin_id || 1, `Se creó el usuario "${username}" (${nombre}) desde el panel de administración.`]);

    res.status(201).json({ success: true, userId: result.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, nombre, email, rol_id, activo, admin_id } = req.body;
  try {
    const existe = await dbGet('SELECT id FROM usuarios WHERE username = ? AND id != ?', [username, id]);
    if (existe) {
      return res.status(400).json({ success: false, message: 'El nombre de usuario ya está registrado por otra cuenta' });
    }

    await dbRun(`
      UPDATE usuarios
      SET username = ?, password_hash = ?, nombre = ?, email = ?, rol_id = ?, activo = ?
      WHERE id = ?
    `, [username, password, nombre, email, rol_id, activo, id]);

    await dbRun(`
      INSERT INTO historial_auditoria (usuario_id, accion, detalles)
      VALUES (?, 'MODIFICAR_USUARIO', ?)
    `, [admin_id || 1, `Se modificó el usuario "${username}" (Estado Activo: ${activo}) desde el panel de administración.`]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const { admin_id } = req.query;
  try {
    const userToDelete = await dbGet('SELECT username, nombre FROM usuarios WHERE id = ?', [id]);
    if (!userToDelete) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    if (parseInt(id) === parseInt(admin_id)) {
      return res.status(400).json({ success: false, message: 'No puedes eliminar tu propio usuario activo' });
    }

    await dbRun('DELETE FROM usuarios WHERE id = ?', [id]);

    await dbRun(`
      INSERT INTO historial_auditoria (usuario_id, accion, detalles)
      VALUES (?, 'ELIMINAR_USUARIO', ?)
    `, [admin_id || 1, `Se eliminó el usuario "${userToDelete.username}" (${userToDelete.nombre}) permanentemente.`]);

    res.json({ success: true });
  } catch (error) {
    if (error.message.includes('FOREIGN KEY constraint failed') || error.code === 'SQLITE_CONSTRAINT' || error.message.includes('SQLITE_CONSTRAINT')) {
      res.status(400).json({
        success: false,
        message: 'No se puede eliminar este usuario ya que tiene documentos creados, versiones cargadas o registros de auditoría asociados. Te recomendamos desactivar su estado ("Inactivo") en la edición de usuario para denegar su acceso y mantener el historial de calidad.'
      });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// ==========================================
// 7. DATOS DE RESUMEN (DASHBOARD KPIs)
// ==========================================
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const totalDocs = await dbGet('SELECT COUNT(*) as total FROM documentos');
    const vigentes = await dbGet("SELECT COUNT(*) as total FROM documentos WHERE estado = 'Publicado'");
    const revision = await dbGet("SELECT COUNT(*) as total FROM documentos WHERE estado = 'En Revisión'");
    const obsoletos = await dbGet("SELECT COUNT(*) as total FROM documentos WHERE estado = 'Obsoleto'");
    const borradores = await dbGet("SELECT COUNT(*) as total FROM documentos WHERE estado = 'Borrador'");
    
    // Documentos Vencidos y Próximos a Vencer
    // Vencido: fecha_revision < hoy y estado = 'Publicado'
    // Próximo a vencer: fecha_revision entre hoy y hoy + 30 días, y estado = 'Publicado'
    const hoy = new Date().toISOString().split('T')[0];
    const en30Dias = new Date();
    en30Dias.setDate(en30Dias.getDate() + 30);
    const en30DiasStr = en30Dias.toISOString().split('T')[0];

    const vencidos = await dbGet("SELECT COUNT(*) as total FROM documentos WHERE fecha_revision < ? AND estado = 'Publicado'", [hoy]);
    const proximos = await dbGet("SELECT COUNT(*) as total FROM documentos WHERE fecha_revision >= ? AND fecha_revision <= ? AND estado = 'Publicado'", [hoy, en30DiasStr]);

    // Resumen por áreas
    const porArea = await dbQuery(`
      SELECT p.nombre as area_nombre, p.codigo as area_codigo, COUNT(d.id) as total
      FROM procesos_areas p
      LEFT JOIN documentos d ON d.proceso_id = p.id
      GROUP BY p.id
    `);

    // Alertas críticas de vencimiento
    const alertasCriticas = await dbQuery(`
      SELECT d.id, d.codigo, d.nombre, d.fecha_revision, d.estado, u.nombre as responsable_nombre
      FROM documentos d
      JOIN usuarios u ON d.responsable_id = u.id
      WHERE d.estado = 'Publicado' AND (d.fecha_revision < ? OR (d.fecha_revision >= ? AND d.fecha_revision <= ?))
      ORDER BY d.fecha_revision ASC
    `, [hoy, hoy, en30DiasStr]);

    res.json({
      resumen: {
        total: totalDocs.total,
        vigentes: vigentes.total,
        enRevision: revision.total,
        obsoletos: obsoletos.total,
        borradores: borradores.total,
        vencidos: vencidos.total,
        proximosAVencer: proximos.total
      },
      porArea,
      alertasCriticas: alertasCriticas.map(doc => {
        const docFecha = new Date(doc.fecha_revision);
        const hoyFecha = new Date(hoy);
        const diffTime = docFecha - hoyFecha;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          ...doc,
          diasRestantes: diffDays,
          tipoAlerta: diffDays < 0 ? 'Vencido' : 'Próximo a vencer'
        };
      })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 8. NOTIFICACIONES POR CORREO (NODEMAILER)
// ==========================================

// ENVIAR ALERTA INDIVIDUAL
app.post('/api/notificaciones/enviar', async (req, res) => {
  const { docId, diasRestantes, tipoAlerta } = req.body;
  try {
    const doc = await dbGet(`
      SELECT d.id, d.codigo, d.nombre, d.fecha_revision, d.estado, u.nombre as responsable_nombre, u.email as responsable_email
      FROM documentos d
      JOIN usuarios u ON d.responsable_id = u.id
      WHERE d.id = ?
    `, [docId]);

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Documento no encontrado' });
    }

    if (!doc.responsable_email) {
      return res.status(400).json({ success: false, message: 'El responsable no tiene un correo asignado' });
    }

    const emailResult = await sendDocumentAlert(doc, diasRestantes, tipoAlerta);
    res.json({ success: true, emailResult });
  } catch (error) {
    console.error('Error al enviar notificación:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ESCANEO Y ENVÍO MASIVO DE VENCIMIENTOS
app.post('/api/notificaciones/procesar-vencimientos', async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const en30Dias = new Date();
    en30Dias.setDate(en30Dias.getDate() + 30);
    const en30DiasStr = en30Dias.toISOString().split('T')[0];

    // Buscar todos los documentos publicados y vencidos o próximos a vencer
    const docs = await dbQuery(`
      SELECT d.id, d.codigo, d.nombre, d.fecha_revision, d.estado, u.nombre as responsable_nombre, u.email as responsable_email
      FROM documentos d
      JOIN usuarios u ON d.responsable_id = u.id
      WHERE d.estado = 'Publicado' AND (d.fecha_revision < ? OR (d.fecha_revision >= ? AND d.fecha_revision <= ?))
    `, [hoy, hoy, en30DiasStr]);

    if (docs.length === 0) {
      return res.json({ success: true, count: 0, message: 'No hay documentos que requieran notificación.' });
    }

    const results = [];
    for (const doc of docs) {
      const docFecha = new Date(doc.fecha_revision);
      const hoyFecha = new Date(hoy);
      const diffTime = docFecha - hoyFecha;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const tipoAlerta = diffDays < 0 ? 'Vencido' : 'Próximo a vencer';

      if (doc.responsable_email) {
        const emailResult = await sendDocumentAlert(doc, diffDays, tipoAlerta);
        results.push({
          codigo: doc.codigo,
          email: doc.responsable_email,
          success: true,
          previewUrl: emailResult.previewUrl
        });
      } else {
        results.push({
          codigo: doc.codigo,
          success: false,
          error: 'Responsable sin correo'
        });
      }
    }

    res.json({ success: true, count: results.filter(r => r.success).length, results });
  } catch (error) {
    console.error('Error al procesar vencimientos masivos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`Servidor SGD API escuchando en http://localhost:${PORT}`);
});
