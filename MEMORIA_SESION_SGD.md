# 🧠 MEMORIA DE SESIÓN — SGD Quintero Aguado SAS
**Fecha:** 17 de junio de 2026  
**Proyecto:** Sistema de Gestión Documental (SGD)  
**Responsable:** Ciro Alpe (ciralpe@yahoo.com)

---

## 🚀 Estado Actual del Despliegue

| Componente | URL | Estado |
|---|---|---|
| **Frontend** | https://sgd-quintero-frontend.onrender.com | ✅ Deployed (Static, Global CDN) |
| **Backend** | https://sgd-quintero-backend.onrender.com | ✅ Deployed (Node, Starter $7/mes) |
| **Repositorio GitHub** | https://github.com/sgd-quintero-aguado/sgd-quintero-aguado | 🌐 Público |
| **Cuenta Render** | ciralpecuadrangular@gmail.com | — |
| **Blueprint ID** | exs-d8phph5ckfvc73a92140 | — |

---

## 🛠️ Stack Técnico

- **Frontend:** React 19 + Vite (SPA, un solo archivo App.jsx)
- **Backend:** Node.js + Express + SQLite (sgd.db)
- **Almacenamiento archivos:** Local (`uploads/`) o Google Drive (si se configura)
- **Correo:** Nodemailer + Ethereal (pruebas) o SMTP real (si se configura)
- **Deploy:** Render Blueprint (`render.yaml`)

---

## 📁 Archivos Clave en la Carpeta

| Archivo | Propósito |
|---|---|
| `render.yaml` | Configuración de deploy en Render (backend + frontend) |
| `push-update.bat` | Script Windows para hacer git push desde el PC |
| `Manual_Usuario_SGD_QuinteroAguado.docx` | Manual de usuario del SGD (creado en esta sesión) |
| `backend/server.js` | Servidor principal Node.js |
| `backend/sgd.db` | Base de datos SQLite (se regenera en Render) |
| `frontend/src/App.jsx` | Toda la UI del SGD en un solo componente |

---

## 🔑 Credenciales del Sistema (Cambiar en Producción)

| Rol | Usuario | Contraseña |
|---|---|---|
| Administrador | `admin` | `admin123` |
| Elaborador | `carlos.elaborador` | `elaborador123` |
| Revisor | `maria.revisora` | `revisor123` |
| Aprobador | `diana.aprobador` | `aprobador123` |
| Colaborador | `pedro.colaborador` | `colaborador123` |
| Consulta | `juan.consulta` | `consulta123` |

⚠️ **Las contraseñas son texto plano (MVP). Cambiar antes de uso real.**

---

## 🐛 Error Pendiente — Backend Connection

**Síntoma:** Al hacer login, aparece "No se pudo conectar con el servidor backend."

**Causa identificada:** `VITE_API_URL` estaba configurada con `fromService + property: host`, que devuelve solo el hostname SIN `https://`. Vite bake el valor en tiempo de build, así que el JS compilado tiene una URL inválida.

**Solución aplicada (pendiente de push):**
```yaml
# render.yaml — ANTES (incorrecto):
- key: VITE_API_URL
  fromService:
    name: sgd-quintero-backend
    type: web
    property: host

# render.yaml — DESPUÉS (correcto):
- key: VITE_API_URL
  value: https://sgd-quintero-backend.onrender.com/api
```

**Paso que falta:** Correr `push-update.bat` para hacer git push → Render redespliega el frontend automáticamente.

---

## ✅ Cómo Actualizar el Servidor (Flujo)

1. Edita archivos en `D:\MEGACIRO\TODO LA CASAPANYUKA\APP DOCUMENTACION\`
2. Corre `push-update.bat` (doble clic)
3. Render detecta el push y redespliega automáticamente (~3-5 min)

---

## 📋 Tareas Pendientes

- [ ] **URGENTE:** Correr `push-update.bat` para aplicar el fix de `VITE_API_URL` y solucionar el error de login
- [ ] Cambiar contraseñas de todos los usuarios en producción (Admin → Gestión de Usuarios)
- [ ] Configurar `GOOGLE_CREDENTIALS_JSON` en Render → sgd-quintero-backend → Environment (pegar JSON en una línea)
- [ ] Configurar `APP_URL = https://sgd-quintero-frontend.onrender.com` en Render → sgd-quintero-backend → Environment
- [ ] (Opcional) Configurar SMTP real para envío de correos (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM)
- [ ] Revocar/eliminar `sgd-quintero-aguado-ba8fedc9e481.json` del historial de Git (credencial Google expuesta en repo público)

---

## 🔒 Seguridad — Pendiente Urgente

El archivo `sgd-quintero-aguado-ba8fedc9e481.json` (clave de servicio Google) fue commiteado al repositorio público. Pasos:
1. Revocar la clave en Google Cloud Console → IAM → Cuentas de Servicio
2. Generar nueva clave
3. Limpiar el historial Git con `git filter-branch` o BFG Repo Cleaner
4. Pegar el JSON de la nueva clave en Render → Environment → `GOOGLE_CREDENTIALS_JSON`

---

## 🌐 Variables de Entorno en Render

### sgd-quintero-backend (Web Service)
| Variable | Valor | Estado |
|---|---|---|
| `NODE_ENV` | `production` | ✅ |
| `PORT` | `10000` | ✅ |
| `FRONTEND_URL` | (automático del Blueprint) | ✅ |
| `GOOGLE_DRIVE_FOLDER_ID` | `1iCDJxGgxGrml8aRE_pzTxK-PaxECXM0O` | ✅ |
| `GOOGLE_CREDENTIALS_JSON` | (JSON de credenciales) | ❌ Sin configurar |
| `SMTP_*` | Datos del correo real | ❌ Sin configurar |
| `APP_URL` | `https://sgd-quintero-frontend.onrender.com` | ❌ Sin configurar |

### sgd-quintero-frontend (Static Site)
| Variable | Valor | Estado |
|---|---|---|
| `VITE_API_URL` | `https://sgd-quintero-backend.onrender.com/api` | ⚠️ Fix pendiente de push |

---

## 📝 Historial de Cambios Esta Sesión

1. Se resolvió el problema de "No repositories found" en Render → repo hecho **público** en GitHub
2. Se corrigió `render.yaml`: eliminado `disk:` (causaba "Payment Required") y `plan: free` (error de validación)
3. Se agregó tarjeta de crédito a Render ($7/mes Starter para backend)
4. Blueprint desplegado exitosamente → ambos servicios en Deployed ✅
5. Se identificó el bug de `VITE_API_URL` sin `https://` — fix en render.yaml pendiente de push
6. Se creó **Manual de Usuario** en Word (13 secciones, formato corporativo Quintero Aguado)
7. Se creó este archivo de memoria de sesión

---

*Archivo generado automáticamente por Claude | Sesión SGD | 17-Jun-2026*
