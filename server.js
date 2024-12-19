const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');

// Inicializa o supabase (caso já esteja usando)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const app = express();
app.use(express.json());

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Importa o router de tracking
const trackRouter = require('./routes/track');

// Monta a rota /api/v1/track usando o router importado
app.use('/api/v1/track', trackRouter);

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

// Rota para servir a página de redirecionamento
app.get('/:shortcode', async (req, res) => {
  const { shortcode } = req.params;

  const { data, error } = await supabase
    .from('trackpages')
    .select('redirectTo')
    .eq('slug', shortcode)
    .single();

  if (error || !data) {
    return res.status(404).send('Shortcode não encontrado');
  }

  const finalUrl = data.redirectTo;

  res.set('Content-Type', 'text/html; charset=UTF-8');
  res.send(generateRedirectHTML(finalUrl, shortcode));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
