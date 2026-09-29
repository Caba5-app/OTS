import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

const TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'select', label: 'Lista de opciones' },
];

function emptyField() {
  return { name: '', type: 'text', required: false, help_text: '', optionsText: '' };
}

function emptySection(index) {
  return { name: `Hoja ${index + 1}`, fields: [emptyField()] };
}

export default function TemplateEditor() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [headerColor, setHeaderColor] = useState('#8B5CF6');
  const [sections, setSections] = useState([emptySection(0)]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    api.getTemplate(id).then((t) => {
      setName(t.name);
      setDescription(t.description || '');
      setHeaderColor(t.header_color || '#8B5CF6');
      setSections(
        t.sections.map((s) => ({
          id: s.id,
          name: s.name,
          fields: s.fields.map((f) => ({
            name: f.name,
            type: f.type,
            required: f.required,
            help_text: f.help_text || '',
            optionsText: (f.options || []).join(', '),
          })),
        }))
      );
    });
  }, [id, isEdit]);

  function updateSectionName(sectionIndex, value) {
    setSections((prev) => prev.map((s, i) => (i === sectionIndex ? { ...s, name: value } : s)));
  }

  function addSection() {
    setSections((prev) => [...prev, emptySection(prev.length)]);
  }

  function removeSection(sectionIndex) {
    const section = sections[sectionIndex];
    if (section.id && !confirm(`Al guardar se van a borrar la hoja "${section.name}" y todos los datos cargados en ella. ¿Continuar?`)) return;
    setSections((prev) => prev.filter((_, i) => i !== sectionIndex));
  }

  function updateField(sectionIndex, fieldIndex, patch) {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIndex
          ? { ...s, fields: s.fields.map((f, j) => (j === fieldIndex ? { ...f, ...patch } : f)) }
          : s
      )
    );
  }

  function addField(sectionIndex) {
    setSections((prev) =>
      prev.map((s, i) => (i === sectionIndex ? { ...s, fields: [...s.fields, emptyField()] } : s))
    );
  }

  function removeField(sectionIndex, fieldIndex) {
    setSections((prev) =>
      prev.map((s, i) => (i === sectionIndex ? { ...s, fields: s.fields.filter((_, j) => j !== fieldIndex) } : s))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        header_color: headerColor,
        sections: sections.map((s) => ({
          id: s.id,
          name: s.name,
          fields: s.fields.map((f) => ({
            name: f.name,
            type: f.type,
            required: f.required,
            help_text: f.help_text,
            options: f.type === 'select' ? f.optionsText.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
          })),
        })),
      };
      if (isEdit) {
        await api.updateTemplate(id, payload);
      } else {
        await api.createTemplate(payload);
      }
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>{isEdit ? 'Editar plantilla' : 'Nueva plantilla'}</h1>
      </header>

      <form onSubmit={handleSubmit} className="card wide">
        <label>
          Nombre de la plantilla
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Descripción (opcional)
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>
          Color del encabezado en el Excel exportado
          <div className="color-row">
            <input type="color" value={headerColor} onChange={(e) => setHeaderColor(e.target.value)} />
            <span>{headerColor}</span>
          </div>
        </label>

        {sections.map((section, sectionIndex) => (
          <div className="section-block" key={sectionIndex}>
            <div className="section-header">
              <input
                className="section-name"
                placeholder="Nombre de la hoja"
                value={section.name}
                onChange={(e) => updateSectionName(sectionIndex, e.target.value)}
                required
              />
              <button
                type="button"
                className="link-button danger"
                onClick={() => removeSection(sectionIndex)}
                disabled={sections.length === 1}
              >
                Quitar hoja
              </button>
            </div>

            {section.fields.map((field, fieldIndex) => (
              <div className="field-row" key={fieldIndex}>
                <input
                  placeholder="Nombre de la columna"
                  value={field.name}
                  onChange={(e) => updateField(sectionIndex, fieldIndex, { name: e.target.value })}
                  required
                />
                <select
                  value={field.type}
                  onChange={(e) => updateField(sectionIndex, fieldIndex, { type: e.target.value })}
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {field.type === 'select' && (
                  <input
                    placeholder="Opciones separadas por coma"
                    value={field.optionsText}
                    onChange={(e) => updateField(sectionIndex, fieldIndex, { optionsText: e.target.value })}
                  />
                )}
                <input
                  placeholder="Ayuda para quien completa (opcional)"
                  value={field.help_text}
                  onChange={(e) => updateField(sectionIndex, fieldIndex, { help_text: e.target.value })}
                />
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(sectionIndex, fieldIndex, { required: e.target.checked })}
                  />
                  Obligatorio
                </label>
                <button
                  type="button"
                  className="link-button danger"
                  onClick={() => removeField(sectionIndex, fieldIndex)}
                  disabled={section.fields.length === 1}
                >
                  Quitar
                </button>
              </div>
            ))}
            <button type="button" className="button secondary" onClick={() => addField(sectionIndex)}>
              + Agregar columna
            </button>
          </div>
        ))}

        <button type="button" className="button secondary" onClick={addSection}>+ Agregar hoja</button>

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="button secondary" onClick={() => navigate('/admin')}>Cancelar</button>
          <button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar plantilla'}</button>
        </div>
      </form>
    </div>
  );
}
