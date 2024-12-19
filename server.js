const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json())

// Servir arquivos estáticos da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

// Dicionário em memória com shortcodes e URLs finais (exemplo)
const shortLinks = {
  'abc123': 'https://exemplo.com',
  'teste': 'https://www.google.com'
};

// Página HTML de redirecionamento sem inline script
// Usamos um elemento <div id="redirect-info"> com data attributes.
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

// Rota que serve a página de redirecionamento
app.get('/:shortcode', (req, res) => {
  const { shortcode } = req.params;
  const finalUrl = shortLinks[shortcode];
  if (!finalUrl) {
    return res.status(404).send('Shortcode não encontrado');
  }

  res.set('Content-Type', 'text/html; charset=UTF-8');
  res.send(generateRedirectHTML(finalUrl, shortcode));
});

// Rota de tracking
app.post('/api/v1/track', (req, res) => {
  const { lead_id, shortcode, timestamp, user_agent } = req.body;
  console.log(`[TRACK] lead_id=${lead_id} shortcode=${shortcode} time=${new Date(timestamp).toISOString()} ua=${user_agent}`);
  res.status(200).json({ status: 'ok' });
});

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});