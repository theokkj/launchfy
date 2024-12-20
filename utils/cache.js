const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

module.exports = function createCache() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const trackPagesCache = {};

  async function loadAllTrackPages() {
    const { data, error } = await supabase
      .from("trackpages")
      .select('slug, "redirectTo"');

    if (error) {
      console.error("Erro ao carregar trackpages:", error);
      return;
    }

    if (data && data.length > 0) {
      data.forEach((item) => {
        trackPagesCache[item.slug] = item.redirectTo;
      });
      console.log(`[CACHE IMPORTED]`);
    } else {
      console.log("Nenhuma trackpage encontrada no banco.");
    }
  }

  function getFromCache(shortcode) {
    return trackPagesCache[shortcode] || null;
  }

  async function addShortcodeToCache(shortcode) {
    // Consulta ao Supabase se não estiver no cache
    const { data, error } = await supabase
      .from("trackpages")
      .select('"redirectTo"')
      .eq("slug", shortcode)
      .single();

    if (error || !data) {
      return null;
    }

    trackPagesCache[shortcode] = data.redirectTo;
    return data.redirectTo;
  }

  return {
    loadAllTrackPages,
    getFromCache,
    addShortcodeToCache,
  };
};
