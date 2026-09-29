const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../db');
const slugify = require('../slugify');
const { requireAdmin } = require('./auth');

const router = express.Router();

const VALID_TYPES = ['text', 'number', 'date', 'select'];
const DEFAULT_COLOR = '#8B5CF6';
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function normalizeColor(color) {
  return HEX_COLOR_RE.test(color || '') ? color : DEFAULT_COLOR;
}

function hexToArgb(hex) {
  return `FF${hex.replace('#', '').toUpperCase()}`;
}

function uniqueSlug(base) {
  let slug = slugify(base);
  let suffix = 2;
  const exists = db.prepare('SELECT id FROM templates WHERE slug = ?');
  while (exists.get(slug)) {
    slug = `${slugify(base)}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

function normalizeFields(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error('Cada hoja necesita al menos una columna');
  }
  return fields.map((f, index) => {
    const name = (f.name || '').trim();
    if (!name) throw new Error('Cada columna necesita un nombre');
    const type = VALID_TYPES.includes(f.type) ? f.type : 'text';
    const options = type === 'select' ? JSON.stringify(f.options || []) : null;
    return {
      name,
      type,
      required: f.required ? 1 : 0,
      help_text: f.help_text || null,
      options,
      sort_order: index,
    };
  });
}

function normalizeSections(sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('La plantilla necesita al menos una hoja');
  }
  return sections.map((s, index) => {
    const name = (s.name || '').trim();
    if (!name) throw new Error('Cada hoja necesita un nombre');
    return {
      name,
      sort_order: index,
      fields: normalizeFields(s.fields),
    };
  });
}

function getSectionsForTemplate(templateId) {
  const sections = db
    .prepare('SELECT id, name, sort_order FROM sections WHERE template_id = ? ORDER BY sort_order')
    .all(templateId);
  const fieldsStmt = db.prepare(
    'SELECT id, name, type, required, help_text, options, sort_order FROM fields WHERE section_id = ? ORDER BY sort_order'
  );
  return sections.map((s) => ({
    ...s,
    fields: fieldsStmt.all(s.id).map((f) => ({
      ...f,
      required: Boolean(f.required),
      options: f.options ? JSON.parse(f.options) : undefined,
    })),
  }));
}

function insertSections(templateId, sections) {
  const insertSection = db.prepare('INSERT INTO sections (template_id, name, sort_order) VALUES (?, ?, ?)');
  const insertField = db.prepare(
    'INSERT INTO fields (template_id, section_id, name, type, required, help_text, options, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const section of sections) {
    const info = insertSection.run(templateId, section.name, section.sort_order);
    const sectionId = info.lastInsertRowid;
    for (const f of section.fields) {
      insertField.run(templateId, sectionId, f.name, f.type, f.required, f.help_text, f.options, f.sort_order);
    }
  }
}

// --- Admin: listar plantillas con conteos ---
router.get('/templates', requireAdmin, (req, res) => {
  const templates = db.prepare('SELECT id, name, slug, description, header_color, created_at FROM templates ORDER BY created_at DESC').all();
  const rowCountStmt = db.prepare('SELECT COUNT(*) as c FROM rows WHERE template_id = ?');
  const sectionCountStmt = db.prepare('SELECT COUNT(*) as c FROM sections WHERE template_id = ?');
  const dependenciasStmt = db.prepare(
    `SELECT dependencias.id, dependencias.name
     FROM dependencias
     JOIN dependencia_templates ON dependencia_templates.dependencia_id = dependencias.id
     WHERE dependencia_templates.template_id = ?
     ORDER BY dependencias.name`
  );
  const pendingStmt = db.prepare('SELECT COUNT(*) as c FROM rows WHERE template_id = ? AND dependencia_id = ?');
  const result = templates.map((t) => ({
    ...t,
    rowCount: rowCountStmt.get(t.id).c,
    sectionCount: sectionCountStmt.get(t.id).c,
    dependencias: dependenciasStmt.all(t.id).map((d) => ({
      ...d,
      pending: pendingStmt.get(t.id, d.id).c === 0,
    })),
  }));
  res.json(result);
});

// --- Admin: obtener una plantilla con sus hojas/campos (para editar) ---
router.get('/templates/:id', requireAdmin, (req, res) => {
  const template = db.prepare('SELECT id, name, slug, description, header_color FROM templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'No encontrada' });
  res.json({ ...template, sections: getSectionsForTemplate(template.id) });
});

// --- Admin: crear plantilla ---
router.post('/templates', requireAdmin, (req, res) => {
  const { name, description, sections, header_color } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

  let normalized;
  try {
    normalized = normalizeSections(sections);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const slug = uniqueSlug(name);
  const insertTemplate = db.prepare('INSERT INTO templates (name, slug, description, header_color) VALUES (?, ?, ?, ?)');
  const info = insertTemplate.run(name.trim(), slug, description || null, normalizeColor(header_color));
  const templateId = info.lastInsertRowid;

  insertSections(templateId, normalized);

  res.status(201).json({ id: templateId, slug });
});

// --- Admin: editar plantilla (nombre + reemplaza hojas/columnas) ---
router.put('/templates/:id', requireAdmin, (req, res) => {
  const template = db.prepare('SELECT id FROM templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'No encontrada' });

  const { name, description, sections, header_color } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

  let normalized;
  try {
    normalized = normalizeSections(sections);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  db.prepare('UPDATE templates SET name = ?, description = ?, header_color = ? WHERE id = ?').run(
    name.trim(),
    description || null,
    normalizeColor(header_color),
    template.id
  );
  db.prepare('DELETE FROM sections WHERE template_id = ?').run(template.id);
  db.prepare('DELETE FROM fields WHERE template_id = ?').run(template.id);

  insertSections(template.id, normalized);

  res.json({ ok: true });
});

// --- Admin: eliminar plantilla ---
router.delete('/templates/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- Admin: exportar a Excel (una hoja de Excel por sección) ---
router.get('/templates/:id/export', requireAdmin, async (req, res) => {
  const template = db.prepare('SELECT id, name, header_color FROM templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'No encontrada' });

  const sections = getSectionsForTemplate(template.id);
  const rowsStmt = db.prepare('SELECT submitted_by, submitted_at, data FROM rows WHERE section_id = ? ORDER BY submitted_at');

  const workbook = new ExcelJS.Workbook();
  const argb = hexToArgb(normalizeColor(template.header_color));
  const usedNames = new Set();

  for (const section of sections) {
    let sheetName = section.name.substring(0, 31) || 'Datos';
    let suffix = 2;
    while (usedNames.has(sheetName.toLowerCase())) {
      const base = section.name.substring(0, 28) || 'Datos';
      sheetName = `${base}-${suffix}`;
      suffix += 1;
    }
    usedNames.add(sheetName.toLowerCase());

    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = [
      ...section.fields.map((f) => ({ header: f.name, key: f.name, width: 20 })),
      { header: 'Cargado por', key: '__submitted_by', width: 22 },
      { header: 'Fecha de carga', key: '__submitted_at', width: 20 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    });

    for (const row of rowsStmt.all(section.id)) {
      const data = JSON.parse(row.data);
      sheet.addRow({ ...data, __submitted_by: row.submitted_by, __submitted_at: row.submitted_at });
    }
  }

  const filename = `${slugify(template.name)}-consolidado.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;
module.exports.getSectionsForTemplate = getSectionsForTemplate;
