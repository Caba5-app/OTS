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

async function uniqueSlug(base) {
  let slug = slugify(base);
  let suffix = 2;
  while (await db.get('SELECT id FROM templates WHERE slug = $1', [slug])) {
    slug = `${slugify(base)}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

function normalizeFields(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error('Cada hoja necesita al menos una columna');
  }
  const names = new Set();
  return fields.map((f, index) => {
    const name = (f.name || '').trim();
    if (!name) throw new Error('Cada columna necesita un nombre');
    if (names.has(name.toLowerCase())) throw new Error(`La columna "${name}" está repetida en la misma hoja`);
    names.add(name.toLowerCase());
    const type = VALID_TYPES.includes(f.type) ? f.type : 'text';
    const options = type === 'select' ? JSON.stringify(f.options || []) : null;
    return {
      name,
      type,
      required: Boolean(f.required),
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
      id: Number.isInteger(s.id) ? s.id : null,
      name,
      sort_order: index,
      fields: normalizeFields(s.fields),
    };
  });
}

async function getSectionsForTemplate(templateId) {
  const sections = await db.all(
    'SELECT id, name, sort_order FROM sections WHERE template_id = $1 ORDER BY sort_order, id',
    [templateId]
  );
  const fields = await db.all(
    'SELECT id, section_id, name, type, required, help_text, options, sort_order FROM fields WHERE template_id = $1 ORDER BY sort_order, id',
    [templateId]
  );
  return sections.map((s) => ({
    ...s,
    fields: fields
      .filter((f) => f.section_id === s.id)
      .map(({ section_id, ...f }) => ({
        ...f,
        options: f.options ? JSON.parse(f.options) : undefined,
      })),
  }));
}

async function insertFields(tx, templateId, sectionId, fields) {
  for (const f of fields) {
    await tx.run(
      'INSERT INTO fields (template_id, section_id, name, type, required, help_text, options, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [templateId, sectionId, f.name, f.type, f.required, f.help_text, f.options, f.sort_order]
    );
  }
}

async function insertSection(tx, templateId, section) {
  const created = await tx.get(
    'INSERT INTO sections (template_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id',
    [templateId, section.name, section.sort_order]
  );
  await insertFields(tx, templateId, created.id, section.fields);
}

// --- Admin: listar plantillas con conteos ---
router.get('/templates', requireAdmin, async (req, res) => {
  const templates = await db.all(
    `SELECT t.id, t.name, t.slug, t.description, t.header_color, t.created_at,
            (SELECT COUNT(*)::int FROM rows r WHERE r.template_id = t.id) AS "rowCount",
            (SELECT COUNT(*)::int FROM sections s WHERE s.template_id = t.id) AS "sectionCount"
     FROM templates t
     ORDER BY t.created_at DESC, t.id DESC`
  );
  const assigned = await db.all(
    `SELECT dt.template_id, d.id, d.name,
            NOT EXISTS (
              SELECT 1 FROM rows r WHERE r.template_id = dt.template_id AND r.dependencia_id = d.id
            ) AS pending
     FROM dependencia_templates dt
     JOIN dependencias d ON d.id = dt.dependencia_id
     ORDER BY d.name`
  );
  res.json(
    templates.map((t) => ({
      ...t,
      dependencias: assigned
        .filter((a) => a.template_id === t.id)
        .map(({ id, name, pending }) => ({ id, name, pending })),
    }))
  );
});

// --- Admin: obtener una plantilla con sus hojas/campos (para editar) ---
router.get('/templates/:id', requireAdmin, async (req, res) => {
  const template = await db.get('SELECT id, name, slug, description, header_color FROM templates WHERE id = $1', [
    req.params.id,
  ]);
  if (!template) return res.status(404).json({ error: 'No encontrada' });
  res.json({ ...template, sections: await getSectionsForTemplate(template.id) });
});

// --- Admin: crear plantilla ---
router.post('/templates', requireAdmin, async (req, res) => {
  const { name, description, sections, header_color } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

  let normalized;
  try {
    normalized = normalizeSections(sections);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const slug = await uniqueSlug(name);
  const templateId = await db.transaction(async (tx) => {
    const created = await tx.get(
      'INSERT INTO templates (name, slug, description, header_color) VALUES ($1, $2, $3, $4) RETURNING id',
      [name.trim(), slug, description || null, normalizeColor(header_color)]
    );
    for (const section of normalized) {
      await insertSection(tx, created.id, section);
    }
    return created.id;
  });

  res.status(201).json({ id: templateId, slug });
});

// --- Admin: editar plantilla ---
// Las hojas que ya existían se actualizan en su lugar (así no se pierden las filas cargadas);
// solo se borran, con sus datos, las hojas que el admin quitó.
router.put('/templates/:id', requireAdmin, async (req, res) => {
  const template = await db.get('SELECT id FROM templates WHERE id = $1', [req.params.id]);
  if (!template) return res.status(404).json({ error: 'No encontrada' });

  const { name, description, sections, header_color } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

  let normalized;
  try {
    normalized = normalizeSections(sections);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  await db.transaction(async (tx) => {
    await tx.run('UPDATE templates SET name = $1, description = $2, header_color = $3 WHERE id = $4', [
      name.trim(),
      description || null,
      normalizeColor(header_color),
      template.id,
    ]);

    const existingIds = (await tx.all('SELECT id FROM sections WHERE template_id = $1', [template.id])).map(
      (s) => s.id
    );
    const keptIds = normalized.filter((s) => s.id && existingIds.includes(s.id)).map((s) => s.id);
    const removedIds = existingIds.filter((id) => !keptIds.includes(id));
    if (removedIds.length > 0) {
      await tx.run('DELETE FROM sections WHERE id = ANY($1::int[])', [removedIds]);
    }

    for (const section of normalized) {
      if (section.id && keptIds.includes(section.id)) {
        await tx.run('UPDATE sections SET name = $1, sort_order = $2 WHERE id = $3', [
          section.name,
          section.sort_order,
          section.id,
        ]);
        await tx.run('DELETE FROM fields WHERE section_id = $1', [section.id]);
        await insertFields(tx, template.id, section.id, section.fields);
      } else {
        await insertSection(tx, template.id, section);
      }
    }
  });

  res.json({ ok: true });
});

// --- Admin: eliminar plantilla ---
router.delete('/templates/:id', requireAdmin, async (req, res) => {
  await db.run('DELETE FROM templates WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Admin: exportar a Excel (una hoja de Excel por sección) ---
router.get('/templates/:id/export', requireAdmin, async (req, res) => {
  const template = await db.get('SELECT id, name, header_color FROM templates WHERE id = $1', [req.params.id]);
  if (!template) return res.status(404).json({ error: 'No encontrada' });

  const sections = await getSectionsForTemplate(template.id);
  const allRows = await db.all(
    'SELECT section_id, submitted_by, submitted_at, data FROM rows WHERE template_id = $1 ORDER BY submitted_at, id',
    [template.id]
  );

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

    for (const row of allRows.filter((r) => r.section_id === section.id)) {
      const data = JSON.parse(row.data);
      sheet.addRow({ ...data, __submitted_by: row.submitted_by, __submitted_at: row.submitted_at });
    }
  }

  const filename = `${slugify(template.name)}-consolidado.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
});

module.exports = router;
module.exports.getSectionsForTemplate = getSectionsForTemplate;
