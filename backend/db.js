import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'sgd.db');

// Borrar el archivo de base de datos previo si existe para asegurar una instalación limpia
// (Desactivado para permitir persistencia de datos)
// if (fs.existsSync(dbPath)) {
//   try {
//     fs.unlinkSync(dbPath);
//     console.log('Base de datos previa eliminada para inicialización limpia.');
//   } catch (err) {
//     console.error('No se pudo borrar la base de datos previa:', err);
//   }
// }

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al abrir la base de datos:', err);
  } else {
    console.log('Conectado a la base de datos SQLite en:', dbPath);
    initializeDatabase();
  }
});

// Promesas para simplificar consultas
export const dbQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

async function initializeDatabase() {
  try {
    // Activar claves foráneas
    await dbRun('PRAGMA foreign_keys = ON');

    // 1. Roles
    await dbRun(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE NOT NULL,
        descripcion TEXT
      )
    `);
    await seedRoles();

    // 2. Procesos / Áreas
    await dbRun(`
      CREATE TABLE IF NOT EXISTS procesos_areas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL
      )
    `);
    await seedProcesos();

    // 3. Tipos de Documento
    await dbRun(`
      CREATE TABLE IF NOT EXISTS tipos_documento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prefijo TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL
      )
    `);
    await seedTiposDocumento();

    // 4. Usuarios
    await dbRun(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        nombre TEXT NOT NULL,
        email TEXT NOT NULL,
        rol_id INTEGER NOT NULL,
        activo INTEGER DEFAULT 1,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rol_id) REFERENCES roles (id)
      )
    `);
    await seedUsuarios();

    // 5. Documentos
    await dbRun(`
      CREATE TABLE IF NOT EXISTS documentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        proceso_id INTEGER NOT NULL,
        tipo_documento_id INTEGER NOT NULL,
        version_actual TEXT NOT NULL,
        fecha_emision DATE NOT NULL,
        fecha_revision DATE NOT NULL,
        estado TEXT NOT NULL,
        responsable_id INTEGER NOT NULL,
        observaciones TEXT,
        archivo_path TEXT,
        creado_por INTEGER,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_por INTEGER,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (proceso_id) REFERENCES procesos_areas (id),
        FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documento (id),
        FOREIGN KEY (responsable_id) REFERENCES usuarios (id),
        FOREIGN KEY (creado_por) REFERENCES usuarios (id),
        FOREIGN KEY (actualizado_por) REFERENCES usuarios (id)
      )
    `);
    await seedDocumentos();

    // 6. Versiones Documento
    await dbRun(`
      CREATE TABLE IF NOT EXISTS versiones_documento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        documento_id INTEGER NOT NULL,
        version TEXT NOT NULL,
        fecha_emision DATE NOT NULL,
        archivo_path TEXT,
        observaciones TEXT,
        creado_por INTEGER NOT NULL,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        estado TEXT,
        FOREIGN KEY (documento_id) REFERENCES documentos (id) ON DELETE CASCADE,
        FOREIGN KEY (creado_por) REFERENCES usuarios (id)
      )
    `);
    await seedVersiones();

    // 7. Historial Auditoría
    await dbRun(`
      CREATE TABLE IF NOT EXISTS historial_auditoria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        documento_id INTEGER,
        usuario_id INTEGER NOT NULL,
        accion TEXT NOT NULL,
        detalles TEXT,
        fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
      )
    `);
    await seedAuditoria();

    console.log('Base de datos inicializada y sembrada con éxito de forma secuencial.');
  } catch (err) {
    console.error('Error durante la inicialización de la base de datos:', err);
  }
}

// Funciones de Seeding
async function seedRoles() {
  const row = await dbGet('SELECT COUNT(*) as count FROM roles');
  if (row.count === 0) {
    await dbRun("INSERT INTO roles (nombre, descripcion) VALUES ('Administrador', 'Acceso total y configuración del sistema')");
    await dbRun("INSERT INTO roles (nombre, descripcion) VALUES ('Elaborador', 'Creador de borradores de documentos y nuevas versiones')");
    await dbRun("INSERT INTO roles (nombre, descripcion) VALUES ('Revisor', 'Revisa los borradores y propone cambios o aprueba para paso final')");
    await dbRun("INSERT INTO roles (nombre, descripcion) VALUES ('Aprobador', 'Aprueba definitivamente y publica los documentos vigentes')");
    await dbRun("INSERT INTO roles (nombre, descripcion) VALUES ('Consulta', 'Búsqueda, descarga y lectura de documentos vigentes')");
    await dbRun("INSERT INTO roles (nombre, descripcion) VALUES ('Colaborador', 'Visualización de documentos y registro de nuevos borradores')");
    console.log('Tabla roles inicializada.');
  }
}

