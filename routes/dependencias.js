const express = require('express');
const db = require('../db');
const { requireAdmin, requireDependencia } = require('./auth');
const { hashPassword, verifyPassword } = require('../hash');
const { getSectionsForTemplate } = require('./templates');

const router = express.Router();

async function isAssigned(dependenciaId, templateId) {
  return Boolean(
    await db.get('SELECT 1 FROM dependencia_templates WHERE dependencia_id = $1 AND template_id = $2', [
      dependenciaId,
      templateId,
    ])
  );
}

// ================= Admin =================

router.get('/dependencias', requireAdmin, async (req, res) => {
  const dependencias = await db.all('SELECT id, name, created_at FROM dependencias ORDER BY created_at DESC, id DESC');
  const assignments = await db.all('SELECT dependencia_id, template_id FROM dependencia_templates');
  res.json(
    dependencias.map((d) => ({
      ...d,
      templateIds: assignments.filter((a) => a.dependencia_id === d.id).map((a) => a.template_id),
    }))
  );
});

router.post('/dependencias', requireAdmin, async (req, res) => {
  const { name, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (!password || !password.trim()) return res.status(400).json({ error: 'La contraseña es obligatoria' });

  const { hash, salt } = hashPassword(password);
  const created = await db.get(
    'INSERT INTO dependencias (name, password_hash, password_salt) VALUES ($1, $2, $3) RETURNING id',
    [name.trim(), hash, salt]
  );

  res.status(201).json({ id: created.id });
});

router.put('/dependencias/:id', requireAdmin, async (req, res) => {
  const dependencia = await db.get('SELECT id FROM dependencias WHERE id = $1', [req.params.id]);
  if (!dependencia) return res.status(404).json({ error: 'No encontrada' });

  const { name, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

  if (password && password.trim()) {
    const { hash, salt } = hashPassword(password);
    await db.run('UPDATE dependencias SET name = $1, password_hash = $2, password_salt = $3 WHERE id = $4', [
      name.trim(),
      hash,
      salt,
      dependencia.id,
    ]);
  } else {
    await db.run('UPDATE dependencias SET name = $1 WHERE id = $2', [name.trim(), dependencia.id]);
  }

  res.json({ ok: true });
});

router.delete('/dependencias/:id', requireAdmin, async (req, res) => {
  await db.run('DELETE FROM dependencias WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

router.put('/dependencias/:id/templates', requireAdmin, async (req, res) => {
  const dependencia = await db.get('SELECT id FROM dependencias WHERE id = $1', [req.params.id]);
  if (!dependencia) return res.status(404).json({ error: 'No encontrada' });

  const { templateIds } = req.body || {};
  if (!Array.isArray(templateIds)) return res.status(400).json({ error: 'templateIds debe ser una lista' });

  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM dependencia_templates WHERE dependencia_id = $1', [dependencia.id]);
    for (const templateId of templateIds) {
      await tx.run('INSERT INTO dependencia_templates (dependencia_id, template_id) VALUES ($1, $2)', [
        dependencia.id,
        templateId,
      ]);
    }
  });

  res.json({ ok: true });
});

// ================= Dependencia (login por contraseña, sin usuario) =================

router.post('/dependencia/login', async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(401).json({ error: 'Contraseña incorrecta' });

  const dependencias = await db.all('SELECT id, name, password_hash, password_salt FROM dependencias');
  const match = dependencias.find((d) => verifyPassword(password, d.password_hash, d.password_salt));

  if (!match) return res.status(401).json({ error: 'Contraseña incorrecta' });

  req.session.dependenciaId = match.id;
  res.json({ ok: true });
});

router.get('/dependencia/session', async (req, res) => {
  if (!req.session || !req.session.dependenciaId) return res.json({ loggedIn: false });
  const dependencia = await db.get('SELECT id, name FROM dependencias WHERE id = $1', [req.session.dependenciaId]);
  if (!dependencia) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, name: dependencia.name });
});

router.post('/dependencia/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get('/dependencia/templates', requireDependencia, async (req, res) => {
  const dependenciaId = req.session.dependenciaId;
  const templates = await db.all(
    `SELECT templates.id, templates.name, templates.slug,
            NOT EXISTS (
              SELECT 1 FROM rows WHERE rows.template_id = templates.id AND rows.dependencia_id = $1
            ) AS pending
     FROM templates
     JOIN dependencia_templates ON dependencia_templates.template_id = templates.id
     WHERE dependencia_templates.dependencia_id = $1
     ORDER BY templates.name`,
    [dependenciaId]
  );
  res.json(templates);
});

router.get('/dependencia/templates/:slug', requireDependencia, async (req, res) => {
  const dependenciaId = req.session.dependenciaId;
  const template = await db.get('SELECT id, name, slug, description FROM templates WHERE slug = $1', [
    req.params.slug,
  ]);
  if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });

  if (!(await isAssigned(dependenciaId, template.id))) {
    return res.status(403).json({ error: 'Esta OT no está asignada a tu dependencia' });
  }

  res.json({ ...template, sections: await getSectionsForTemplate(template.id) });
});

router.post('/dependencia/templates/:slug/rows', requireDependencia, async (req, res) => {
  const dependenciaId = req.session.dependenciaId;
  const dependencia = await db.get('SELECT id, name FROM dependencias WHERE id = $1', [dependenciaId]);
  if (!dependencia) return res.status(401).json({ error: 'No autenticado' });
  const template = await db.get('SELECT id FROM templates WHERE slug = $1', [req.params.slug]);
  if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });

  if (!(await isAssigned(dependenciaId, template.id))) {
    return res.status(403).json({ error: 'Esta OT no está asignada a tu dependencia' });
  }

  const { sectionId, rows } = req.body || {};
  const section = await db.get('SELECT id FROM sections WHERE id = $1 AND template_id = $2', [
    sectionId,
    template.id,
  ]);
  if (!section) return res.status(400).json({ error: 'Hoja no encontrada' });

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No hay filas para guardar' });
  }

  const fields = await db.all('SELECT name, required FROM fields WHERE section_id = $1', [section.id]);
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

  await db.transaction(async (tx) => {
    for (const rowData of rows) {
      await tx.run(
        'INSERT INTO rows (template_id, section_id, submitted_by, dependencia_id, data) VALUES ($1, $2, $3, $4, $5)',
        [template.id, section.id, dependencia.name, dependenciaId, JSON.stringify(rowData)]
      );
    }
  });

  res.status(201).json({ ok: true, count: rows.length });
});

module.exports = router;
