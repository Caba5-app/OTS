const express = require('express');
const db = require('../db');
const { requireAdmin, requireDependencia } = require('./auth');
const { hashPassword, verifyPassword } = require('../hash');
const { getSectionsForTemplate } = require('./templates');

const router = express.Router();

function getAssignedTemplateIds(dependenciaId) {
  return db
    .prepare('SELECT template_id FROM dependencia_templates WHERE dependencia_id = ?')
    .all(dependenciaId)
    .map((r) => r.template_id);
}

// ================= Admin =================

router.get('/dependencias', requireAdmin, (req, res) => {
  const dependencias = db.prepare('SELECT id, name, created_at FROM dependencias ORDER BY created_at DESC').all();
  res.json(
    dependencias.map((d) => ({
      ...d,
      templateIds: getAssignedTemplateIds(d.id),
    }))
  );
});

router.post('/dependencias', requireAdmin, (req, res) => {
  const { name, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (!password || !password.trim()) return res.status(400).json({ error: 'La contraseña es obligatoria' });

  const { hash, salt } = hashPassword(password);
  const info = db
    .prepare('INSERT INTO dependencias (name, password_hash, password_salt) VALUES (?, ?, ?)')
    .run(name.trim(), hash, salt);

  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/dependencias/:id', requireAdmin, (req, res) => {
  const dependencia = db.prepare('SELECT id FROM dependencias WHERE id = ?').get(req.params.id);
  if (!dependencia) return res.status(404).json({ error: 'No encontrada' });

  const { name, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

  if (password && password.trim()) {
    const { hash, salt } = hashPassword(password);
    db.prepare('UPDATE dependencias SET name = ?, password_hash = ?, password_salt = ? WHERE id = ?').run(
      name.trim(),
      hash,
      salt,
      dependencia.id
    );
  } else {
    db.prepare('UPDATE dependencias SET name = ? WHERE id = ?').run(name.trim(), dependencia.id);
  }

  res.json({ ok: true });
});

router.delete('/dependencias/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM dependencias WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/dependencias/:id/templates', requireAdmin, (req, res) => {
  const dependencia = db.prepare('SELECT id FROM dependencias WHERE id = ?').get(req.params.id);
  if (!dependencia) return res.status(404).json({ error: 'No encontrada' });

  const { templateIds } = req.body || {};
  if (!Array.isArray(templateIds)) return res.status(400).json({ error: 'templateIds debe ser una lista' });

  db.prepare('DELETE FROM dependencia_templates WHERE dependencia_id = ?').run(dependencia.id);
  const insert = db.prepare('INSERT INTO dependencia_templates (dependencia_id, template_id) VALUES (?, ?)');
  for (const templateId of templateIds) {
    insert.run(dependencia.id, templateId);
  }

  res.json({ ok: true });
});

// ================= Dependencia (login por contraseña, sin usuario) =================

router.post('/dependencia/login', (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(401).json({ error: 'Contraseña incorrecta' });

  const dependencias = db.prepare('SELECT id, name, password_hash, password_salt FROM dependencias').all();
  const match = dependencias.find((d) => verifyPassword(password, d.password_hash, d.password_salt));

  if (!match) return res.status(401).json({ error: 'Contraseña incorrecta' });

  req.session.dependenciaId = match.id;
  res.json({ ok: true });
});

router.get('/dependencia/session', (req, res) => {
  if (!req.session || !req.session.dependenciaId) return res.json({ loggedIn: false });
  const dependencia = db.prepare('SELECT id, name FROM dependencias WHERE id = ?').get(req.session.dependenciaId);
  if (!dependencia) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, name: dependencia.name });
});

router.post('/dependencia/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/dependencia/templates', requireDependencia, (req, res) => {
  const dependenciaId = req.session.dependenciaId;
  const templates = db
    .prepare(
      `SELECT templates.id, templates.name, templates.slug
       FROM templates
       JOIN dependencia_templates ON dependencia_templates.template_id = templates.id
       WHERE dependencia_templates.dependencia_id = ?
       ORDER BY templates.name`
    )
    .all(dependenciaId);

  const pendingStmt = db.prepare('SELECT COUNT(*) as c FROM rows WHERE template_id = ? AND dependencia_id = ?');
  res.json(
    templates.map((t) => ({
      ...t,
      pending: pendingStmt.get(t.id, dependenciaId).c === 0,
    }))
  );
});

router.get('/dependencia/templates/:slug', requireDependencia, (req, res) => {
  const dependenciaId = req.session.dependenciaId;
  const template = db.prepare('SELECT id, name, slug, description FROM templates WHERE slug = ?').get(req.params.slug);
  if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });

  const assigned = db
    .prepare('SELECT 1 FROM dependencia_templates WHERE dependencia_id = ? AND template_id = ?')
    .get(dependenciaId, template.id);
  if (!assigned) return res.status(403).json({ error: 'Esta OT no está asignada a tu dependencia' });

  res.json({ ...template, sections: getSectionsForTemplate(template.id) });
});

router.post('/dependencia/templates/:slug/rows', requireDependencia, (req, res) => {
  const dependenciaId = req.session.dependenciaId;
  const dependencia = db.prepare('SELECT id, name FROM dependencias WHERE id = ?').get(dependenciaId);
  const template = db.prepare('SELECT id FROM templates WHERE slug = ?').get(req.params.slug);
  if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });

  const assigned = db
    .prepare('SELECT 1 FROM dependencia_templates WHERE dependencia_id = ? AND template_id = ?')
    .get(dependenciaId, template.id);
  if (!assigned) return res.status(403).json({ error: 'Esta OT no está asignada a tu dependencia' });

  const { sectionId, rows } = req.body || {};
  const section = db.prepare('SELECT id FROM sections WHERE id = ? AND template_id = ?').get(sectionId, template.id);
  if (!section) return res.status(400).json({ error: 'Hoja no encontrada' });

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No hay filas para guardar' });
  }

  const fields = db.prepare('SELECT name, required FROM fields WHERE section_id = ?').all(section.id);
  for (const rowData of rows) {
    for (const field of fields) {
      if (field.required) {
        const value = rowData[field.name];
        if (value === undefined || value === null || String(value).trim() === '') {
          return res.status(400).json({ error: `Falta completar "${field.name}" en una de las filas` });
        }
      }
    }
  }

  const insert = db.prepare(
    'INSERT INTO rows (template_id, section_id, submitted_by, dependencia_id, data) VALUES (?, ?, ?, ?, ?)'
  );
  for (const rowData of rows) {
    insert.run(template.id, section.id, dependencia.name, dependenciaId, JSON.stringify(rowData));
  }

  res.status(201).json({ ok: true, count: rows.length });
});

module.exports = router;