async function seedProcesos() {
  const row = await dbGet('SELECT COUNT(*) as count FROM procesos_areas');
  if (row.count === 0) {
    await dbRun("INSERT INTO procesos_areas (codigo, nombre) VALUES ('CAL', 'Calidad')");
    await dbRun("INSERT INTO procesos_areas (codigo, nombre) VALUES ('THU', 'Talento Humano')");
    await dbRun("INSERT INTO procesos_areas (codigo, nombre) VALUES ('COM', 'Compras y Suministros')");
    await dbRun("INSERT INTO procesos_areas (codigo, nombre) VALUES ('OPE', 'Operaciones y Logística')");
    await dbRun("INSERT INTO procesos_areas (codigo, nombre) VALUES ('FIN', 'Finanzas y Administración')");
    await dbRun("INSERT INTO procesos_areas (codigo, nombre) VALUES ('SST', 'Seguridad y Salud en el Trabajo')");
    console.log('Tabla procesos_areas inicializada.');
  }
}

async function seedTiposDocumento() {
  const row = await dbGet('SELECT COUNT(*) as count FROM tipos_documento');
  if (row.count === 0) {
    await dbRun("INSERT INTO tipos_documento (prefijo, nombre) VALUES ('MAN', 'Manual')");
    await dbRun("INSERT INTO tipos_documento (prefijo, nombre) VALUES ('PRC', 'Procedimiento')");
    await dbRun("INSERT INTO tipos_documento (prefijo, nombre) VALUES ('INS', 'Instructivo')");
    await dbRun("INSERT INTO tipos_documento (prefijo, nombre) VALUES ('FOR', 'Formato')");
    await dbRun("INSERT INTO tipos_documento (prefijo, nombre) VALUES ('REG', 'Registro')");
    await dbRun("INSERT INTO tipos_documento (prefijo, nombre) VALUES ('POL', 'Política')");
    await dbRun("INSERT INTO tipos_documento (prefijo, nombre) VALUES ('LLA', 'Llamado de Atención')");
    await dbRun("INSERT INTO tipos_documento (prefijo, nombre) VALUES ('CMU', 'Comunicado')");
    console.log('Tabla tipos_documento inicializada.');
  }
}

async function seedUsuarios() {
  const row = await dbGet('SELECT COUNT(*) as count FROM usuarios');
  if (row.count === 0) {
    await dbRun("INSERT INTO usuarios (username, password_hash, nombre, email, rol_id) VALUES ('admin', 'admin123', 'Administrador General', 'admin@quinteroaguado.com.co', 1)");
    await dbRun("INSERT INTO usuarios (username, password_hash, nombre, email, rol_id) VALUES ('carlos.elaborador', 'elaborador123', 'Carlos Gómez', 'carlos.gomez@quinteroaguado.com.co', 2)");
    await dbRun("INSERT INTO usuarios (username, password_hash, nombre, email, rol_id) VALUES ('maria.revisora', 'revisor123', 'María Rodríguez', 'maria.rodriguez@quinteroaguado.com.co', 3)");
    await dbRun("INSERT INTO usuarios (username, password_hash, nombre, email, rol_id) VALUES ('diana.aprobador', 'aprobador123', 'Diana Quintero', 'diana.quintero@quinteroaguado.com.co', 4)");
    await dbRun("INSERT INTO usuarios (username, password_hash, nombre, email, rol_id) VALUES ('juan.consulta', 'consulta123', 'Juan Pérez', 'juan.perez@quinteroaguado.com.co', 5)");
    await dbRun("INSERT INTO usuarios (username, password_hash, nombre, email, rol_id) VALUES ('pedro.colaborador', 'colaborador123', 'Pedro Martínez', 'pedro.martinez@quinteroaguado.com.co', 6)");
    console.log('Tabla usuarios inicializada.');
  }
}

