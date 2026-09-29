// Copia todo lo que hay en data.db (la base SQLite vieja) a Supabase, conservando los ids.
// Uso: npm run migrar   (con DATABASE_URL configurada en .env)
// Solo corre si las tablas de Supabase están vacías, para no duplicar nada.
require('dotenv').config();
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const db = require('../db');

const sqlite = new DatabaseSync(path.join(__dirname, '..', 'data.db'), { readOnly: true });

// Orden según dependencias entre tablas; [columnas, columnas booleanas]
const TABLES = [
  ['templates', ['id', 'name', 'slug', 'description', 'header_color', 'created_at']],
  ['sections', ['id', 'template_id', 'name', 'sort_order']],
  ['fields', ['id', 'template_id', 'section_id', 'name', 'type', 'required', 'help_text', 'options', 'sort_order'], ['required']],
  ['dependencias', ['id', 'name', 'password_hash', 'password_salt', 'created_at']],
  ['rows', ['id', 'template_id', 'section_id', 'dependencia_id', 'submitted_by', 'submitted_at', 'data']],
  ['dependencia_templates', ['dependencia_id', 'template_id']],
];

async function main() {
  await db.ensureSchema();

  for (const [table] of TABLES) {
    const { c } = await db.get(`SELECT COUNT(*)::int AS c FROM ${table}`);
    if (c > 0) throw new Error(`La tabla "${table}" en Supabase ya tiene datos; no se migra nada.`);
  }

  await db.transaction(async (tx) => {
    for (const [table, columns, booleans = []] of TABLES) {
      const records = sqlite.prepare(`SELECT ${columns.join(', ')} FROM ${table}`).all();
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      for (const record of records) {
        const values = columns.map((col) => (booleans.includes(col) ? Boolean(record[col]) : record[col]));
        await tx.run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values);
      }
      if (columns.includes('id')) {
        await tx.run(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`);
      }
      console.log(`${table}: ${records.length}`);
    }
  });
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
