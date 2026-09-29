// Servidor para correr la app en la PC (en Vercel se usa api/index.js).
const path = require('path');
const express = require('express');
const app = require('./app');

const PORT = process.env.PORT || 3000;

const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, 'localhost', () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