async function seedDocumentos() {
  const row = await dbGet('SELECT COUNT(*) as count FROM documentos');
  if (row.count === 0) {
    const documentos = [
      {
        codigo: 'QA-CAL-MAN-001',
        nombre: 'Manual de Sistema de Gestión de Calidad',
        proceso_id: 1, // CAL
        tipo_documento_id: 1, // MAN
        version_actual: '2.0',
        fecha_emision: '2026-01-15',
        fecha_revision: '2027-01-15',
        estado: 'Publicado',
        responsable_id: 4, // Diana
        observaciones: 'Manual general alineado a ISO 9001:2015.',
        archivo_path: 'uploads/qa-cal-man-001_v2.pdf',
        creado_por: 2,
        actualizado_por: 4
      },
      {
        codigo: 'QA-THU-POL-001',
        nombre: 'Política de Bienestar y Clima Laboral',
        proceso_id: 2, // THU
        tipo_documento_id: 6, // POL
        version_actual: '1.0',
        fecha_emision: '2026-03-10',
        fecha_revision: '2027-03-10',
        estado: 'Publicado',
        responsable_id: 4, // Diana
        observaciones: 'Establece directrices para incentivos y clima organizacional.',
        archivo_path: 'uploads/qa-thu-pol-001_v1.pdf',
        creado_por: 2,
        actualizado_por: 4
      },
      {
        codigo: 'QA-OPE-PRC-002',
        nombre: 'Procedimiento para Control de Inventarios en Bodega',
        proceso_id: 4, // OPE
        tipo_documento_id: 2, // PRC
        version_actual: '1.0',
        fecha_emision: '2026-06-10',
        fecha_revision: '2027-06-10',
        estado: 'En Revisión',
        responsable_id: 2, // Carlos
        observaciones: 'Documento en fase de revisión por operaciones.',
        archivo_path: 'uploads/qa-ope-prc-002_v1.pdf',
        creado_por: 2,
        actualizado_por: 2
      },
      {
        codigo: 'QA-COM-INS-003',
        nombre: 'Instructivo para Evaluación y Selección de Proveedores',
        proceso_id: 3, // COM
        tipo_documento_id: 3, // INS
        version_actual: '1.0',
        fecha_emision: '2026-06-15',
        fecha_revision: '2027-06-15',
        estado: 'Borrador',
        responsable_id: 2, // Carlos
        observaciones: 'Borrador preliminar preparado para revisión.',
        archivo_path: 'uploads/qa-com-ins-003_v1.pdf',
        creado_por: 2,
        actualizado_por: 2
      },
      {
        codigo: 'QA-CAL-REG-004',
        nombre: 'Registro de Control de Acciones Correctivas y Preventivas',
        proceso_id: 1, // CAL
        tipo_documento_id: 5, // REG
        version_actual: '1.0',
        fecha_emision: '2025-05-10',
        fecha_revision: '2026-05-10', // Vencido
        estado: 'Vencido',
        responsable_id: 2, // Carlos
        observaciones: 'Pendiente de actualización y revisión anual.',
        archivo_path: 'uploads/qa-cal-reg-004_v1.pdf',
        creado_por: 2,
        actualizado_por: 2
      },
      {
        codigo: 'QA-SST-POL-003',
        nombre: 'Política de Seguridad y Salud en el Trabajo',
        proceso_id: 6, // SST
        tipo_documento_id: 6, // POL
        version_actual: '1.0',
        fecha_emision: '2026-05-25',
        fecha_revision: '2026-07-02', // Próxima a vencer
        estado: 'Publicado',
        responsable_id: 4, // Diana
        observaciones: 'Próxima a vencer, requiere revisión del comité SST.',
        archivo_path: 'uploads/qa-sst-pol-003_v1.pdf',
        creado_por: 2,
        actualizado_por: 4
      }
    ];

    for (const doc of documentos) {
      await dbRun(`
        INSERT INTO documentos (
          codigo, nombre, proceso_id, tipo_documento_id, version_actual, 
          fecha_emision, fecha_revision, estado, responsable_id, 
          observaciones, archivo_path, creado_por, creado_en, actualizado_por, actualizado_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-5 days'), ?, datetime('now', '-2 days'))
      `, [
        doc.codigo, doc.nombre, doc.proceso_id, doc.tipo_documento_id, doc.version_actual,
        doc.fecha_emision, doc.fecha_revision, doc.estado, doc.responsable_id,
        doc.observaciones, doc.archivo_path, doc.creado_por, doc.actualizado_por
      ]);
    }
    console.log('Tabla documentos inicializada.');
  }
}

