require('dotenv').config();
const express = require('express');
const cookieSession = require('cookie-session');
const db = require('./db');

const { router: authRouter } = require('./routes/auth');
const templatesRouter = require('./routes/templates');
const rowsRouter = require('./routes/rows');
const dependenciasRouter = require('./routes/dependencias');

const app = express();
const isProduction = Boolean(process.env.VERCEL);

// Vercel está detrás de un proxy HTTPS: hace falta para que la cookie "secure" funcione.
app.set('trust proxy', 1);
app.use(express.json());
// La sesión vive en una cookie firmada (no en memoria), así funciona en Vercel.
app.use(
  cookieSession({
    name: 'ots_session',
    keys: [process.env.SESSION_SECRET || 'dev-secret-change-me'],
    maxAge: 1000 * 60 * 60 * 8,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
  })
);

app.use('/api', async (req, res, next) => {
  try {
    await db.ensureSchema();
    next();
  } catch (err) {
    next(err);
  }
});

app.use('/api', authRouter);
app.use('/api', templatesRouter);
app.use('/api', rowsRouter);
app.use('/api', dependenciasRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});

module.exports = app;
