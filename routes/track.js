const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");
// Se necessário:
// const fetch = require('node-fetch'); // caso esteja usando Node 16 ou inferior.
// No Node 18+ já existe fetch nativo.

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

router.post("/", (req, res) => {
  const { lead_id, shortcode, timestamp, user_agent } = req.body;
  const browserId = lead_id; // O lead_id vindo do front é o browserId (UUID)

  // Obtém o IP do usuário a partir do cabeçalho
  const userIpRaw = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  // userIpRaw pode conter algo como '10.0.0.1, 138.121.198.195', pegue o primeiro IP real
  const userIp = userIpRaw.split(",")[0].trim();

  // Responde imediatamente
  res.status(200).json({ status: "ok" });

  (async () => {
    try {
      // Verifica se o browser já existe
      const { data: existingBrowser, error: browserSelectError } =
        await supabase
          .from("browsers")
          .select("id, lead_id")
          .eq("browserId", browserId)
          .maybeSingle();

      if (browserSelectError) {
        console.error("Erro ao consultar browserId:", browserSelectError);
        return;
      }

      let currentBrowserId;
      let currentLeadId;

      if (!existingBrowser) {
        // Cria um novo lead
        const { data: newLead, error: leadError } = await supabase
          .from("leads")
          .insert([{ profile: {} }])
          .select("id")
          .single();

        if (leadError) {
          console.error("Erro ao criar lead:", leadError);
          return;
        }

        currentLeadId = newLead.id;

        // Cria o novo browser
        const { data: insertedBrowser, error: insertBrowserError } =
          await supabase
            .from("browsers")
            .insert([
              {
                browserId: browserId,
                user_agent: user_agent,
                created_at: new Date().toISOString(),
                lead_id: currentLeadId,
              },
            ])
            .select("id, lead_id")
            .single();

        if (insertBrowserError) {
          console.error("Erro ao inserir browser:", insertBrowserError);
          return;
        }

        currentBrowserId = insertedBrowser.id;
        currentLeadId = insertedBrowser.lead_id;

        console.log("Novo lead criado com id:", currentLeadId);
        console.log("Novo browser registrado:", insertedBrowser);
      } else {
        currentBrowserId = existingBrowser.id;
        currentLeadId = existingBrowser.lead_id;
        console.log(
          "Browser já existente com browserId:",
          browserId,
          "e lead_id:",
          currentLeadId
        );
      }

      // Obter trackpage_id a partir do shortcode
      const { data: trackpageData, error: trackpageError } = await supabase
        .from("trackpages")
        .select("id")
        .eq("slug", shortcode)
        .single();

      if (trackpageError || !trackpageData) {
        console.error(
          "Trackpage não encontrada para o shortcode:",
          shortcode,
          trackpageError
        );
        return;
      }

      const trackpageId = trackpageData.id;

      // Chama a API do geojs.io para obter dados de geolocalização
      const geoResponse = await fetch(
        `https://get.geojs.io/v1/ip/geo/${userIp}.json`
      );
      let geoData = {};
      if (geoResponse.ok) {
        geoData = await geoResponse.json();
      }

      const eventData = {
        browser_id: currentBrowserId,
        trackpage_id: trackpageId,
        country: geoData.country || null,
        city: geoData.city || null,
        timezone: geoData.timezone || null,
        ip: userIp,
      };

      const { error: eventInsertError } = await supabase.from("events").insert([
        {
          lead_id: currentLeadId,
          data: eventData,
        },
      ]);

      if (eventInsertError) {
        console.error("Erro ao inserir evento:", eventInsertError);
      } else {
        console.log(
          "Evento registrado com sucesso para lead_id:",
          currentLeadId,
          "trackpage_id:",
          trackpageId,
          "com geo-data."
        );
      }

      console.log(
        `[TRACK] browserId=${browserId} shortcode=${shortcode} time=${new Date(
          timestamp
        ).toISOString()} ua=${user_agent}`
      );
    } catch (err) {
      console.error("Erro inesperado no processamento assíncrono:", err);
    }
  })();
});

module.exports = router;
