import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useDependenciaAuth } from '../DependenciaAuthContext';

export default function DependenciaDashboard() {
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState('');
  const { name, logout } = useDependenciaAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.getDependenciaTemplates().then(setTemplates).catch((err) => setError(err.message));
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/dependencia/login');
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>OTs para completar</h1>
          <p className="muted">{name}</p>
        </div>
        <button className="link-button" onClick={handleLogout}>Cerrar sesión</button>
      </header>

      {error && <p className="error">{error}</p>}
      {templates.length === 0 && !error && <p>Todavía no tenés OTs asignadas.</p>}

      <div className="ot-list">
        {templates.map((t) => (
          <Link to={`/f/${t.slug}`} key={t.id} className="ot-card">
            <span className={`status-dot ${t.pending ? 'pending' : 'done'}`} />
            <span className="ot-name">{t.name}</span>
            <span className="ot-status">{t.pending ? 'Pendiente' : 'Cargado'}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
