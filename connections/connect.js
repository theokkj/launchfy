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
    .insert({})
    .select("id")
    .maybeSingle();

  if (leadError || !newLead) {
    console.error(JSON.stringify(leadError));
    throw new Error(
      "[CONNECT.JS - FALHOU] Erro ao criar lead:",
      leadError.message
    );
  }

  // Cria um novo leadProfile
  const { data: newProfile, error: profileError } = await supabase
    .from("leadProfiles")
    .insert([{ profile: profileData, lead_id: newLead.id }])
    .select("id")
    .maybeSingle();

  if (profileError || !newProfile) {
    throw new Error(
      "[CONNECT.JS - FALHOU] Erro ao criar profile do lead:",
      profileError.message
    );
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
      eventInsertError.message
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
      if (!!eventData[inputKey]) {
        output[mainKey][property] = eventData[inputKey];
      }
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

async function _getProfilesByIdFields(idFields) {
  console.log(`[CONNECT.JS - BUSCANDO PROFILES BASEADO NOS ID FIELDS]`);
  const query = _transformIdFieldsInQuery(idFields);

  let { data: profilesByQuery, error } = await supabase
    .from("leadProfiles")
    .select("*")
    .or(query);

  if (error) {
    throw new Error(
      "[CONNECT.JS - FALHOU] Erro ao buscar profiles:",
      error.message
    );
  }

  console.log(
    `[CONNECT.JS - ${profilesByQuery.length} PROFILE(S) IDENTIFICADOS]`
  );

  if (profilesByQuery.length == 0) return { profiles: [], leadIds: [] };

  console.log(
    `[CONNECT.JS - PROCURANDO DEMAIS PROFILES BASEADO NOS PROFILES IDENTIFICADOS]`
  );

  const leadIds = profilesByQuery.map((profileData) => profileData["lead_id"]);
  const uniqueLeadIds = [...new Set(leadIds)];

  console.log(`[CONNECT.JS - BUSCANDO PROFILES EXTRAS DO MESMO LEAD]`);

  let { data: profiles, error2 } = await supabase
    .from("leadProfiles")
    .select("*")
    .in("lead_id", uniqueLeadIds);

  if (error2 || !profiles || profiles.length == 0) {
    throw new Error(
      "[CONNECT.JS - FALHOU] Erro ao buscar leads:",
      error2.message
    );
  }

  console.log(`[CONNECT.JS - ${profiles.length} PROFILE(S) IDENTIFICADOS]`);

  return { profiles, leadIds: uniqueLeadIds };
}

function _analyseProfileConflict(leadProfile, eventProfileData, idFields) {
  let classifiedFields = {
    case1: {},
    case2: {},
    case3: {},
    case4: {},
  };

  for (const eventField in eventProfileData) {
    // Caso 1 - Campos novos
    if (!leadProfile.hasOwnProperty(eventField)) {
      classifiedFields.case1[eventField] = eventProfileData[eventField];
    }
    // Caso 2 - Campos já existentes e não conflituosos
    else if (leadProfile[eventField] === eventProfileData[eventField]) {
      classifiedFields.case2[eventField] = eventProfileData[eventField];
    }
    // Caso 3 - Campos já existentes, conflituosos e id_fields
    else if (isInIdFields(eventField)) {
      classifiedFields.case3[eventField] = eventProfileData[eventField];
    }
    // Caso 4 - Campos já existentes, conflituosos e não id_fields
    else if (!isInIdFields(eventField)) {
      classifiedFields.case4[eventField] = eventProfileData[eventField];
    } else {
      throw new Error(
        `[CONNECT.JS - ERRO DA REGRA DE NEGÓCIO: PROFILE CONFLICT]`
      );
    }
  }

  function isInIdFields(eventField) {
    return idFields.some((idField) => idField.key === eventField);
  }

  return classifiedFields;
}

async function _updateLeadProfiles({
  leadProfiles,
  eventSchemaData,
  idFields,
  leadId,
}) {
  console.log(`[CONNECT.JS - ORDENANDO PROFILES DO ANTIGO AO MAIS NOVO]`);

  console.log(`[CONNECT.JS - ID FIELDS: ${JSON.stringify(idFields)}]`);

  const orderedProfiles = leadProfiles.sort((a, b) => a.id - b.id);
  const eventProfileData = eventSchemaData.profileData;

  let classifiedCase3fields = eventProfileData;

  console.log(`[CONNECT.JS - INICIANDO LOOP DE ANÁLISE DE PROFILE CONFLICT]`);
  for (let profileIdx = 0; profileIdx < orderedProfiles.length; profileIdx++) {
    console.log(`[CONNECT.JS - ANALISANDO ${profileIdx}º PROFILE]`);
    currentProfile = orderedProfiles[profileIdx].profile;

    const classifiedEventFields = _analyseProfileConflict(
      currentProfile,
      classifiedCase3fields,
      idFields
    );

    console.log(
      `[CONNECT.JS - ANÁLISE CONCLUÍDA ${JSON.stringify(
        classifiedEventFields
      )}]`
    );

    // Adiciona novos campos ao perfil atual
    // Sobrescreve campos atualizado ao perfil atual
    const profileAfterAnalysis = {
      ...currentProfile,
      ...classifiedEventFields.case1,
      ...classifiedEventFields.case4,
    };

    if (
      Object.keys(classifiedEventFields.case1).length > 0 ||
      Object.keys(classifiedEventFields.case4).length > 0
    ) {
      console.log(`[CONNECT.JS - ATUALIZANDO PROFILE]`);
      // Atualiza profile atual no Supabase
      let { error } = await supabase
        .from("leadProfiles")
        .update({ profile: profileAfterAnalysis })
        .eq("id", orderedProfiles[profileIdx].id);

      if (error) {
        throw new Error(
          `[CONNECT.JS - ERRO AO ATUALIZAR PROFILE ID: ${currentProfile.id} - ERRO: ${error.message}]`
        );
      }

      console.log(`[CONNECT.JS - PROFILE ATUALIZADO]`);
    }

    classifiedCase3fields = classifiedEventFields.case3;
    console.log(
      `[CONNECT.JS - ${JSON.stringify(
        classifiedCase3fields
      )} FIELDS DO CASO 3 RESTANTES]`
    );

    // Se todos os campos foram resolvidos, pare o loop
    if (Object.keys(classifiedCase3fields).length == 0) break;
  }

  // Se ainda existirem campos conflituosos após as análises
  // Um novo profile será criado para armazenar todos os campos do caso 3
  if (Object.keys(classifiedCase3fields).length > 0) {
    console.log(
      `[CONNECT.JS - CRIANDO NOVO PROFILE PARA ARMAZENAR ID_FIELDS DO CASO 3]`
    );

    // Cria um novo leadProfile
    const { error: profileError } = await supabase
      .from("leadProfiles")
      .insert({ profile: classifiedCase3fields, lead_id: leadId });

    if (profileError) {
      throw new Error(
        "[CONNECT.JS - FALHOU] Erro ao criar profile:",
        profileError.message
      );
    }

    console.log(`[CONNECT.JS - NOVO PROFILE CRIADO COM SUCESSO]`);
  }

  console.log(`[CONNECT.JS - PROFILES ATUALIZADOS COM SUCESSO]`);

  return;
}

// Connect Trackpage
async function connectTrackpage({ eventData }) {
  try {
    async function _getBrowserSupabaseId(browserId) {
      console.log(`[CONNECT.JS - VERIFICANDO SE O BROWSER É CONHECIDO]`);
      // Verifica se o browser já existe
      const { data: existingBrowser, error: browserSelectError } =
        await supabase
          .from("browsers")
          .select("id, lead_id")
          .eq("browserId", browserId)
          .maybeSingle();

      if (browserSelectError) {
        throw new Error(
          "[CONNECT.JS - FALHOU] Erro ao consultar browserId:",
          browserSelectError.message
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
          insertBrowserError.message
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
  } catch (err) {
    console.error(err);
  }
}

// Connect Workflow
async function connectWorkflow({ eventData, workflow }) {
  try {
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

    const { profiles: leadsProfiles, leadIds } = await _getProfilesByIdFields(
      idFields
    );

    // Caso nenhum lead tenha sido encontrado
    if (leadIds.length == 0) {
      console.log(`[CONNECT.JS - NENHUM LEAD FOI REFERENCIADO NO EVENTO]`);
      // Cria leaD
      const currentLeadId = await _createLead(eventSchemaData.profileData);

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
    else if (leadIds.length == 1) {
      console.log(`[CONNECT.JS - APENAS 1 LEAD FOI REFERENCIADO NO EVENTO]`);

      // Pega lead do leadsMatched
      const currentLeadId = leadIds[0];
      const currentLeadProfiles = leadsProfiles;

      await _updateLeadProfiles({
        leadProfiles: currentLeadProfiles,
        eventSchemaData,
        idFields,
        leadId: currentLeadId,
      });

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
    // Caso mais de 1 lead tenha sido encontrado
    else if (leadIds.length > 1) {
      console.log(
        `[CONNECT.JS - ${leadIds.length} FORAM REFERENCIADOS PELO EVENTO]`
      );
      // unifyLeads()
      // attributeEvent()
    }
  } catch (err) {
    console.error(err);
  }
}

module.exports = {
  connectTrackpage,
  connectWorkflow,
};
