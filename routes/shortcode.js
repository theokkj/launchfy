const express = require("express");

module.exports = function createShortcodeRouter(cache) {
  const router = express.Router();

  router.get("/:shortcode", async (req, res) => {
    const { shortcode } = req.params;

    // Primeiro verifica o cache
    let finalUrl = cache.getFromCache(shortcode);
    if (!finalUrl) {
      // Caso não esteja no cache, tentamos adicionar
      finalUrl = await cache.addShortcodeToCache(shortcode);
      if (!finalUrl) {
        return res.status(404).send("Shortcode não encontrado");
      }
    }

    res.set("Content-Type", "text/html; charset=UTF-8");
    return res.send(generateRedirectHTML(finalUrl, shortcode));
  });

  return router;
};

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
