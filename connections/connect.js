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
  profileSchema = response.profileSchema.schema;
})();

// Functions

async function _createLead(profileData) {
  console.log(`[CONNECT.JS - CRIANDO NOVO LEAD]`);
  // Cria um novo lead
  const { data: newLead, error: leadError } = await supabase
    .from("leads")
    .insert([{ profile: profileData }])
    .select("id")
    .maybeSingle();

  if (leadError || !newLead) {
    throw new Error("[CONNECT.JS - FALHOU] Erro ao criar lead:", leadError);
  }

  console.log(`[CONNECT.JS - NOVO LEAD CRIADO COM SUCESSO]`);
  return newLead.id;
}

async function _createEvent(leadId, eventSchemaData, eventSchemaId) {
  console.log(`[CONNECT.JS - CRIANDO NOVO EVENTO]`);
  const { data: eventInsertData, error: eventInsertError } = await supabase
    .from("events")
    .insert([
      {
        lead_id: leadId,
        data: eventSchemaData.eventData,
        eventSchema_id: eventSchemaId,
      },
    ])
    .select("id")
    .single();

  if (eventInsertError || !eventInsertData) {
    throw new Error(
      "[CONNECT.JS - FALHOU] Erro ao inserir evento:",
      eventInsertError
    );
  }

  console.log(`[CONNECT.JS - NOVO EVENTO CRIADO COM SUCESSO`);
  return eventInsertData;
}

function _findCurrentEventSchema({ eventType, eventSchemaId }) {
  if (eventType == "trackpage") {
    console.log(`[CONNECT.JS - EVENT SCHEMA IDENTIFICADO]`);
    return eventsSchemas.find((schema) => schema.type === "trackpage");
  } else if (!!eventSchemaId) {
    console.log(`[CONNECT.JS - EVENT SCHEMA IDENTIFICADO]`);
    return eventsSchemas.find((schema) => schema.id === eventSchemaId);
  }
}

function _connectEventDataToEventSchema(eventData, eventsSchemas) {
  console.log(`[CONNECT.JS - CONECTANDO EVENT DATA AO EVENT SCHEMA]`);
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

  console.log(`[CONNECT.JS - EVENT SCHEMA DATA CRIADO]`);

  return output;
}

function _findIdFields({ profileSchema, profileData }) {
  console.log(`[CONNECT.JS - IDENTIFICANDO ID FIELDS]`);

  const result = [];

  // Itera pelas chaves do objeto profileData
  for (const key in profileData) {
    // Verifica se o valor não é nulo e se o schema define o campo como "id"
    if (profileData[key] !== null && profileSchema[key] === "id") {
      result.push({ key, value: profileData[key] }); // Adiciona a propriedade na lista
    }
  }

  console.log(`[CONNECT.JS - ID FIELDS IDENTIFICADOS!]`);

  return result;
}

function _transformIdFieldsInQuery(idFields) {
  // Função para sanitizar os valores do input
  function sanitizeValue(val) {
    // Remove caracteres problemáticos ou retorna erro
    if (val.includes(",") || val.includes(")")) {
      throw new Error("Invalid characters in value");
    }
    return val.trim();
  }

  // Monta os filtros no formato: profile->>key.eq.value
  const orConditions = idFields.map(({ key, value }) => {
    const cleanValue = sanitizeValue(value);
    return `profile->>${key}.eq.${cleanValue}`;
  });

  // Junta todas as condições com vírgula
  const orQuery = orConditions.join(",");

  return orQuery;
}

async function _getLeadsByIdFields(idFields) {
  console.log(`[CONNECT.JS - BUSCANDO LEADS BASEADO NOS ID FIELDS]`);
  const query = _transformIdFieldsInQuery(idFields);

  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .or(query);

  if (error) {
    throw new Error("[CONNECT.JS - FALHOU] Erro ao buscar leads:", error);
  }

  console.log(`[CONNECT.JS - LEADS IDENTIFICADOS]`);
  return leads;
}

async function updateLeadProfile({ currentLead, profileData }) {
  console.log(`[CONNECT.JS - ATUALIZANDO PROFILE DO LEAD]`);

  const profileDataNotNulled = Object.entries(profileData).reduce(
    (acc, [key, value]) => {
      if (value !== null) {
        acc[key] = value;
      }
      return acc;
    },
    {}
  );

  const newProfile = {
    ...currentLead.profile,
    ...profileDataNotNulled,
  };

  const { error: updateError } = await supabase
    .from("leads")
    .update({ profile: newProfile })
    .eq("id", currentLead.id);

  if (updateError) {
    throw new Error(
      "[CONNECT.JS - FALHOU] Erro ao atualizar lead:",
      updateError
    );
  }

  console.log(`[CONNECT.JS - PROFILE ATUALIZADO COM SUCESSO]`);
  return;
}

