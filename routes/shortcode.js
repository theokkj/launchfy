const express = require("express");

module.exports = function createShortcodeRouter(
  supabase,
  trackPagesCache,
  generateRedirectHTML
) {
  const router = express.Router();

  router.get("/:shortcode", async (req, res) => {
    const { shortcode } = req.params;

    // Primeiro verifica o cache
    if (trackPagesCache[shortcode]) {
      const finalUrl = trackPagesCache[shortcode];
      res.set("Content-Type", "text/html; charset=UTF-8");
      return res.send(generateRedirectHTML(finalUrl, shortcode));
    }

    // Caso não esteja no cache, faz uma consulta ao Supabase
    const { data, error } = await supabase
      .from("trackpages")
      .select("redirectTo")
      .eq("slug", shortcode)
      .single();

    if (error || !data) {
      return res.status(404).send("Shortcode não encontrado");
    }

    const finalUrl = data.redirectTo;

    // Adiciona ao cache
    trackPagesCache[shortcode] = finalUrl;

    res.set("Content-Type", "text/html; charset=UTF-8");
    return res.send(generateRedirectHTML(finalUrl, shortcode));
  });

  return router;
};
