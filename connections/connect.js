const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Import schemas
const importSchemas = require("../utils/schemas");
let eventsSchemas = [];
let profileSchema = {};

(async (params) => {
  let response = await importSchemas(supabaseUrl, supabaseAnonKey);

  eventsSchemas = response.eventsSchemas;
  profileSchema = response.profileSchema;
})();

// Functions

async function _createLead(profileData) {
  // Cria um novo lead
  const { data: newLead, error: leadError } = await supabase
    .from("leads")
    .insert([{ profile: profileData }])
    .select("id")
    .maybeSingle();

  if (leadError) {
    console.error("Erro ao criar lead:", leadError);
    return;
  }

  return newLead.id;
}

async function _createEvent(leadId, eventSchemaData) {
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

async function _getBrowserSupabaseId(browserId) {
  // Verifica se o browser já existe
  const { data: existingBrowser, error: browserSelectError } = await supabase
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

async function _createBrowser(browserId, currentLeadId, eventSchemaData) {
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

async function _getLeadFromBrowserId(eventSchemaData) {
  try {
    const browserLocalId = eventSchemaData.eventData.browser_id;
    const browserSupabase = await _getBrowserSupabaseId(browserLocalId);

    let currentBrowserSupabaseId;
    let currentLeadId;

    // Se o browser ainda não existe no supabase, será necessário adicioná-lo
    if (!browserSupabase) {
      currentLeadId = await _createLead(eventSchemaData.profileData);
      if (!currentLeadId) return;

      currentBrowserSupabaseId = await _createBrowser(
        browserLocalId,
        currentLeadId,
        eventSchemaData
      );
      if (!currentBrowserSupabaseId) return;
    }
    // Se o browser já existe no supabase
    else {
      currentBrowserSupabaseId = browserSupabase["id"];
      currentLeadId = browserSupabase["lead_id"];
    }

    return currentLeadId;
  } catch (err) {
    console.error("Erro inesperado no processamento assíncrono:", err);
  }
}

function _findCurrentEventSchema(eventType) {
  if (eventType == "trackpage")
    return eventsSchemas.find((schema) => schema.type === "trackpage")
      .connectionSchema;
}

function _connectEventDataToEventSchema(eventData, eventsSchemas) {
  const output = {};

  // Percorre cada key principal do schema (eventData, profileData, etc.)
  for (const mainKey in eventsSchemas) {
    // Cria um objeto interno caso não exista
    output[mainKey] = {};

    // Percorre cada propriedade interna do schema
    for (const property in eventsSchemas[mainKey]) {
      const inputKey = eventsSchemas[mainKey][property]; // chave do input que queremos
      // Atribui o valor do input correspondente ao campo do schema
      output[mainKey][property] = eventData[inputKey] || null;
    }
  }

  return output;
}

module.exports = async function connect({ eventData, eventType }) {
  const currentEventSchema = _findCurrentEventSchema(eventType);
  const eventSchemaData = _connectEventDataToEventSchema(
    eventData,
    currentEventSchema
  );

  console.log(
    `
    EVENT DATA: ${JSON.stringify(eventData)}
    
    CURRENT EVENT SCHEMA: ${JSON.stringify(currentEventSchema)}
    
    CURRENT EVENT SCHEMA DATA: ${JSON.stringify(eventSchemaData)}`
  );

  let currentLeadId;
  // Se o evento é do tipo trackpage

  if (eventType == "trackpage") {
    currentLeadId = await _getLeadFromBrowserId(eventSchemaData);
  }
  // Se o evento é do tipo workflow
  else if (eventType == "workflow") {
  }

  const currentEventSupabase = await _createEvent(
    currentLeadId,
    eventSchemaData
  );

  if (!currentEventSupabase) return;

  console.log(
    `
    [EVENT] 
    SLUG=${eventData.slug} 
    LEAD_ID=${currentLeadId} 
    EVENT_ID=${currentEventSupabase["id"]}`
  );
};
