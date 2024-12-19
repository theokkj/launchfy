const express = require("express");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const createCache = require("./utils/cache");
const cache = createCache(supabaseUrl, supabaseAnonKey);

const app = express();
app.use(express.json());

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, "public")));

const trackRouter = require("./routes/track");
app.use("/api/v1/track", trackRouter);

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
