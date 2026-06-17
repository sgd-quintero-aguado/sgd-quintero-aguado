import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  History,
  LogOut,
  Search,
  Filter,
  Calendar,
  User,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileUp,
  Download,
  ChevronRight,
  Grid,
  List,
  FileSignature,
  ArrowLeft,
  AlertOctagon,
  Eye,
  Info,
  Check
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BACKEND_URL = API_URL.replace('/api', '');

export default function App() {
  // Autenticación y Navegación
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('sgd_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeDocId, setActiveDocId] = useState(null);

  // Catálogos
  const [procesos, setProcesos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  // Estados de datos
  const [docs, setDocs] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminRoles, setAdminRoles] = useState([]);

  // Alerta de notificación simulada
  const [simulatedEmail, setSimulatedEmail] = useState(null);

  // Cargar catálogos al iniciar si el usuario está autenticado
  useEffect(() => {
    if (user) {
      fetchCatalogos();
      loadDashboardData();
    }
  }, [user]);

  // Cargar datos de la página activa
  useEffect(() => {
    if (!user) return;
    if (currentPage === 'dashboard') {
      loadDashboardData();
    } else if (currentPage === 'documentos') {
      loadDocuments();
    } else if (currentPage === 'detalle' && activeDocId) {
      loadDocumentDetails(activeDocId);
    } else if (currentPage === 'auditoria') {
      loadAuditLogs();
    } else if (currentPage === 'usuarios') {
      loadAdminUsers();
    }
  }, [currentPage, activeDocId, user]);

  const fetchCatalogos = async () => {
    try {
      const [resProc, resTip, resUsr] = await Promise.all([
        fetch(`${API_URL}/procesos`),
        fetch(`${API_URL}/tipos`),
        fetch(`${API_URL}/usuarios`)
      ]);
      const dataProc = await resProc.json();
      const dataTip = await resTip.json();
      const dataUsr = await resUsr.json();
      setProcesos(dataProc);
      setTipos(dataTip);
      setUsuarios(dataUsr);
    } catch (err) {
      console.error('Error al cargar catálogos:', err);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/dashboard/stats`);
      const data = await res.json();
      setDashboardStats(data);
    } catch (err) {
      console.error('Error al cargar dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async (filters = {}) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const res = await fetch(`${API_URL}/documentos?${queryParams}`);
      const data = await res.json();
      setDocs(data);
    } catch (err) {
      console.error('Error al cargar documentos:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentDetails = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/documentos/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveDoc(data);
      }
    } catch (err) {
      console.error('Error al cargar detalle del documento:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auditoria`);
      const data = await res.json();
      setAuditLogs(data);
    } catch (err) {
      console.error('Error al cargar auditoría:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminUsers = async () => {
    setLoading(true);
    try {
      const [resUsr, resRol] = await Promise.all([
        fetch(`${API_URL}/usuarios/admin`),
        fetch(`${API_URL}/roles`)
      ]);
      const dataUsr = await resUsr.json();
      const dataRol = await resRol.json();
      setAdminUsers(dataUsr);
      setAdminRoles(dataRol);
    } catch (err) {
      console.error('Error al cargar datos de usuarios de administración:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('sgd_user', JSON.stringify(userData));
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sgd_user');
    setCurrentPage('login');
  };

  // Envío real de alertas de correo usando Nodemailer
  const triggerEmailAlert = async (docId, docCodigo, docNombre, responsable, dias, tipo) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/notificaciones/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, diasRestantes: dias, tipoAlerta: tipo })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        let text = `✉️ Correo real enviado con éxito a ${data.emailResult.recipient}.`;
        if (data.emailResult.isTest && data.emailResult.previewUrl) {
          text += ` (Ver prueba Ethereal: ${data.emailResult.previewUrl})`;
        }
        setSimulatedEmail(text);
      } else {
        setSimulatedEmail(`❌ Error al enviar alerta: ${data.message || 'Error desconocido'}`);
      }
    } catch (err) {
      setSimulatedEmail('❌ Error de conexión al enviar la alerta de correo.');
    } finally {
      setLoading(false);
      setTimeout(() => {
        setSimulatedEmail(null);
      }, 15000);
    }
  };

  // Escaneo masivo y envío de alertas automáticas
  const triggerBatchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/notificaciones/procesar-vencimientos`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.count > 0) {
          let text = `✉️ Se enviaron con éxito ${data.count} correos de alerta automáticos.`;
          const firstTest = data.results.find(r => r.previewUrl);
          if (firstTest) {
            text += ` (Ver prueba Ethereal: ${firstTest.previewUrl})`;
          }
          setSimulatedEmail(text);
        } else {
          setSimulatedEmail('ℹ️ No hay documentos publicados vencidos o próximos a vencer hoy.');
        }
      } else {
        setSimulatedEmail(`❌ Error al procesar alertas: ${data.error || 'Error desconocido'}`);
      }
    } catch (err) {
      setSimulatedEmail('❌ Error de conexión al procesar alertas.');
    } finally {
      setLoading(false);
      setTimeout(() => {
        setSimulatedEmail(null);
      }, 15000);
    }
  };

  if (!user) {
    return <LoginOnBoarding onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar de navegación */}
      <aside className="sidebar">
        <div className="sidebar-brand" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.75rem', paddingBottom: '1.25rem' }}>
          <img src="/logo.png" alt="Logo La Casa del Pandeyuca" style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid rgba(255, 255, 255, 0.2)', objectFit: 'cover' }} />
          <div>
            <span className="brand-title" style={{ fontSize: '1.1rem', display: 'block', fontWeight: 700 }}>Quintero Aguado</span>
            <span className="brand-subtitle" style={{ fontSize: '0.65rem' }}>Gestión Documental</span>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">
            {user.nombre ? user.nombre.charAt(0) : 'U'}
          </div>
          <div className="user-info">
            <span className="user-name" title={user.nombre}>{user.nombre}</span>
            <span className="user-role">{user.rol_nombre}</span>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <ul className="sidebar-menu">
            <li>
              <div
                className={`menu-item ${currentPage === 'dashboard' ? 'active' : ''}`}
                onClick={() => setCurrentPage('dashboard')}
              >
                <LayoutDashboard size={18} />
                <span>Panel Principal</span>
              </div>
            </li>
            <li>
              <div
                className={`menu-item ${currentPage === 'documentos' ? 'active' : ''}`}
                onClick={() => setCurrentPage('documentos')}
              >
                <FileText size={18} />
                <span>Documentos</span>
              </div>
            </li>
            {(user.rol_nombre === 'Administrador' || user.rol_nombre === 'Elaborador' || user.rol_nombre === 'Colaborador') && (
              <li>
                <div
                  className={`menu-item ${currentPage === 'crear' ? 'active' : ''}`}
                  onClick={() => setCurrentPage('crear')}
                >
                  <PlusCircle size={18} />
                  <span>Nuevo Documento</span>
                </div>
              </li>
            )}
            {user.rol_nombre === 'Administrador' && (
              <>
                <li>
                  <div
                    className={`menu-item ${currentPage === 'usuarios' ? 'active' : ''}`}
                    onClick={() => setCurrentPage('usuarios')}
                  >
                    <User size={18} />
                    <span>Gestión de Usuarios</span>
                  </div>
                </li>
                <li>
                  <div
                    className={`menu-item ${currentPage === 'auditoria' ? 'active' : ''}`}
                    onClick={() => setCurrentPage('auditoria')}
                  >
                    <History size={18} />
                    <span>Auditoría Global</span>
                  </div>
                </li>
              </>
            )}
          </ul>

          <div className="sidebar-footer">
            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={18} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Workspace principal */}
      <div className="main-wrapper">
        <header className="top-header">
          <div className="page-title-area">
            <h2>
              {currentPage === 'dashboard' && 'Panel de Control e Indicadores'}
              {currentPage === 'documentos' && 'Repositorio General de Documentación'}
              {currentPage === 'crear' && 'Registrar Nuevo Documento'}
              {currentPage === 'detalle' && `Detalle de Documento: ${activeDoc?.codigo || ''}`}
              {currentPage === 'auditoria' && 'Bitácora de Auditoría del Sistema'}
              {currentPage === 'usuarios' && 'Administración de Usuarios y Accesos'}
            </h2>
          </div>
          <div className="header-actions">
            <span className="header-time">
              Hora local: {new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}
            </span>
          </div>
        </header>

        {/* Notificación de envío de correo */}
        {simulatedEmail && (
          <div className="notification-banner" style={{ margin: '1rem 2.5rem 0' }}>
            <div className="notification-banner-content">
              <Info size={18} />
              <span>
                {simulatedEmail.includes('http') ? (
                  <>
                    {simulatedEmail.split(' (Ver')[0].split(' (Pruebas')[0]}
                    <a 
                      href={simulatedEmail.match(/https?:\/\/[^\s)]+/)[0]} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#0E7490', textDecoration: 'underline', fontStyle: 'normal', fontWeight: 'bold', marginLeft: '0.25rem' }}
                    >
                      Abrir Correo de Pruebas (Ethereal)
                    </a>
                  </>
                ) : simulatedEmail}
              </span>
            </div>
            <button 
              onClick={() => setSimulatedEmail(null)}
              style={{ background: 'transparent', border: 'none', color: '#0891B2', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Cerrar
            </button>
          </div>
        )}

        <main className="content-body">
          {loading && <div style={{ textAlign: 'center', padding: '2rem', fontSize: '1.2rem', fontWeight: 600 }}>Cargando datos del sistema...</div>}
          
          {!loading && currentPage === 'dashboard' && (
            <DashboardView 
              stats={dashboardStats} 
              onNavigateDoc={(id) => { setActiveDocId(id); setCurrentPage('detalle'); }}
              onTriggerEmail={triggerEmailAlert}
              onTriggerBatchAlerts={triggerBatchAlerts}
            />
          )}
          
          {!loading && currentPage === 'documentos' && (
            <DocumentListView 
              docs={docs} 
              procesos={procesos}
              tipos={tipos}
              usuarios={usuarios}
              onFilter={loadDocuments}
              onNavigateDoc={(id) => { setActiveDocId(id); setCurrentPage('detalle'); }}
            />
          )}

          {!loading && currentPage === 'crear' && (
            <DocumentFormView 
              procesos={procesos}
              tipos={tipos}
              usuarios={usuarios}
              currentUser={user}
              onSuccess={() => { setCurrentPage('documentos'); }}
              onCancel={() => { setCurrentPage('dashboard'); }}
            />
          )}

          {!loading && currentPage === 'detalle' && activeDoc && (
            <DocumentDetailView 
              doc={activeDoc} 
              currentUser={user}
              usuarios={usuarios}
              onRefresh={() => loadDocumentDetails(activeDocId)}
              onBack={() => setCurrentPage('documentos')}
            />
          )}

          {!loading && currentPage === 'auditoria' && (
            <AuditLogsView logs={auditLogs} />
          )}

          {!loading && currentPage === 'usuarios' && (
            <UsuariosView
              users={adminUsers}
              roles={adminRoles}
              currentUser={user}
              onRefresh={loadAdminUsers}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE: LOGIN & CREDENCIALES DEMO
// ============================================================================
function LoginOnBoarding({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onLogin(data.user);
      } else {
        setError(data.message || 'Error en las credenciales');
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor backend.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectDemo = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" alt="Logo La Casa del Pandeyuca" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '0.5rem', border: '3px solid var(--primary)', boxShadow: 'var(--shadow-md)' }} />
          <h2>Sistema de Gestión Documental</h2>
          <p>Quintero Aguado SAS - Acceso Interno</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', background: 'var(--danger-light)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
          <div className="form-group">
            <label>Usuario</label>
            <input
              type="text"
              className="form-control"
              placeholder="ej. carlos.elaborador"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={submitting}>
            {submitting ? 'Autenticando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <details className="demo-credentials-box">
          <summary>Credenciales de Prueba (Clic para ver)</summary>
          <p style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>Selecciona un perfil para auto-completar y probar el flujo completo:</p>
          <ul className="demo-credentials-list">
            <li>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0.5rem' }} onClick={() => handleSelectDemo('admin', 'admin123')}>
                <span>🔑 Administrador (admin)</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>admin123</span>
              </button>
            </li>
            <li>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0.5rem', marginTop: '0.25rem' }} onClick={() => handleSelectDemo('carlos.elaborador', 'elaborador123')}>
                <span>✍️ Elaborador (carlos.elaborador)</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>elaborador123</span>
              </button>
            </li>
            <li>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0.5rem', marginTop: '0.25rem' }} onClick={() => handleSelectDemo('maria.revisora', 'revisor123')}>
                <span>🔍 Revisor (maria.revisora)</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>revisor123</span>
              </button>
            </li>
            <li>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0.5rem', marginTop: '0.25rem' }} onClick={() => handleSelectDemo('diana.aprobador', 'aprobador123')}>
                <span>✅ Aprobador (diana.aprobador)</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>aprobador123</span>
              </button>
            </li>
            <li>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0.5rem', marginTop: '0.25rem' }} onClick={() => handleSelectDemo('juan.consulta', 'consulta123')}>
                <span>📖 Consulta (juan.consulta)</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>consulta123</span>
              </button>
            </li>
            <li>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0.5rem', marginTop: '0.25rem' }} onClick={() => handleSelectDemo('pedro.colaborador', 'colaborador123')}>
                <span>✍️ Colaborador (pedro.colaborador)</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>colaborador123</span>
              </button>
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE: DASHBOARD VIEW
// ============================================================================
function DashboardView({ stats, onNavigateDoc, onTriggerEmail, onTriggerBatchAlerts }) {
  if (!stats) return null;

  const { resumen, porArea, alertasCriticas } = stats;

  return (
    <div>
      {/* Tarjetas de Métricas */}
      <div className="metrics-grid">
        <div className="metric-card total">
          <div className="metric-content">
            <h4>Total Documentos</h4>
            <div className="metric-value">{resumen.total}</div>
          </div>
          <div className="metric-icon-box">
            <FileText size={24} />
          </div>
        </div>

        <div className="metric-card vigentes">
          <div className="metric-content">
            <h4>Vigentes (Publicados)</h4>
            <div className="metric-value">{resumen.vigentes}</div>
          </div>
          <div className="metric-icon-box">
            <CheckCircle size={24} />
          </div>
        </div>

        <div className="metric-card revision">
          <div className="metric-content">
            <h4>En Revisión</h4>
            <div className="metric-value">{resumen.enRevision}</div>
          </div>
          <div className="metric-icon-box">
            <Clock size={24} />
          </div>
        </div>

        <div className="metric-card vencidos">
          <div className="metric-content">
            <h4>Vencidos</h4>
            <div className="metric-value">{resumen.vencidos}</div>
          </div>
          <div className="metric-icon-box">
            <AlertOctagon size={24} />
          </div>
        </div>

        <div className="metric-card proximos">
          <div className="metric-content">
            <h4>Próximos a Vencer</h4>
            <div className="metric-value">{resumen.proximosAVencer}</div>
          </div>
          <div className="metric-icon-box">
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        {/* Distribución por Procesos / Áreas */}
        <div className="section-card">
          <div className="section-header">
            <h3>Distribución Documental por Proceso / Área</h3>
          </div>
          <div className="process-list">
            {porArea.map((item, index) => {
              const porcentaje = resumen.total > 0 ? (item.total / resumen.total) * 100 : 0;
              return (
                <div className="process-item" key={index}>
                  <div className="process-info">
                    <span className="process-label">
                      <span className="process-badge">{item.area_codigo}</span>
                      {item.area_nombre}
                    </span>
                    <span className="process-count">
                      {item.total} {item.total === 1 ? 'documento' : 'documentos'} ({porcentaje.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="process-bar-container">
                    <div className="process-bar" style={{ width: `${porcentaje}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alertas de Vencimiento / Revisión */}
        <div className="section-card">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Alertas de Control Documental</h3>
            <button 
              className="btn btn-primary btn-sm"
              onClick={onTriggerBatchAlerts}
              title="Escanear base de datos y enviar correos de alerta automáticos"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              🔄 Enviar Alertas Masivas
            </button>
          </div>
          <div className="alerts-list">
            {alertasCriticas.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem' }}>
                ✅ No hay documentos vencidos ni próximos a vencer en los siguientes 30 días.
              </div>
            ) : (
              alertasCriticas.map((alerta, index) => {
                const esCritico = alerta.tipoAlerta === 'Vencido';
                return (
                  <div 
                    className={`alert-item ${esCritico ? 'critica' : 'preventiva'}`} 
                    key={index}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="alert-icon">
                      {esCritico ? <AlertOctagon size={18} /> : <AlertTriangle size={18} />}
                    </div>
                    <div className="alert-details" style={{ flexGrow: 1 }} onClick={() => onNavigateDoc(alerta.id)}>
                      <div className="alert-doc-code">{alerta.codigo}</div>
                      <div className="alert-doc-name">{alerta.nombre}</div>
                      <div className="alert-meta">
                        Responsable: {alerta.responsable_nombre} <br />
                        {esCritico ? (
                          <strong style={{ textTransform: 'uppercase' }}>Vencido hace {Math.abs(alerta.diasRestantes)} días</strong>
                        ) : (
                          <span>Vence en {alerta.diasRestantes} días</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <button 
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                        title="Enviar correo de notificación al responsable"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTriggerEmail(alerta.id, alerta.codigo, alerta.nombre, alerta.responsable_nombre, alerta.diasRestantes, alerta.tipoAlerta);
                        }}
                      >
                        ✉️ Alerta
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE: LISTADO DE DOCUMENTOS
// ============================================================================
function DocumentListView({ docs, procesos, tipos, usuarios, onFilter, onNavigateDoc }) {
  const [viewMode, setViewMode] = useState('table'); // table o card
  
  // Filtros locales
  const [search, setSearch] = useState('');
  const [procesoId, setProcesoId] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [estado, setEstado] = useState('');
  const [responsableId, setResponsableId] = useState('');

  const handleApplyFilters = () => {
    onFilter({
      search,
      proceso_id: procesoId,
      tipo_documento_id: tipoId,
      estado,
      responsable_id: responsableId
    });
  };

  const handleResetFilters = () => {
    setSearch('');
    setProcesoId('');
    setTipoId('');
    setEstado('');
    setResponsableId('');
    onFilter({});
  };

  return (
    <div>
      {/* Barra de Filtros */}
      <div className="filters-panel">
        <div className="filters-grid">
          <div className="form-group">
            <label>Búsqueda</label>
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Código, nombre..."
                style={{ paddingRight: '2.5rem', width: '100%' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search size={16} style={{ position: 'absolute', right: '12px', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group">
            <label>Proceso / Área</label>
            <select className="form-control" value={procesoId} onChange={(e) => setProcesoId(e.target.value)}>
              <option value="">Todos</option>
              {procesos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Tipo Documento</label>
            <select className="form-control" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
              <option value="">Todos</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Estado</label>
            <select className="form-control" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="Borrador">Borrador</option>
              <option value="En Revisión">En Revisión</option>
              <option value="Aprobado">Aprobado</option>
              <option value="Publicado">Publicado (Vigente)</option>
              <option value="Vencido">Vencido</option>
              <option value="Obsoleto">Obsoleto</option>
            </select>
          </div>

          <div className="form-group">
            <label>Responsable</label>
            <select className="form-control" value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
              <option value="">Todos</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', height: '40px' }}>
            <button className="btn btn-primary" onClick={handleApplyFilters}>Filtrar</button>
            <button className="btn btn-secondary" onClick={handleResetFilters}>Limpiar</button>
            
            <div className="view-controls">
              <button 
                className={`view-btn ${viewMode === 'table' ? 'active' : ''}`} 
                onClick={() => setViewMode('table')}
                title="Vista de Tabla"
              >
                <List size={18} />
              </button>
              <button 
                className={`view-btn ${viewMode === 'card' ? 'active' : ''}`} 
                onClick={() => setViewMode('card')}
                title="Vista de Ficha"
              >
                <Grid size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {docs.length === 0 ? (
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '4rem', textAlign: 'center', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3>No se encontraron documentos</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Prueba ajustando los filtros de búsqueda.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* Vista de Tabla */
        <div className="table-container">
          <table className="sgd-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre del Documento</th>
                <th>Proceso / Área</th>
                <th>Tipo</th>
                <th>Versión</th>
                <th>Responsable</th>
                <th>Revisión</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id} style={{ cursor: 'pointer' }} onClick={() => onNavigateDoc(doc.id)}>
                  <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{doc.codigo}</td>
                  <td style={{ fontWeight: 600 }}>{doc.nombre}</td>
                  <td>{doc.proceso_nombre}</td>
                  <td>{doc.tipo_nombre}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>v{doc.version_actual}</td>
                  <td>{doc.responsable_nombre}</td>
                  <td>{doc.fecha_revision}</td>
                  <td>
                    <span className={`status-badge ${doc.estado.toLowerCase().replace(' ', '_')}`}>
                      {doc.estado}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <Eye size={12} /> Ver Ficha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Vista de Fichas (Tarjetas) */
        <div className="cards-grid">
          {docs.map((doc) => (
            <div className="doc-card" key={doc.id}>
              <div className="doc-card-header">
                <span className="doc-card-code">{doc.codigo}</span>
                <span className={`status-badge ${doc.estado.toLowerCase().replace(' ', '_')}`}>
                  {doc.estado}
                </span>
              </div>
              <h4 className="doc-card-title">{doc.nombre}</h4>
              
              <div className="doc-card-meta">
                <div className="meta-field">
                  <span className="meta-label">Proceso / Área</span>
                  <span className="meta-value">{doc.proceso_nombre}</span>
                </div>
                <div className="meta-field">
                  <span className="meta-label">Tipo Documental</span>
                  <span className="meta-value">{doc.tipo_nombre}</span>
                </div>
                <div className="meta-field">
                  <span className="meta-label">Responsable</span>
                  <span className="meta-value">{doc.responsable_nombre}</span>
                </div>
                <div className="meta-field">
                  <span className="meta-label">Versión / Revisión</span>
                  <span className="meta-value">v{doc.version_actual} | {doc.fecha_revision}</span>
                </div>
              </div>

              <div className="doc-card-footer">
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Actualizado: {new Date(doc.actualizado_en).toLocaleDateString()}
                </span>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => onNavigateDoc(doc.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <span>Ver Detalle</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPONENTE: FORMULARIO CREAR DOCUMENTO
// ============================================================================
function DocumentFormView({ procesos, tipos, usuarios, currentUser, onSuccess, onCancel }) {
  const [nombre, setNombre] = useState('');
  const [procesoId, setProcesoId] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [version, setVersion] = useState('1.0');
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0]);
  const [fechaRevision, setFechaRevision] = useState(() => {
    // Por defecto 1 año a futuro
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [responsableId, setResponsableId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setArchivo(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!procesoId || !tipoId || !responsableId) {
      setError('Por favor, completa todos los campos requeridos (*).');
      return;
    }

    setSubmitting(true);
    setError('');

    const formData = new FormData();
    formData.append('nombre', nombre);
    formData.append('proceso_id', procesoId);
    formData.append('tipo_documento_id', tipoId);
    formData.append('version_actual', version);
    formData.append('fecha_emision', fechaEmision);
    formData.append('fecha_revision', fechaRevision);
    formData.append('responsable_id', responsableId);
    formData.append('observaciones', observaciones);
    formData.append('usuario_id', currentUser.id);
    if (archivo) {
      formData.append('archivo', archivo);
    }

    try {
      const res = await fetch(`${API_URL}/documentos`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess();
      } else {
        setError(data.message || 'Error al guardar el documento.');
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="form-card">
      <h3 className="form-title">Registro de Documento en Borrador</h3>
      <form onSubmit={handleSubmit}>
        {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', background: 'var(--danger-light)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
        
        <div className="form-grid">
          <div className="form-group full-width">
            <label>Nombre del Documento *</label>
            <input
              type="text"
              className="form-control"
              placeholder="ej. Procedimiento para Selección de Personal"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Proceso / Área *</label>
            <select className="form-control" value={procesoId} onChange={(e) => setProcesoId(e.target.value)} required>
              <option value="">Selecciona Proceso...</option>
              {procesos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Tipo Documental *</label>
            <select className="form-control" value={tipoId} onChange={(e) => setTipoId(e.target.value)} required>
              <option value="">Selecciona Tipo...</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Versión Inicial</label>
            <input
              type="text"
              className="form-control"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0"
              required
            />
          </div>

          <div className="form-group">
            <label>Responsable *</label>
            <select className="form-control" value={responsableId} onChange={(e) => setResponsableId(e.target.value)} required>
              <option value="">Selecciona Responsable...</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Fecha de Emisión</label>
            <input
              type="date"
              className="form-control"
              value={fechaEmision}
              onChange={(e) => setFechaEmision(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Fecha de Revisión</label>
            <input
              type="date"
              className="form-control"
              value={fechaRevision}
              onChange={(e) => setFechaRevision(e.target.value)}
              required
            />
          </div>

          <div className="form-group full-width">
            <label>Observaciones o Justificación</label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="Detalles sobre la creación de este documento o su propósito..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            ></textarea>
          </div>

          <div className="form-group full-width">
            <label>Archivo Adjunto (Documento SGC)</label>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xls,.xlsx"
            />
            <div className="file-upload-area" onClick={() => fileInputRef.current.click()}>
              <FileUp className="file-upload-icon" />
              <p style={{ fontWeight: 600 }}>Haga clic para seleccionar archivo</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PDF, Word o Excel (Máx. 10MB)</p>
              {archivo && <div className="file-name-preview">📎 Archivo listo: {archivo.name}</div>}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Guardando...' : 'Crear Documento'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// COMPONENTE: DETALLE DEL DOCUMENTO Y FLUJOS
// ============================================================================
function DocumentDetailView({ doc, currentUser, usuarios, onRefresh, onBack }) {
  const [cambioEstadoObs, setCambioEstadoObs] = useState('');
  const [submittingEstado, setSubmittingEstado] = useState(false);

  // Estados para nueva versión
  const [verFormNuevaVersion, setVerFormNuevaVersion] = useState(false);
  const [nuevaVersionNum, setNuevaVersionNum] = useState('');
  const [nuevaVersionFecha, setNuevaVersionFecha] = useState(new Date().toISOString().split('T')[0]);
  const [nuevaVersionFechaRev, setNuevaVersionFechaRev] = useState('');
  const [nuevaVersionObs, setNuevaVersionObs] = useState('');
  const [nuevaVersionArchivo, setNuevaVersionArchivo] = useState(null);
  const [nuevaVersionErr, setNuevaVersionErr] = useState('');
  const [nuevaVersionSubmitting, setNuevaVersionSubmitting] = useState(false);
  
  const nvFileInputRef = useRef();

  // Calcular versión sugerida (+1.0 a la actual)
  useEffect(() => {
    if (doc) {
      const vActual = parseFloat(doc.version_actual) || 1.0;
      setNuevaVersionNum((vActual + 1.0).toFixed(1));
      
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      setNuevaVersionFechaRev(d.toISOString().split('T')[0]);
    }
  }, [doc, verFormNuevaVersion]);

  const handleCambiarEstado = async (nuevo_estado) => {
    setSubmittingEstado(true);
    try {
      const res = await fetch(`${API_URL}/documentos/${doc.id}/estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nuevo_estado,
          observaciones: cambioEstadoObs,
          usuario_id: currentUser.id
        })
      });
      if (res.ok) {
        setCambioEstadoObs('');
        onRefresh();
      }
    } catch (err) {
      console.error('Error al cambiar de estado:', err);
    } finally {
      setSubmittingEstado(false);
    }
  };

  const handleSubirVersion = async (e) => {
    e.preventDefault();
    if (!nuevaVersionNum) {
      setNuevaVersionErr('Especifica el número de versión.');
      return;
    }
    setNuevaVersionSubmitting(true);
    setNuevaVersionErr('');

    const formData = new FormData();
    formData.append('version', nuevaVersionNum);
    formData.append('fecha_emision', nuevaVersionFecha);
    formData.append('fecha_revision', nuevaVersionFechaRev);
    formData.append('observaciones', nuevaVersionObs);
    formData.append('usuario_id', currentUser.id);
    if (nuevaVersionArchivo) {
      formData.append('archivo', nuevaVersionArchivo);
    }

    try {
      const res = await fetch(`${API_URL}/documentos/${doc.id}/version`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setVerFormNuevaVersion(false);
        setNuevaVersionObs('');
        setNuevaVersionArchivo(null);
        onRefresh();
      } else {
        const data = await res.json();
        setNuevaVersionErr(data.message || 'Error al subir versión.');
      }
    } catch (err) {
      setNuevaVersionErr('Error de conexión.');
    } finally {
      setNuevaVersionSubmitting(false);
    }
  };

  // Validaciones de roles y transiciones de estados
  const userRol = currentUser.rol_nombre; // Administrador, Elaborador, Revisor, Aprobador, Consulta
  const docEstado = doc.estado; // Borrador, En Revisión, Aprobado, Publicado, Vencido, Obsoleto

  const puedeCambiarBorrador = (userRol === 'Elaborador' || userRol === 'Administrador') && docEstado === 'Borrador';
  const puedeRevisar = (userRol === 'Revisor' || userRol === 'Aprobador' || userRol === 'Administrador') && docEstado === 'En Revisión';
  const puedeAprobarPublicar = (userRol === 'Aprobador' || userRol === 'Administrador') && docEstado === 'Aprobado';
  const puedeObsoletar = (userRol === 'Aprobador' || userRol === 'Administrador') && docEstado === 'Publicado';
  const puedeSubirVersion = (userRol === 'Elaborador' || userRol === 'Administrador') && (docEstado === 'Publicado' || docEstado === 'Vencido');

  return (
    <div className="detail-layout">
      {/* Columna Principal: Datos e Historial */}
      <div className="detail-main">
        <div className="detail-card">
          <button className="btn btn-secondary btn-sm" style={{ marginBottom: '1.5rem' }} onClick={onBack}>
            <ArrowLeft size={14} /> Volver al Repositorio
          </button>

          <div className="detail-header-block">
            <div>
              <h3>{doc.nombre}</h3>
              <span className="doc-card-code">{doc.codigo}</span>
            </div>
            <div>
              <span className={`status-badge ${doc.estado.toLowerCase().replace(' ', '_')}`} style={{ fontSize: '0.9rem', padding: '0.4rem 1rem' }}>
                {doc.estado}
              </span>
            </div>
          </div>

          <div className="detail-grid">
            <div className="meta-field">
              <span className="meta-label">Proceso / Área</span>
              <span className="meta-value">{doc.proceso_nombre}</span>
            </div>
            <div className="meta-field">
              <span className="meta-label">Tipo Documental</span>
              <span className="meta-value">{doc.tipo_nombre}</span>
            </div>
            <div className="meta-field">
              <span className="meta-label">Responsable</span>
              <span className="meta-value">{doc.responsable_nombre}</span>
            </div>
            <div className="meta-field">
              <span className="meta-label">Versión Vigente</span>
              <span className="meta-value">v{doc.version_actual}</span>
            </div>
            <div className="meta-field">
              <span className="meta-label">Fecha de Emisión</span>
              <span className="meta-value">{doc.fecha_emision}</span>
            </div>
            <div className="meta-field">
              <span className="meta-label">Fecha Próxima Revisión</span>
              <span className="meta-value">{doc.fecha_revision}</span>
            </div>
            <div className="meta-field" style={{ gridColumn: 'span 2' }}>
              <span className="meta-label">Observaciones generales</span>
              <span className="meta-value">{doc.observaciones || 'Sin observaciones.'}</span>
            </div>
            <div className="meta-field">
              <span className="meta-label">Creado por</span>
              <span className="meta-value">{doc.creador_nombre || 'N/A'} (el {new Date(doc.creado_en).toLocaleDateString()})</span>
            </div>
            <div className="meta-field">
              <span className="meta-label">Última modificación por</span>
              <span className="meta-value">{doc.actualizador_nombre || 'N/A'} (el {new Date(doc.actualizado_en).toLocaleDateString()})</span>
            </div>
          </div>

          {/* Adjunto y Visor */}
          <div style={{ marginTop: '2rem' }}>
            <h4 style={{ color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Documento Adjunto</h4>
            {doc.archivo_path ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', background: 'var(--bg-main)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FileText size={32} style={{ color: 'var(--accent)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{doc.archivo_path.split('/').pop()}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Archivo en servidor local</div>
                  </div>
                </div>
                <a 
                  href={doc.archivo_path?.startsWith('http') ? doc.archivo_path : `${BACKEND_URL}/${doc.archivo_path}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn btn-primary btn-sm"
                  style={{ textDecoration: 'none', marginLeft: 'auto' }}
                >
                  <Download size={14} /> {doc.archivo_path?.startsWith('http') ? 'Ver en Google Drive' : 'Descargar Archivo'}
                </a>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                ⚠️ No se ha cargado ningún archivo para esta versión del documento.
              </div>
            )}
          </div>
        </div>

        {/* Sección: Control de Versiones */}
        <div className="detail-card">
          <h4 style={{ color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
            Control de Versiones (Historial de Cambios)
          </h4>

          {puedeSubirVersion && !verFormNuevaVersion && (
            <button className="btn btn-primary btn-sm" style={{ marginBottom: '1.5rem' }} onClick={() => setVerFormNuevaVersion(true)}>
              ➕ Cargar Nueva Versión (Nueva revisión)
            </button>
          )}

          {verFormNuevaVersion && (
            <form onSubmit={handleSubirVersion} style={{ background: 'var(--bg-main)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
              <h5 style={{ fontWeight: 700, marginBottom: '1rem' }}>Formulario de Nueva Versión</h5>
              {nuevaVersionErr && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{nuevaVersionErr}</div>}
              
              <div className="form-grid" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label>Versión Nueva *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={nuevaVersionNum} 
                    onChange={(e) => setNuevaVersionNum(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Fecha de Emisión *</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={nuevaVersionFecha} 
                    onChange={(e) => setNuevaVersionFecha(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Nueva Fecha de Revisión *</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={nuevaVersionFechaRev} 
                    onChange={(e) => setNuevaVersionFechaRev(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Archivo Adjunto (Nueva versión)</label>
                  <input 
                    type="file" 
                    ref={nvFileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={(e) => setNuevaVersionArchivo(e.target.files[0])}
                    accept=".pdf,.doc,.docx"
                  />
                  <button type="button" className="btn btn-secondary" onClick={() => nvFileInputRef.current.click()} style={{ width: '100%', height: '40px' }}>
                    📎 {nuevaVersionArchivo ? nuevaVersionArchivo.name : 'Seleccionar Archivo'}
                  </button>
                </div>
                <div className="form-group full-width">
                  <label>Descripción de Cambios (Historial de Modificaciones) *</label>
                  <textarea 
                    className="form-control" 
                    rows="2" 
                    placeholder="Describe los cambios realizados respecto a la versión anterior..."
                    value={nuevaVersionObs} 
                    onChange={(e) => setNuevaVersionObs(e.target.value)}
                    required
                  ></textarea>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVerFormNuevaVersion(false)}>Cancelar</button>
                <button type="submit" className="btn btn-success btn-sm" disabled={nuevaVersionSubmitting}>
                  {nuevaVersionSubmitting ? 'Guardando...' : 'Cargar Versión'}
                </button>
              </div>
            </form>
          )}

          <div className="timeline">
            {doc.versiones?.map((v, index) => {
              const esVigente = v.estado === 'Vigente';
              return (
                <div className={`timeline-item ${esVigente ? 'vigente' : ''}`} key={v.id}>
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <div className="timeline-title-row">
                      <span className="timeline-version">Versión {v.version}</span>
                      <span className="timeline-date">{v.fecha_emision}</span>
                    </div>
                    <div className="timeline-desc">
                      <strong>Cambios:</strong> {v.observaciones}
                    </div>
                    <div className="timeline-desc">
                      <strong>Cargado por:</strong> <span className="timeline-user">{v.creador_nombre}</span>
                    </div>
                    <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`status-badge ${v.estado?.toLowerCase().replace(' ', '_')}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.5rem' }}>
                        {v.estado}
                      </span>
                      {v.archivo_path && (
                        <a 
                          href={v.archivo_path?.startsWith('http') ? v.archivo_path : `${BACKEND_URL}/${v.archivo_path}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.1rem' }}
                        >
                          <Download size={10} /> {v.archivo_path?.startsWith('http') ? 'Ver en Google Drive' : 'Descargar esta versión'}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sección: Auditoría del Documento */}
        <div className="detail-card">
          <h4 style={{ color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            Historial de Auditoría (Bitácora del Documento)
          </h4>
          <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table className="sgd-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Detalles</th>
                  <th>Fecha y Hora</th>
                </tr>
              </thead>
              <tbody>
                {doc.auditoria?.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.usuario_nombre}</td>
                    <td>
                      <span className="status-badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.5rem', backgroundColor: '#E2E8F0', color: '#1E293B' }}>
                        {a.accion}
                      </span>
                    </td>
                    <td>{a.detalles}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(a.fecha_hora).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Columna Lateral: Flujo de Aprobación */}
      <div className="detail-sidebar">
        <div className="action-panel">
          <h4>Flujo de Trabajo y Aprobación</h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Tu Rol en el sistema: <strong style={{ color: 'var(--primary)' }}>{userRol}</strong>
          </p>

          <div style={{ marginTop: '0.5rem' }}>
            <span className="meta-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Estado Actual:</span>
            <span className={`status-badge ${doc.estado.toLowerCase().replace(' ', '_')}`} style={{ fontSize: '0.85rem', padding: '0.3rem 0.8rem', display: 'inline-block' }}>
              {doc.estado}
            </span>
          </div>

          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem' }}>Comentarios o justificación del cambio:</label>
            <textarea
              className="form-control"
              rows="3"
              style={{ fontSize: '0.8rem', background: '#FFFFFF' }}
              placeholder="Escribe comentarios sobre tu decisión..."
              value={cambioEstadoObs}
              onChange={(e) => setCambioEstadoObs(e.target.value)}
            ></textarea>
          </div>

          <div className="action-buttons" style={{ marginTop: '0.5rem' }}>
            {/* Borrador -> En revisión (Elaborador / Admin) */}
            {puedeCambiarBorrador && (
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                onClick={() => handleCambiarEstado('En Revisión')}
                disabled={submittingEstado}
              >
                🚀 Enviar a Revisión
              </button>
            )}

            {/* En revisión -> Rechazado/Aprobado (Revisor / Admin) */}
            {puedeRevisar && (
              <>
                <button 
                  className="btn btn-success" 
                  style={{ width: '100%' }}
                  onClick={() => handleCambiarEstado('Aprobado')}
                  disabled={submittingEstado}
                >
                  ✔️ Aprobar Documento
                </button>
                <button 
                  className="btn btn-danger" 
                  style={{ width: '100%' }}
                  onClick={() => handleCambiarEstado('Borrador')}
                  disabled={submittingEstado}
                >
                  ❌ Rechazar (Devolver a Borrador)
                </button>
              </>
            )}

            {/* Aprobado -> Publicado/Rechazado (Aprobador / Admin) */}
            {puedeAprobarPublicar && (
              <>
                <button 
                  className="btn btn-success" 
                  style={{ width: '100%' }}
                  onClick={() => handleCambiarEstado('Publicado')}
                  disabled={submittingEstado}
                >
                  📢 Publicar y Vigente
                </button>
                <button 
                  className="btn btn-danger" 
                  style={{ width: '100%' }}
                  onClick={() => handleCambiarEstado('Borrador')}
                  disabled={submittingEstado}
                >
                  ❌ Rechazar y Reajustar
                </button>
              </>
            )}

            {/* Publicado -> Obsoleto (Aprobador / Admin) */}
            {puedeObsoletar && (
              <button 
                className="btn btn-danger" 
                style={{ width: '100%' }}
                onClick={() => handleCambiarEstado('Obsoleto')}
                disabled={submittingEstado}
              >
                ⚠️ Declarar Obsoleto (Despublicar)
              </button>
            )}

            {!puedeCambiarBorrador && !puedeRevisar && !puedeAprobarPublicar && !puedeObsoletar && (
              <div style={{ padding: '0.75rem', background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ℹ️ No tienes acciones disponibles en este estado con tu rol actual.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE: AUDITORÍA GENERAL VIEW
// ============================================================================
function AuditLogsView({ logs }) {
  return (
    <div className="section-card">
      <div className="section-header">
        <h3>Historial Global de Auditoría (Bitácora del Sistema)</h3>
      </div>
      <div className="table-container">
        <table className="sgd-table">
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Código Doc</th>
              <th>Acción</th>
              <th>Detalles</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{new Date(log.fecha_hora).toLocaleString()}</td>
                <td style={{ fontWeight: 600 }}>{log.usuario_nombre}</td>
                <td><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.usuario_rol}</span></td>
                <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{log.doc_codigo || 'Global / Sistema'}</td>
                <td>
                  <span className="status-badge" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', backgroundColor: '#E2E8F0', color: '#1F2937' }}>
                    {log.accion}
                  </span>
                </td>
                <td>{log.detalles}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE: GESTIÓN DE USUARIOS VIEW
// ============================================================================
function UsuariosView({ users, roles, currentUser, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  // Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rolId, setRolId] = useState('');
  const [activo, setActivo] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleDeleteUser = async (u) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario "${u.username}" (${u.nombre})?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/usuarios/${u.id}?admin_id=${currentUser.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onRefresh();
      } else {
        alert(data.message || 'Error al eliminar el usuario.');
      }
    } catch (err) {
      alert('Error de conexión con el servidor.');
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setUsername('');
    setPassword('');
    setNombre('');
    setEmail('');
    setRolId(roles[0]?.id || '');
    setActivo(true);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setUsername(u.username);
    setPassword(u.password_hash);
    setNombre(u.nombre);
    setEmail(u.email);
    setRolId(u.rol_id);
    setActivo(u.activo === 1);
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password || !nombre || !email || !rolId) {
      setError('Por favor completa todos los campos.');
      return;
    }
    setSubmitting(true);
    setError('');

    const payload = {
      username,
      password,
      nombre,
      email,
      rol_id: parseInt(rolId),
      activo: activo ? 1 : 0,
      admin_id: currentUser.id
    };

    try {
      let res;
      if (editingUser) {
        res = await fetch(`${API_URL}/usuarios/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_URL}/usuarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (res.ok && (data.success || data.userId)) {
        setShowModal(false);
        onRefresh();
      } else {
        setError(data.message || 'Ocurrió un error al guardar el usuario.');
      }
    } catch (err) {
      setError('Error al conectar con el servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="section-card">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Administración de Usuarios y Permisos</h3>
        <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
          ➕ Registrar Nuevo Usuario
        </button>
      </div>

      <div className="table-container">
        <table className="sgd-table">
          <thead>
            <tr>
              <th>Nombre Completo</th>
              <th>Usuario</th>
              <th>Contraseña</th>
              <th>Correo Electrónico</th>
              <th>Rol Asignado</th>
              <th>Estado</th>
              <th>Fecha Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                <td style={{ color: 'var(--accent)', fontWeight: 700 }}>{u.username}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{u.password_hash}</td>
                <td>{u.email}</td>
                <td>
                  <span className="status-badge" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', fontSize: '0.75rem' }}>
                    {u.rol_nombre}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${u.activo === 1 ? 'vigente' : 'vencido'}`}>
                    {u.activo === 1 ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>{new Date(u.creado_en).toLocaleDateString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(u)}>
                      ✏️ Editar
                    </button>
                    <button 
                      className="btn btn-danger btn-sm" 
                      onClick={() => handleDeleteUser(u)}
                      disabled={u.id === currentUser.id}
                      title={u.id === currentUser.id ? 'No puedes eliminarte a ti mismo' : 'Eliminar usuario'}
                    >
                      🗑️ Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="form-card" style={{ width: '100%', maxWidth: '500px', margin: 0, position: 'relative' }}>
            <h4 className="form-title" style={{ marginBottom: '1.25rem' }}>
              {editingUser ? `Editar Usuario: ${editingUser.username}` : 'Registrar Nuevo Usuario'}
            </h4>
            
            {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', background: 'var(--danger-light)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>{error}</div>}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>Nombre Completo *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="ej. Pedro Martínez"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Nombre de Usuario (Login) *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="ej. pedro.colaborador"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Contraseña *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="ej. colaborador123"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Correo Electrónico *</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="ej. pedro@quinteroaguado.com.co"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Rol de Usuario *</label>
                  <select className="form-control" value={rolId} onChange={(e) => setRolId(e.target.value)} required>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>

                {editingUser && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input
                      type="checkbox"
                      id="activo-check"
                      checked={activo}
                      onChange={(e) => setActivo(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="activo-check" style={{ fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>Usuario Activo (Permite Login)</label>
                  </div>
                )}
              </div>

              <div className="form-actions" style={{ marginTop: '1.5rem', padding: 0 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)} disabled={submitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Guardar Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
