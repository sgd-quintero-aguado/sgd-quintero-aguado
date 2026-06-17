import nodemailer from 'nodemailer';

let transporter = null;
let etherealAccount = null;

/**
 * Inicializa y obtiene el transportador de correo (SMTP configurado o Ethereal sandbox)
 */
async function getTransporter() {
  if (transporter) {
    return { transporter, isTest: !!etherealAccount, testAccount: etherealAccount };
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && port && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465, // SSL
      auth: {
        user,
        pass
      }
    });
    console.log('📬 Servidor de Correo SMTP configurado desde variables de entorno.');
    return { transporter, isTest: false };
  } else {
    console.log('📡 Generando cuenta de pruebas en Ethereal Email...');
    etherealAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // TLS
      auth: {
        user: etherealAccount.user,
        pass: etherealAccount.pass
      }
    });
    console.log(`✅ Cuenta de pruebas Ethereal generada con éxito: ${etherealAccount.user}`);
    return { transporter, isTest: true, testAccount: etherealAccount };
  }
}

/**
 * Envía un correo electrónico de alerta para un documento
 * @param {object} doc Datos del documento (incluye responsable_nombre, responsable_email, etc.)
 * @param {number} diasRestantes Días restantes para el vencimiento (puede ser negativo si ya venció)
 * @param {string} tipoAlerta 'Vencido' o 'Próximo a vencer'
 */
export async function sendDocumentAlert(doc, diasRestantes, tipoAlerta) {
  const { transporter, isTest, testAccount } = await getTransporter();

  const from = process.env.SMTP_FROM || (isTest 
    ? `"${testAccount.user}" <${testAccount.user}>` 
    : '"Sistema Gestión Documental Quintero Aguado" <noreply@quinteroaguado.com.co>');
    
  const to = doc.responsable_email;
  const subject = `[SGD Alerta] Documento ${tipoAlerta}: ${doc.codigo} - ${doc.nombre}`;

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="text-align: center; border-bottom: 2px solid #0891b2; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #0891b2; margin: 0; font-size: 22px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Alerta de Control Documental</h2>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0; font-weight: 500;">Quintero Aguado SAS - Sistema de Gestión de Calidad</p>
      </div>
      
      <p style="font-size: 15px; line-height: 1.6; color: #334155;">
        Estimado(a) <strong>${doc.responsable_nombre}</strong>,
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #334155;">
        Te informamos que se ha detectado un requerimiento de atención para el siguiente documento bajo tu responsabilidad en el SGC:
      </p>
      
      <div style="background-color: #f8fafc; border-left: 5px solid ${tipoAlerta === 'Vencido' ? '#ef4444' : '#f59e0b'}; padding: 18px; margin: 22px 0; border-radius: 6px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px; width: 160px; text-transform: uppercase;">Código:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 700; font-size: 15px;">${doc.codigo}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px; text-transform: uppercase;">Documento:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-size: 15px;">${doc.nombre}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px; text-transform: uppercase;">Estado:</td>
            <td style="padding: 6px 0; font-size: 13px;"><span style="background-color: ${tipoAlerta === 'Vencido' ? '#fee2e2' : '#fef3c7'}; color: ${tipoAlerta === 'Vencido' ? '#991b1b' : '#92400e'}; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 12px; display: inline-block;">${doc.estado}</span></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px; text-transform: uppercase;">Fecha Límite:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-size: 15px;">${doc.fecha_revision}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px; text-transform: uppercase;">Estatus:</td>
            <td style="padding: 6px 0; color: ${tipoAlerta === 'Vencido' ? '#dc2626' : '#d97706'}; font-weight: 700; font-size: 15px;">
              ${tipoAlerta === 'Vencido' 
                ? `🚨 VENCIDO hace ${Math.abs(diasRestantes)} días` 
                : `⚠️ Próximo a vencer en ${diasRestantes} días`}
            </td>
          </tr>
        </table>
      </div>
      
      <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-top: 20px; font-style: italic;">
        <strong>Acción Requerida:</strong> Por favor, ingresa al Sistema de Gestión Documental para proceder con la actualización de la documentación o para cargar una nueva revisión técnica en borrador.
      </p>
      
      <div style="text-align: center; margin: 30px 0 10px 0;">
        <a href="${process.env.APP_URL || 'http://localhost:5173/'}" style="background-color: #0891b2; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(8, 145, 178, 0.3); transition: background-color 0.2s;">
          Acceder al Sistema SGD
        </a>
      </div>
      
      <div style="border-top: 1px solid #e2e8f0; margin-top: 35px; padding-top: 15px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.4;">
        Este correo fue generado automáticamente por el Sistema de Gestión Documental de Quintero Aguado SAS.<br>
        Por favor, no respondas a este mensaje.
      </div>
    </div>
  `;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html
  });

  let previewUrl = null;
  if (isTest) {
    previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`✉️ Alerta de correo enviada a pruebas (Ethereal). Ver aquí: ${previewUrl}`);
  } else {
    console.log(`✉️ Correo real enviado a ${to}. ID: ${info.messageId}`);
  }

  return { 
    success: true, 
    isTest, 
    previewUrl, 
    messageId: info.messageId,
    recipient: to
  };
}
