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
      // Verifica se já existe um browser com esse browserId
      const { data: existingBrowser, error: selectError } = await supabase
        .from("browsers")
        .select("id, lead_id")
        .eq("browserId", browserId)
        .maybeSingle();

      if (selectError) {
        console.error("Erro ao consultar browserId:", selectError);
        return;
      }

      if (!existingBrowser) {
        // Não existe um browser com esse ID. Precisamos criar um novo lead e depois o browser.

        // Cria um novo lead
        const { data: newLead, error: leadError } = await supabase
          .from("leads")
          .insert([{ profile: {} }]) // Aqui você pode inserir um profile vazio ou algum dado default.
          .select("id")
          .single();

        if (leadError) {
          console.error("Erro ao criar lead:", leadError);
          return;
        }

        const newLeadId = newLead.id;

        // Agora cria o novo browser associado ao lead
        const { data: insertedBrowser, error: insertBrowserError } =
          await supabase
            .from("browsers")
            .insert([
              {
                browserId: browserId,
                user_agent: user_agent,
                created_at: new Date().toISOString(),
                lead_id: newLeadId,
              },
            ])
            .select("*")
            .single();

        if (insertBrowserError) {
          console.error("Erro ao inserir browser:", insertBrowserError);
          return;
        }

        console.log("Novo lead criado com id:", newLeadId);
        console.log("Novo browser registrado:", insertedBrowser.id);
      } else {
        // Browser já existe, não precisamos criar um novo lead ou browser.
        console.log(
          "Browser já existente com browserId:",
          browserId,
          "e lead_id:",
          existingBrowser.lead_id
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
