const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const createCache = require('./utils/cache');
const cache = createCache();

const app = express();
app.use(express.json());

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

const trackpageRouter = require('./routes/trackpage');
app.use('/api/v1/trackpage', trackpageRouter);

const workflowRouter = require('./routes/workflow');
app.use('/api/v1/workflow', workflowRouter);

// -------------------------------------------------
// 1) Cria o router do pixel
// -------------------------------------------------
const pixelRoute = express.Router();

pixelRoute.get('/', (req, res) => {
  // Ajuste se o pixel.html estiver em outro local
  res.sendFile(path.join(__dirname, 'public', 'pixel.html'));
});

// -------------------------------------------------
// 2) Usa o router na rota /pixel
// -------------------------------------------------
app.use('/pixel', pixelRoute);

// Importa e cria o router de shortcode
const createShortcodeRouter = require('./routes/shortcode');
const shortcodeRouter = createShortcodeRouter(cache);

// Monta o router no app principal
app.use('/', shortcodeRouter);

const PORT = process.env.PORT || 3000;

cache.loadAllTrackPages().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
});
