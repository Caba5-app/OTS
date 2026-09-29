const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL (cadena de conexión de Supabase) en las variables de entorno');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase exige SSL; una base local de prueba no.
  ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false },
  // En Vercel cada función abre pocas conexiones; el pooler de Supabase se encarga del resto.
  max: 3,
});

// Fecha/hora de Buenos Aires como texto, igual que se mostraba antes en la app y el Excel.
const NOW_AR = "to_char(now() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD HH24:MI:SS')";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    header_color TEXT NOT NULL DEFAULT '#8B5CF6',
    created_at TEXT NOT NULL DEFAULT ${NOW_AR}
  );

  CREATE TABLE IF NOT EXISTS sections (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS fields (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    required BOOLEAN NOT NULL DEFAULT FALSE,
    help_text TEXT,
    options TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS dependencias (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW_AR}
  );

  CREATE TABLE IF NOT EXISTS rows (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    dependencia_id INTEGER REFERENCES dependencias(id) ON DELETE SET NULL,
    submitted_by TEXT NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT ${NOW_AR},
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dependencia_templates (
    dependencia_id INTEGER NOT NULL REFERENCES dependencias(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    PRIMARY KEY (dependencia_id, template_id)
  );

  CREATE INDEX IF NOT EXISTS rows_template_idx ON rows (template_id);
  CREATE INDEX IF NOT EXISTS rows_section_idx ON rows (section_id);
`;

// Se crea el esquema una sola vez por arranque (en Vercel, una vez por instancia).
let ready;
function ensureSchema() {
  if (!ready) {
    ready = pool.query(SCHEMA).catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

// Helpers: `q` sirve tanto para el pool como para un cliente dentro de una transacción.
function wrap(q) {
  return {
    all: async (sql, params = []) => (await q.query(sql, params)).rows,
    get: async (sql, params = []) => (await q.query(sql, params)).rows[0],
    run: (sql, params = []) => q.query(sql, params),
  };
}

const db = wrap(pool);

// Ejecuta fn(tx) dentro de una transacción; si algo falla, se deshace todo.
db.transaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(wrap(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

db.ensureSchema = ensureSchema;
db.pool = pool;

module.exports = db;
