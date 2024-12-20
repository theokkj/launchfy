const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function processTrackpage(eventSchemaData) {
  try {
    async function getBrowserSupabaseId(browserId) {
      // Verifica se o browser já existe
      const { data: existingBrowser, error: browserSelectError } =
        await supabase
          .from("browsers")
          .select("id, lead_id")
          .eq("browserId", browserId)
          .maybeSingle();

      if (browserSelectError) {
        console.error("Erro ao consultar browserId:", browserSelectError);
        return null;
      }

      return !!existingBrowser ? existingBrowser : null;
    }

    async function createBrowser(browserId, currentLeadId) {
      // Cria o novo browser
      const { data: newBrowser, error: insertBrowserError } = await supabase
        .from("browsers")
        .insert([
          {
            browserId: browserId,
            user_agent: eventSchemaData.eventData.user_agent,
            lead_id: currentLeadId,
          },
        ])
        .select("id, lead_id")
        .single();

      if (insertBrowserError) {
        console.error("Erro ao inserir browser:", insertBrowserError);
        return;
      }

      return newBrowser.id;
    }

    async function createEvent(leadId, eventSchemaData) {
      const { data: eventInsertData, error: eventInsertError } = await supabase
        .from("events")
        .insert([
          {
            lead_id: leadId,
            data: eventSchemaData.eventData,
          },
        ])
        .select("id")
        .single();

      if (eventInsertError) {
        console.error("Erro ao inserir evento:", eventInsertError);
        return;
      }

      return eventInsertData;
    }

    const browserLocalId = eventSchemaData.profileData.browser_id;
    const browserSupabase = await getBrowserSupabaseId(browserLocalId);

    let currentBrowserSupabaseId;
    let currentLeadId;

    // Se o browser ainda não existe no supabase, será necessário adicioná-lo
    if (!browserSupabase) {
      currentLeadId = await createLead(eventSchemaData.profileData);
      if (!currentLeadId) return;

      currentBrowserSupabaseId = await createBrowser(
        browserLocalId,
        currentLeadId
      );
      if (!currentBrowserSupabaseId) return;
    }
    // Se o browser já existe no supabase
    else {
      currentBrowserSupabaseId = browserSupabase["id"];
      currentLeadId = browserSupabase["lead_id"];
    }

    const currentEventSupabase = await createEvent(
      currentLeadId,
      eventSchemaData
    );

    if (!currentEventSupabase) return;

    console.log(
      `[TRACKPAGE] SLUG=${eventSchemaData.eventData.slug} LEAD_ID=${currentLeadId} EVENT_ID=${currentEventSupabase["id"]}`
    );
  } catch (err) {
    console.error("Erro inesperado no processamento assíncrono:", err);
  }
}

async function createLead(profileData) {
  // Cria um novo lead
  const { data: newLead, error: leadError } = await supabase
    .from("leads")
    .insert([{ profile: profileData }])
    .select("id")
    .single();

  if (leadError) {
    console.error("Erro ao criar lead:", leadError);
    return;
  }

  return newLead.id;
}

module.exports = async function connect({ eventSchemaData, eventType }) {
  // Se o evento é do tipo trackpage

  if (eventType == "trackpage") {
    await processTrackpage(eventSchemaData);
  }
};