async function seedVersiones() {
  const row = await dbGet('SELECT COUNT(*) as count FROM versiones_documento');
  if (row.count === 0) {
    // Buscar los documentos insertados para referenciar sus IDs correctos
    const docs = await dbQuery('SELECT id, codigo, fecha_emision, archivo_path, creado_por, estado FROM documentos');
    for (const doc of docs) {
      if (doc.codigo === 'QA-CAL-MAN-001') {
        // Este tiene versión 1.0 obsoleta y 2.0 vigente
        await dbRun(`
          INSERT INTO versiones_documento (documento_id, version, fecha_emision, archivo_path, observaciones, creado_por, estado)
          VALUES (?, '1.0', '2025-01-10', 'uploads/qa-cal-man-001_v1.pdf', 'Versión inicial.', 2, 'Obsoleto')
        `, [doc.id]);
        await dbRun(`
          INSERT INTO versiones_documento (documento_id, version, fecha_emision, archivo_path, observaciones, creado_por, estado)
          VALUES (?, '2.0', '2026-01-15', 'uploads/qa-cal-man-001_v2.pdf', 'Actualización de estructura organizativa.', 2, 'Vigente')
        `, [doc.id]);
      } else {
        await dbRun(`
          INSERT INTO versiones_documento (documento_id, version, fecha_emision, archivo_path, observaciones, creado_por, estado)
          VALUES (?, '1.0', ?, ?, 'Carga inicial del documento.', ?, ?)
        `, [doc.id, doc.fecha_emision, doc.archivo_path, doc.creado_por, doc.estado === 'Publicado' ? 'Vigente' : doc.estado]);
      }
    }
    console.log('Tabla versiones_documento inicializada.');
  }
}

async function seedAuditoria() {
  const row = await dbGet('SELECT COUNT(*) as count FROM historial_auditoria');
  if (row.count === 0) {
    const docs = await dbQuery('SELECT id, codigo FROM documentos');
    const docMap = {};
    docs.forEach(d => docMap[d.codigo] = d.id);

    await dbRun("INSERT INTO historial_auditoria (documento_id, usuario_id, accion, detalles) VALUES (?, 2, 'CREAR', 'Carlos Gómez creó la versión 1.0 del Manual de Sistema de Gestión de Calidad.')", [docMap['QA-CAL-MAN-001']]);
    await dbRun("INSERT INTO historial_auditoria (documento_id, usuario_id, accion, detalles) VALUES (?, 4, 'PUBLICAR', 'Diana Quintero aprobó y publicó la versión 2.0 del Manual de Sistema de Gestión de Calidad.')", [docMap['QA-CAL-MAN-001']]);
    await dbRun("INSERT INTO historial_auditoria (documento_id, usuario_id, accion, detalles) VALUES (?, 2, 'CREAR', 'Carlos Gómez creó el borrador de la Política de Bienestar y Clima Laboral.')", [docMap['QA-THU-POL-001']]);
    await dbRun("INSERT INTO historial_auditoria (documento_id, usuario_id, accion, detalles) VALUES (?, 4, 'PUBLICAR', 'Diana Quintero publicó la Política de Bienestar y Clima Laboral.')", [docMap['QA-THU-POL-001']]);
    await dbRun("INSERT INTO historial_auditoria (documento_id, usuario_id, accion, detalles) VALUES (?, 2, 'CREAR', 'Carlos Gómez creó el borrador del Procedimiento para Control de Inventarios.')", [docMap['QA-OPE-PRC-002']]);
    await dbRun("INSERT INTO historial_auditoria (documento_id, usuario_id, accion, detalles) VALUES (?, 2, 'REVISAR', 'Carlos Gómez envió el Procedimiento para Control de Inventarios a Revisión.')", [docMap['QA-OPE-PRC-002']]);
    console.log('Tabla historial_auditoria inicializada.');
  }
}

export default db;
