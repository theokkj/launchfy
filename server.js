const express = require("express");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const createCache = require("./utils/cache");
const cache = createCache();

const app = express();
app.use(express.json());

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, "public")));

const trackpageRouter = require("./routes/trackpage");
app.use("/api/v1/trackpage", trackpageRouter);

const workflowRouter = require("./routes/workflow");
app.use("/api/v1/workflow", workflowRouter);

// Importa e cria o router de shortcode
const createShortcodeRouter = require("./routes/shortcode");
const shortcodeRouter = createShortcodeRouter(cache);
// Monta o router no app principal
app.use("/", shortcodeRouter);

const PORT = process.env.PORT || 3000;

cache.loadAllTrackPages().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
});
