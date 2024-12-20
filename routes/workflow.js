const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

// Inicializa o Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const { connectWorkflow } = require("../connections/connect.js");

router.post("/:webhookPath", async (req, res) => {
  try {
    async function _getWorkflow(webhookPath) {
      const { data, error } = await supabase
        .from("workflows")
        .select("*")
        .eq("webhookPath", webhookPath)
        .maybeSingle();

      if (error) {
        res.status(400).json({ error: "Bad request" });
        throw new Error(
          `Workflow não encontrado com webhookPath: ${webhookPath}`
        );
      }

      return data;
    }

    const { webhookPath } = req.params;

    console.log(`-------------------------------------`);
    console.log(`[WORKFLOW.JS - RECEBIDO] WEBHOOK PATH: ${webhookPath}`);
    const workflow = await _getWorkflow(webhookPath);
    if (!workflow) {
      console.log(`[WORKFLOW.JS - FALHOU] NÃO FOI ENCONTRADO`);
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    console.log(
      `[WORKFLOW.JS - IDENTIFICADO] ID: ${workflow.id} NAME: ${workflow.name}`
    );

    const eventData = req.body;

    console.log(`[WORKFLOW.JS - INICIANDO CONNECT.JS]`);
    await connectWorkflow({ eventData, workflow });
    console.log(`[WORKFLOW.JS - SUCESSO]`);
    console.log(`-------------------------------------`);

    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error(
      "[WORKFLOW.JS - FALHOU] Erro inesperado no processamento do webhook:",
      err
    );
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
