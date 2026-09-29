import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const COLUMNS = '18% 7% 11% 19% 25% 20%';

export default function AdminDashboard() {
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  function load() {
    api.listTemplates().then(setTemplates).catch((err) => setError(err.message));
  }

  useEffect(load, []);

  function publicUrl(slug) {
    return `${window.location.origin}/f/${slug}`;
  }

  function copyLink(t) {
    navigator.clipboard.writeText(publicUrl(t.slug)).then(() => {
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  async function handleDelete(t) {
    if (!confirm(`¿Eliminar la plantilla "${t.name}" y todos sus datos cargados? Esta acción no se puede deshacer.`)) return;
    await api.deleteTemplate(t.id);
    load();
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function templateStatus(t) {
    if (!t.dependencias || t.dependencias.length === 0) return 'unassigned';
    return t.dependencias.some((d) => d.pending) ? 'pending' : 'done';
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>Plantillas</h1>
        <div>
          <Link to="/admin/templates/new" className="button">+ Nueva plantilla</Link>
          <Link to="/admin/dependencias" className="link-button">Dependencias</Link>
          <button className="link-button" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {templates.length === 0 && !error && <p>Todavía no creaste ninguna plantilla.</p>}

      {templates.length > 0 && (
        <div className="table-scroll">
          <div className="grid-table cols-6" style={{ gridTemplateColumns: COLUMNS }}>
            <div className="g-head">Nombre</div>
            <div className="g-head">Hojas</div>
            <div className="g-head">Filas cargadas</div>
            <div className="g-head">Quiénes deben completarla</div>
            <div className="g-head">Link (requiere login de dependencia)</div>
            <div className="g-head">Acciones</div>

            {templates.map((t) => (
              <Fragment key={t.id}>
                <div className="g-cell">
                  <span className={`status-dot inline ${templateStatus(t)}`} />
                  {t.name}
                </div>

                <div className="g-cell">{t.sectionCount}</div>

                <div className="g-cell">{t.rowCount}</div>

                <div className="g-cell">
                  {t.dependencias.length === 0 && <span className="muted">Sin asignar</span>}
                  {t.dependencias.length > 0 && (
                    <ul className="dependencia-list">
                      {t.dependencias.map((d) => (
                        <li key={d.id}>
                          <span className={`status-dot inline ${d.pending ? 'pending' : 'done'}`} />
                          {d.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="g-cell link-cell">
                  <code className="slug">{publicUrl(t.slug)}</code>
                  <button className="link-button" onClick={() => copyLink(t)}>
                    {copiedId === t.id ? 'Copiado ✓' : 'Copiar'}
                  </button>
                </div>

                <div className="g-cell actions">
                  <Link to={`/admin/templates/${t.id}/data`} className="action-btn">Ver datos</Link>
                  <Link to={`/admin/templates/${t.id}/edit`} className="action-btn">Editar</Link>
                  <a href={`/api/templates/${t.id}/export`} className="action-btn">Descargar Excel</a>
                  <button className="action-btn danger" onClick={() => handleDelete(t)}>Eliminar</button>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