async function connectTrackpage({ eventData }) {
  async function _getBrowserSupabaseId(browserId) {
    console.log(`[CONNECT.JS - VERIFICANDO SE O BROWSER É CONHECIDO]`);
    // Verifica se o browser já existe
    const { data: existingBrowser, error: browserSelectError } = await supabase
      .from("browsers")
      .select("id, lead_id")
      .eq("browserId", browserId)
      .maybeSingle();

    if (browserSelectError) {
      throw new Error(
        "[CONNECT.JS - FALHOU] Erro ao consultar browserId:",
        browserSelectError
      );
    }

    console.log(`[CONNECT.JS - VERIFICAÇÃO CONCLUÍDA]`);
    return !!existingBrowser ? existingBrowser : null;
  }

  async function _createBrowser(browserId, currentLeadId, eventSchemaData) {
    console.log(`[CONNECT.JS - CRIANDO NOVO BROWSER]`);
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

    if (insertBrowserError || !newBrowser) {
      throw new Error(
        "[CONNECT.JS - FALHOU] Erro ao inserir browser:",
        insertBrowserError
      );
    }

    console.log(`[CONNECT.JS - BROWSER CADASTRADO COM SUCESSO]`);
    return newBrowser.id;
  }

  async function _getLeadFromBrowserId(eventSchemaData) {
    console.log(`[CONNECT.JS - BUSCANDO LEAD REFERENCIADO PELO BROWSER_ID]`);
    const browserLocalId = eventSchemaData.eventData.browser_id;
    const browserSupabase = await _getBrowserSupabaseId(browserLocalId);

    let currentBrowserSupabaseId;
    let currentLeadId;

    // Se o browser ainda não existe no supabase, será necessário adicioná-lo
    if (!browserSupabase) {
      currentLeadId = await _createLead(eventSchemaData.profileData);

      currentBrowserSupabaseId = await _createBrowser(
        browserLocalId,
        currentLeadId,
        eventSchemaData
      );
    }
    // Se o browser já existe no supabase
    else {
      currentBrowserSupabaseId = browserSupabase["id"];
      currentLeadId = browserSupabase["lead_id"];
    }

    console.log(`[CONNECT.JS - LEAD IDENTIFICADO]`);
    return currentLeadId;
  }

  const eventType = "trackpage";

  const currentEventSchema = _findCurrentEventSchema({ eventType });
  const eventSchemaData = _connectEventDataToEventSchema(
    eventData,
    currentEventSchema.connectionSchema
  );

  let currentLeadId = await _getLeadFromBrowserId(eventSchemaData);

  const currentEventSupabase = await _createEvent(
    currentLeadId,
    eventSchemaData,
    currentEventSchema.id
  );
}

async function connectWorkflow({ eventData, workflow }) {
  const eventType = "workflow";

  const currentEventSchema = _findCurrentEventSchema({
    eventSchemaId: workflow.eventSchema_id,
  });

  const eventSchemaData = _connectEventDataToEventSchema(
    eventData,
    currentEventSchema.connectionSchema
  );

  const idFields = _findIdFields({
    profileSchema,
    profileData: eventSchemaData.profileData,
  });

  const leadsMatched = await _getLeadsByIdFields(idFields);

  // Caso nenhum lead tenha sido encontrado
  if (leadsMatched.length == 0) {
    console.log(`[CONNECT.JS - NENHUM LEAD FOI REFERENCIADO NO EVENTO]`);
    // Cria leaD
    const currentLeadId = await _createLead();

    if (!currentLeadId) {
      throw new Error("Não foi possível criar novo lead");
    }

    // Atribui evento ao lead
    const currentEvent = await _createEvent(
      currentLeadId,
      eventSchemaData,
      workflow.eventSchema_id
    );

    if (!currentEvent) {
      throw new Error("Não foi possível criar novo evento");
    }
  }
  // Caso apenas 1 lead tenha sido encontrado
  else if (leadsMatched.length == 1) {
    console.log(`[CONNECT.JS - APENAS 1 LEAD FOI REFERENCIADO NO EVENTO]`);

    // Pega lead do leadsMatched
    const currentLead = leadsMatched[0];

    await updateLeadProfile({
      currentLead,
      profileData: eventSchemaData.profileData,
    });

    // Atribui evento ao lead
    const currentEvent = await _createEvent(
      currentLead.id,
      eventSchemaData,
      workflow.eventSchema_id
    );

    if (!currentEvent) {
      throw new Error("Não foi possível criar novo evento");
    }
  }
  // Caso mais de 1 lead tenha sido encontrado
  else if (leadsMatched.length > 1) {
    // unifyLeads()
    // attributeEvent()
  }
}

module.exports = {
  connectTrackpage,
  connectWorkflow,
};
