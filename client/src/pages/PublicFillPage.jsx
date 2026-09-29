import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useDependenciaAuth } from '../DependenciaAuthContext';

function emptyRow(fields) {
  const row = {};
  for (const f of fields) row[f.name] = '';
  return row;
}

export default function PublicFillPage() {
  const { slug } = useParams();
  const { name } = useDependenciaAuth();
  const [template, setTemplate] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [rowsBySection, setRowsBySection] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getDependenciaTemplate(slug)
      .then((t) => {
        setTemplate(t);
        setActiveSectionId(t.sections[0]?.id ?? null);
        const initial = {};
        for (const s of t.sections) initial[s.id] = [emptyRow(s.fields)];
        setRowsBySection(initial);
      })
      .catch((err) => setLoadError(err.message));
  }, [slug]);

  const activeSection = template?.sections.find((s) => s.id === activeSectionId);
  const activeRows = activeSectionId != null ? rowsBySection[activeSectionId] || [] : [];

  function updateCell(rowIndex, fieldName, value) {
    setRowsBySection((prev) => ({
      ...prev,
      [activeSectionId]: prev[activeSectionId].map((r, i) => (i === rowIndex ? { ...r, [fieldName]: value } : r)),
    }));
  }

  function addRow() {
    setRowsBySection((prev) => ({
      ...prev,
      [activeSectionId]: [...prev[activeSectionId], emptyRow(activeSection.fields)],
    }));
  }

  function removeRow(index) {
    setRowsBySection((prev) => ({
      ...prev,
      [activeSectionId]: prev[activeSectionId].length > 1 ? prev[activeSectionId].filter((_, i) => i !== index) : prev[activeSectionId],
    }));
  }

  async function handleSubmit() {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const result = await api.submitDependenciaRows(slug, { sectionId: activeSectionId, rows: activeRows });
      setSuccess(`Se guardaron ${result.count} fila(s) correctamente en "${activeSection.name}".`);
      setRowsBySection((prev) => ({ ...prev, [activeSectionId]: [emptyRow(activeSection.fields)] }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function changeSection(sectionId) {
    setActiveSectionId(sectionId);
    setError('');
    setSuccess('');
  }

  if (loadError) return <div className="centered-page"><p className="error">{loadError}</p></div>;
  if (!template) return <div className="centered-page">Cargando...</div>;

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>{template.name}</h1>
          <p className="muted">Cargando como: {name}</p>
        </div>
        <Link to="/dependencia" className="link-button">Volver a mis OTs</Link>
      </header>

      {template.description && <p>{template.description}</p>}

      {template.sections.length > 1 && (
        <div className="tabs">
          {template.sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`tab ${s.id === activeSectionId ? 'active' : ''}`}
              onClick={() => changeSection(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {activeSection && (
        <>
          <div className="table-scroll">
            <table className="data-table editable">
              <thead>
                <tr>
                  {activeSection.fields.map((f) => (
                    <th key={f.id} title={f.help_text || ''}>
                      {f.name}
                      {f.required ? ' *' : ''}
                    </th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {activeSection.fields.map((f) => (
                      <td key={f.id}>
                        {f.type === 'select' ? (
                          <select value={row[f.name]} onChange={(e) => updateCell(rowIndex, f.name, e.target.value)}>
                            <option value=""></option>
                            {(f.options || []).map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                            value={row[f.name]}
                            onChange={(e) => updateCell(rowIndex, f.name, e.target.value)}
                          />
                        )}
                      </td>
                    ))}
                    <td>
                      <button type="button" className="link-button danger" onClick={() => removeRow(rowIndex)} disabled={activeRows.length === 1}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-actions">
            <button type="button" className="button secondary" onClick={addRow}>+ Agregar fila</button>
            <button type="button" onClick={handleSubmit} disabled={saving}>{saving ? 'Enviando...' : 'Enviar'}</button>
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
    </div>
  );
}
