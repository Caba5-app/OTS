import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

function emptyForm() {
  return { name: '', password: '' };
}

export default function AdminDependencias() {
  const [dependencias, setDependencias] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api.listDependencias().then(setDependencias).catch((err) => setError(err.message));
    api.listTemplates().then(setTemplates).catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingId) {
        await api.updateDependencia(editingId, form);
      } else {
        await api.createDependencia(form);
      }
      setForm(emptyForm());
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(d) {
    setEditingId(d.id);
    setForm({ name: d.name, password: '' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function handleDelete(d) {
    if (!confirm(`¿Eliminar la dependencia "${d.name}"?`)) return;
    await api.deleteDependencia(d.id);
    load();
  }

  async function toggleTemplate(d, templateId) {
    const current = new Set(d.templateIds);
    if (current.has(templateId)) current.delete(templateId);
    else current.add(templateId);
    await api.assignDependenciaTemplates(d.id, Array.from(current));
    load();
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>Dependencias</h1>
        <Link to="/admin" className="link-button">Volver</Link>
      </header>

      <form onSubmit={handleSubmit} className="card wide">
        <h2>{editingId ? 'Editar dependencia' : 'Nueva dependencia'}</h2>
        <label>
          Nombre
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          {editingId ? 'Nueva contraseña (dejar en blanco para no cambiarla)' : 'Contraseña'}
          <input
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editingId}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          {editingId && (
            <button type="button" className="button secondary" onClick={cancelEdit}>Cancelar</button>
          )}
          <button type="submit" disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear dependencia'}</button>
        </div>
      </form>

      <table className="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>OTs asignadas</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {dependencias.map((d) => (
            <Fragment key={d.id}>
              <tr>
                <td>{d.name}</td>
                <td>{d.templateIds.length}</td>
                <td className="actions">
                  <button className="link-button" onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}>
                    {expandedId === d.id ? 'Ocultar OTs' : 'Asignar OTs'}
                  </button>
                  <button className="link-button" onClick={() => startEdit(d)}>Editar</button>
                  <button className="link-button danger" onClick={() => handleDelete(d)}>Eliminar</button>
                </td>
              </tr>
              {expandedId === d.id && (
                <tr>
                  <td colSpan={3}>
                    <div className="template-checklist">
                      {templates.map((t) => (
                        <label key={t.id} className="checkbox">
                          <input
                            type="checkbox"
                            checked={d.templateIds.includes(t.id)}
                            onChange={() => toggleTemplate(d, t.id)}
                          />
                          {t.name}
                        </label>
                      ))}
                      {templates.length === 0 && <p className="muted">No hay plantillas creadas todavía.</p>}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
