import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';

export default function TemplateData() {
  const { id } = useParams();
  const [template, setTemplate] = useState(null);
  const [rows, setRows] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api.getTemplate(id).then((t) => {
      setTemplate(t);
      setActiveSectionId((prev) => prev ?? t.sections[0]?.id ?? null);
    }).catch((err) => setError(err.message));
    api.getRows(id).then(setRows).catch((err) => setError(err.message));
  }

  useEffect(load, [id]);

  const activeSection = template?.sections.find((s) => s.id === activeSectionId);
  const activeRows = useMemo(() => rows.filter((r) => r.sectionId === activeSectionId), [rows, activeSectionId]);

  async function handleDeleteRow(rowId) {
    if (!confirm('¿Eliminar esta fila?')) return;
    await api.deleteRow(rowId);
    load();
  }

  if (!template) return <div className="page">{error || 'Cargando...'}</div>;

  return (
    <div className="page">
      <header className="topbar">
        <h1>{template.name} — datos cargados</h1>
        <div>
          <a href={`/api/templates/${id}/export`} className="button">Descargar Excel</a>
          <Link to="/admin" className="link-button">Volver</Link>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {template.sections.length > 1 && (
        <div className="tabs">
          {template.sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`tab ${s.id === activeSectionId ? 'active' : ''}`}
              onClick={() => setActiveSectionId(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {activeSection && activeRows.length === 0 && <p>Todavía no hay datos cargados en "{activeSection.name}".</p>}

      {activeSection && activeRows.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              {activeSection.fields.map((f) => (
                <th key={f.id}>{f.name}</th>
              ))}
              <th>Cargado por</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {activeRows.map((row) => (
              <tr key={row.id}>
                {activeSection.fields.map((f) => (
                  <td key={f.id}>{row.data[f.name] ?? ''}</td>
                ))}
                <td>{row.submittedBy}</td>
                <td>{row.submittedAt}</td>
                <td>
                  <button className="link-button danger" onClick={() => handleDeleteRow(row.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
