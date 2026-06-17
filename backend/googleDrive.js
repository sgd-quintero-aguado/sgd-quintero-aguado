import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const credentialsPath = path.join(__dirname, 'google-credentials.json');

// ID de la carpeta en Google Drive donde se guardarán los archivos.
export const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1iCDJxGgxGrml8aRE_pzTxK-PaxECXM0O';

let drive = null;
let useDrive = false;

// Soporte dual: archivo local (dev) o variable de entorno GOOGLE_CREDENTIALS_JSON (producción)
const credsFromEnv = process.env.GOOGLE_CREDENTIALS_JSON;
const hasCredentials = credsFromEnv || fs.existsSync(credentialsPath);

if (hasCredentials) {
  try {
    const credsJson = credsFromEnv
      ? JSON.parse(credsFromEnv)
      : JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    
    if (credsJson.type === 'oauth2_user') {
      const oauth2Client = new google.auth.OAuth2(
        credsJson.client_id,
        credsJson.client_secret,
        'http://localhost:3002/oauth2callback'
      );
      
      oauth2Client.setCredentials({
        refresh_token: credsJson.refresh_token,
        access_token: credsJson.access_token
      });
      
      drive = google.drive({ version: 'v3', auth: oauth2Client });
      useDrive = true;
      console.log('✅ Google Drive API (OAuth2) configurada con éxito. Listo para subir archivos.');
    } else {
      const auth = new google.auth.GoogleAuth({
        ...(credsFromEnv ? { credentials: credsJson } : { keyFile: credentialsPath }),
        scopes: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive'
        ],
      });
      drive = google.drive({ version: 'v3', auth });
      useDrive = true;
      console.log('✅ Google Drive API (Cuenta de Servicio) configurada con éxito. Listo para subir archivos.');
    }
  } catch (err) {
    console.error('❌ Error al inicializar la API de Google Drive:', err.message);
  }
} else {
  console.log('⚠️ Sin credenciales de Google Drive. Usando almacenamiento local en uploads/.');
}

/**
 * Sube un archivo a Google Drive y devuelve su enlace público de visualización.
 * @param {string} localFilePath Ruta local temporal del archivo subido.
 * @param {string} fileName Nombre original del archivo.
 * @param {string} mimeType Tipo MIME (ej. application/pdf).
 * @returns {Promise<string>} Enlace de Google Drive.
 */
export async function uploadToDrive(localFilePath, fileName, mimeType) {
  if (!useDrive || !drive) {
    throw new Error('Google Drive no está activo (falta google-credentials.json).');
  }

  const fileMetadata = {
    name: fileName,
    parents: DRIVE_FOLDER_ID !== 'CAMBIA_ESTE_ID_DE_CARPETA_DE_DRIVE' ? [DRIVE_FOLDER_ID] : [],
  };

  const media = {
    mimeType: mimeType,
    body: fs.createReadStream(localFilePath),
  };

  try {
    // 1. Crear/Subir archivo en Drive
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });

    const fileId = file.data.id;

    // 2. Cambiar permisos del archivo a público para que cualquiera pueda verlo en la app
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    console.log(`✅ Archivo subido con éxito a Google Drive. ID de Archivo: ${fileId}`);
    return file.data.webViewLink; // Enlace público de Google Drive
  } catch (err) {
    console.error('Error durante la subida del archivo a Google Drive:', err.message);
    throw err;
  }
}

export function isDriveEnabled() {
  return useDrive && DRIVE_FOLDER_ID !== 'CAMBIA_ESTE_ID_DE_CARPETA_DE_DRIVE';
}
export default drive;
