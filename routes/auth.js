const express = require('express');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: 'No autenticado' });
}

function requireDependencia(req, res, next) {
  if (req.session && req.session.dependenciaId) {
    return next();
  }
  return res.status(401).json({ error: 'No autenticado' });
}

router.get('/session', (req, res) => {
  res.json({ isAdmin: Boolean(req.session && req.session.isAdmin) });
});

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (password && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Contraseña incorrecta' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

module.exports = { router, requireAdmin, requireDependencia };
