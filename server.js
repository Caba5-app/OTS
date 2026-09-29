require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');

const { router: authRouter } = require('./routes/auth');
const templatesRouter = require('./routes/templates');
const rowsRouter = require('./routes/rows');
const dependenciasRouter = require('./routes/dependencias');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 },
  })
);

app.use('/api', authRouter);
app.use('/api', templatesRouter);
app.use('/api', rowsRouter);
app.use('/api', dependenciasRouter);

const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, 'localhost', () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
