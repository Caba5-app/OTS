const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.join(__dirname, 'data.db'));

db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    header_color TEXT NOT NULL DEFAULT '#8B5CF6',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    required INTEGER NOT NULL DEFAULT 0,
    help_text TEXT,
    options TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    submitted_by TEXT NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dependencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dependencia_templates (
    dependencia_id INTEGER NOT NULL REFERENCES dependencias(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    PRIMARY KEY (dependencia_id, template_id)
  );
`);

// Migración: agrega header_color si la tabla templates ya existía de antes
try {
  db.exec("ALTER TABLE templates ADD COLUMN header_color TEXT NOT NULL DEFAULT '#8B5CF6'");
} catch (err) {
  // la columna ya existe
}

// Migración: agrega section_id a fields y rows si ya existían de antes
try {
  db.exec('ALTER TABLE fields ADD COLUMN section_id INTEGER REFERENCES sections(id)');
} catch (err) {
  // la columna ya existe
}
try {
  db.exec('ALTER TABLE rows ADD COLUMN section_id INTEGER REFERENCES sections(id)');
} catch (err) {
  // la columna ya existe
}

// Migración: agrega dependencia_id a rows si ya existía de antes
try {
  db.exec('ALTER TABLE rows ADD COLUMN dependencia_id INTEGER REFERENCES dependencias(id)');
} catch (err) {
  // la columna ya existe
}

// Migración: crea una "Hoja 1" por defecto para plantillas que tenían campos sin sección
{
  const templatesWithoutSections = db
    .prepare(
      `SELECT DISTINCT template_id FROM fields WHERE section_id IS NULL
       UNION
       SELECT DISTINCT template_id FROM rows WHERE section_id IS NULL`
    )
    .all();

  const insertSection = db.prepare('INSERT INTO sections (template_id, name, sort_order) VALUES (?, ?, 0)');
  const updateFields = db.prepare('UPDATE fields SET section_id = ? WHERE template_id = ? AND section_id IS NULL');
  const updateRows = db.prepare('UPDATE rows SET section_id = ? WHERE template_id = ? AND section_id IS NULL');

  for (const { template_id: templateId } of templatesWithoutSections) {
    const info = insertSection.run(templateId, 'Hoja 1');
    const sectionId = info.lastInsertRowid;
    updateFields.run(sectionId, templateId);
    updateRows.run(sectionId, templateId);
  }
}

module.exports = db;
