const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

router.post("/", (req, res) => {
  const { lead_id, shortcode, timestamp, user_agent } = req.body;
  const browserId = lead_id;

  // Responde imediatamente para não atrasar o redirecionamento do usuário
  res.status(200).json({ status: "ok" });

  (async () => {
    try {
      // Obtém o IP do cliente
      // Em ambientes por trás de proxies, pode usar req.headers['x-forwarded-for']
      // e pegar o primeiro IP da lista. Caso contrário, req.ip pode funcionar.
      const clientIp = req.headers["x-forwarded-for"]
        ? req.headers["x-forwarded-for"].split(",")[0].trim()
        : req.ip;

      // Chamando a API ipapi para obter geodados do IP
      let ipData = {};
      try {
        const response = await fetch(`https://ipapi.co/${clientIp}/json/`);
        if (response.ok) {
          ipData = await response.json();
        } else {
          console.error(
            "Falha ao obter dados de IP da ipapi:",
            await response.text()
          );
        }
      } catch (err) {
        console.error("Erro ao chamar a ipapi:", err);
      }

      // Lógica para verificar/criar lead e browser (conforme já implementado anteriormente)
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

        // Cria o novo browser associado ao lead
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

      // Obter o trackpage_id a partir do shortcode
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

      // Monta o JSON com os dados de geolocalização obtidos
      const eventData = {
        browser_id: currentBrowserId,
        trackpage_id: trackpageId,
        ip: ipData.ip || clientIp, // garante ao menos registrar o IP real
        adress_city: ipData.city || null,
        adress_country: ipData.country || null,
        adress_country_name: ipData.country_name || null,
        adress_state: ipData.region || null,
        adress_zipcode: ipData.postal || null,
      };

      // Insere o evento
      const { error: eventInsertError } = await supabase.from("events").insert([
        {
          lead_id: currentLeadId,
          data: eventData,
        },
      ]);

      if (eventInsertError) {
        console.error("Erro ao inserir evento:", eventInsertError);
        return;
      }

      console.log(
        `[TRACK] browserId=${browserId} shortcode=${shortcode} time=${new Date(
          timestamp
        ).toISOString()} ua=${user_agent}`
      );
      console.log("Evento registrado com IP e localização.");
    } catch (err) {
      console.error("Erro inesperado no processamento assíncrono:", err);
    }
  })();
});

module.exports = router;
