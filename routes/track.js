const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

// Inicializa o supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

router.post("/", (req, res) => {
  const { lead_id, shortcode, timestamp, user_agent } = req.body;
  const browserId = lead_id;

  // Envia a resposta imediatamente para não travar o redirecionamento do usuário
  res.status(200).json({ status: "ok" });

  // Agora, após responder, processamos assíncronamente no "background"
  (async () => {
    try {
      // Verifica se já existe um browser com esse browserId
      const { data: existingBrowser, error: selectError } = await supabase
        .from("browsers")
        .select("*")
        .eq("browserId", browserId)
        .maybeSingle();

      if (selectError) {
        console.error("Erro ao consultar browserId:", selectError);
        return; // Aqui apenas registramos o erro e saímos
      }

      // Se não encontrou, insere novo browser
      if (!existingBrowser) {
        const { data: insertedBrowser, error: insertError } = await supabase
          .from("browsers")
          .insert([
            {
              browserId: browserId,
              user_agent: user_agent,
              created_at: new Date().toISOString(),
            },
          ])
          .select("*")
          .single();

        if (insertError) {
          console.error("Erro ao inserir browser:", insertError);
          return;
        }

        console.log("Novo browser registrado:", insertedBrowser);
      } else {
        console.log("Browser já existente com browserId:", browserId);
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
