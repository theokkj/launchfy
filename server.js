const express = require("express");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const app = express();
app.use(express.json());

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, "public")));

const trackRouter = require("./routes/track");
app.use("/api/v1/track", trackRouter);

// Função para gerar o HTML de redirecionamento sem inline script
function generateRedirectHTML(finalUrl, shortcode) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Redirecionando...</title>
</head>
<body>
<div id="redirect-info"
  data-final-url="${finalUrl}"
  data-shortcode="${shortcode}">
</div>
<p>Redirecionando...</p>
<script src="/redirect.js" defer></script>
</body>
</html>`;
}

// Objeto em memória para cache
const trackPagesCache = {};

// Função para carregar todas as trackpages ao iniciar
async function loadAllTrackPages() {
  const { data, error } = await supabase
    .from("trackpages")
    .select("slug, redirectTo");

  if (error) {
    console.error("Erro ao carregar trackpages:", error);
    return;
  }

  if (data && data.length > 0) {
    data.forEach((item) => {
      trackPagesCache[item.slug] = item.redirectTo;
    });
    console.log(`Cache inicializado com ${data.length} trackpages.`);
  } else {
    console.log("Nenhuma trackpage encontrada no banco.");
  }
}

// Importa e cria o router de shortcode
const createShortcodeRouter = require("./routes/shortcode");
const shortcodeRouter = createShortcodeRouter(
  supabase,
  trackPagesCache,
  generateRedirectHTML
);
// Monta o router no app principal
app.use("/", shortcodeRouter);

const PORT = process.env.PORT || 3000;
loadAllTrackPages().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
});
