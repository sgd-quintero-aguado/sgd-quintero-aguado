import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const credentialsPath = path.join(__dirname, 'google-credentials.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('=== Generador de Credenciales Google Drive OAuth2 ===\n');
  
  let clientId = '';
  let clientSecret = '';
  
  // Buscar archivos que coincidan con client_secret_*.json en el directorio raíz (padre de backend)
  const rootDir = path.join(__dirname, '..');
  const files = fs.readdirSync(rootDir);
  const secretFile = files.find(f => f.startsWith('client_secret_') && f.endsWith('.json'));
  
  if (secretFile) {
    const secretFilePath = path.join(rootDir, secretFile);
    try {
      const secretJson = JSON.parse(fs.readFileSync(secretFilePath, 'utf8'));
      if (secretJson.installed) {
        clientId = secretJson.installed.client_id;
        clientSecret = secretJson.installed.client_secret;
        console.log(`📂 Detectado archivo de secretos: ${secretFile}`);
        console.log('✅ ID de cliente y Secreto cargados automáticamente.\n');
      }
    } catch (e) {
      console.warn(`⚠️ Error al leer el archivo ${secretFile}:`, e.message);
    }
  }

  if (!clientId || !clientSecret) {
    clientId = (await question('Introduce tu ID de cliente de OAuth (Client ID): ')).trim();
    clientSecret = (await question('Introduce tu Secreto de cliente (Client Secret): ')).trim();
  }
  
  if (!clientId || !clientSecret) {
    console.error('❌ El ID de cliente y el Secreto de cliente son requeridos.');
    rl.close();
    process.exit(1);
  }

  rl.close();

  // El puerto 3002 se usa para recibir el código de autenticación en local
  const redirectUri = 'http://localhost:3002/oauth2callback';
  
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Esto asegura obtener el Refresh Token
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive'
    ],
    prompt: 'consent' // Fuerza a Google a mostrar la pantalla de consentimiento
  });

  console.log('\n------------------------------------------------');
  console.log('👉 Abre este enlace en tu navegador para autorizar la aplicación:\n');
  console.log(authUrl);
  console.log('------------------------------------------------\n');

  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/oauth2callback') {
      const code = parsedUrl.query.code;
      
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>¡Autenticación exitosa!</h1><p>Ya puedes cerrar esta pestaña y volver a la consola.</p>');
        
        server.close();
        console.log('🔌 Servidor local cerrado. Intercambiando código de autorización...');
        
        try {
          const { tokens } = await oauth2Client.getToken(code);
          
          if (!tokens.refresh_token) {
            console.warn('⚠️ No se recibió un Refresh Token. Si ya habías autorizado la app antes, ve a la configuración de seguridad de tu cuenta de Google, quita los permisos a "SGD Drive" e intenta de nuevo.');
          }

          const creds = {
            type: 'oauth2_user',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: tokens.refresh_token || '',
            access_token: tokens.access_token || ''
          };

          fs.writeFileSync(credentialsPath, JSON.stringify(creds, null, 2));
          console.log('\n✅ ¡Éxito! Credenciales guardadas en:');
          console.log(credentialsPath);
          process.exit(0);
        } catch (err) {
          console.error('❌ Error al obtener los tokens:', err.message);
          process.exit(1);
        }
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Error de autenticación</h1><p>No se recibió el código de autorización.</p>');
        process.exit(1);
      }
    }
  });

  server.listen(3002, () => {
    console.log('📡 Servidor local esperando autorización en el puerto 3002...');
  });
}

main().catch(err => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
