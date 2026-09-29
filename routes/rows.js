const express = require('express');
const db = require('../db');
const { requireAdmin } = require('./auth');

const router = express.Router();

// --- Admin: ver filas cargadas de una plantilla (todas las hojas, con su nombre de hoja) ---
router.get('/templates/:id/rows', requireAdmin, (req, res) => {
  const template = db.prepare('SELECT id FROM templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'No encontrada' });

  const rows = db
    .prepare(
      `SELECT rows.id, rows.section_id, sections.name AS section_name, rows.submitted_by, rows.submitted_at, rows.data
       FROM rows
       JOIN sections ON sections.id = rows.section_id
       WHERE rows.template_id = ?
       ORDER BY rows.submitted_at DESC`
    )
    .all(template.id);

  res.json(
    rows.map((r) => ({
      id: r.id,
      sectionId: r.section_id,
      sectionName: r.section_name,
      submittedBy: r.submitted_by,
      submittedAt: r.submitted_at,
      data: JSON.parse(r.data),
    }))
  );
});

// --- Admin: eliminar una fila cargada ---
router.delete('/rows/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM rows WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
