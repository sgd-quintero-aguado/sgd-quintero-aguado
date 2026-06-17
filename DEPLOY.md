# Guía de Despliegue en Render — SGD Quintero Aguado

## ¿Qué necesitas antes de empezar?
- Cuenta en GitHub (gratis): https://github.com
- Cuenta en Render (gratis): https://render.com
- Git instalado en tu PC (ya lo tienes — Git Bash)

---

## PASO 1 — Subir el código a GitHub

Abre **Git Bash** en la carpeta `APP DOCUMENTACION` y ejecuta:

```bash
git init -b main
git add .
git commit -m "SGD Quintero Aguado - primer commit"
```

Luego crea un repositorio en GitHub:
1. Ve a https://github.com/new
2. Nombre del repo: `sgd-quintero-aguado`
3. Privado ✅ (recomendado)
4. Click **Create repository**

Copia los 2 comandos que GitHub te muestra (los de "push an existing repository") y pégalos en Git Bash.

---

## PASO 2 — Desplegar en Render

1. Ve a https://render.com → **New** → **Blueprint**
2. Conecta tu cuenta de GitHub
3. Selecciona el repo `sgd-quintero-aguado`
4. Render detecta el archivo `render.yaml` automáticamente
5. Click **Apply** — Render crea los 2 servicios (backend + frontend)

---

## PASO 3 — Configurar las variables secretas

En el dashboard de Render, ve al servicio **sgd-quintero-backend** → **Environment**:

### Google Drive (obligatorio para subir archivos):
- `GOOGLE_CREDENTIALS_JSON` → Abre `backend/google-credentials.json`, copia TODO el contenido y pégalo **en una sola línea** (sin saltos de línea)

### URL de la app en correos:
- `APP_URL` → La URL del frontend que te dé Render, ej: `https://sgd-quintero-frontend.onrender.com`

### Correo real (opcional):
Si quieres que los correos de alerta lleguen a buzones reales, agrega:
- `SMTP_HOST` → ej: `smtp.gmail.com`
- `SMTP_PORT` → `587`
- `SMTP_USER` → tu correo
- `SMTP_PASS` → contraseña de aplicación de Gmail
- `SMTP_FROM` → `"SGD Quintero Aguado" <tucorreo@gmail.com>`

Sin esto, los correos usan Ethereal (modo sandbox, no llegan al buzón real).

---

## PASO 4 — Primer acceso

Una vez desplegado (~5 minutos), accede a la URL del frontend.

**Usuarios de prueba listos:**
| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| admin | admin123 | Administrador |
| carlos.elaborador | elaborador123 | Elaborador |
| diana.aprobador | aprobador123 | Aprobadora |

**⚠️ Importante:** Cambia las contraseñas después del primer acceso.

---

## Notas técnicas

- **Base de datos**: SQLite con Disco Render (1 GB). Los datos persisten entre reinicios.
- **Archivos subidos**: Se guardan en el disco de Render Y se sincronizan a Google Drive.
- **Free tier de Render**: Los servicios "duermen" a los 15 min sin tráfico (tardan ~30s en despertar). Para que siempre estén activos, actualiza al plan Starter (~$7/mes por servicio).
