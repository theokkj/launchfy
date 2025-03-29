const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Import schemas
const importSchemas = require('../utils/schemas');
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
    .from('leads')
    .insert({})
    .select('id')
    .maybeSingle();

  if (leadError || !newLead) {
    console.error(JSON.stringify(leadError));
    throw new Error(
      '[CONNECT.JS - FALHOU] Erro ao criar lead:',
      leadError.message
    );
  }

  // Cria um novo leadProfile
  const { data: newProfile, error: profileError } = await supabase
    .from('leadProfiles')
    .insert([{ profile: profileData, lead_id: newLead.id }])
    .select('id')
    .maybeSingle();

  if (profileError || !newProfile) {
    throw new Error(
      '[CONNECT.JS - FALHOU] Erro ao criar profile do lead:',
      profileError.message
    );
  }

  console.log(`[CONNECT.JS - NOVO LEAD CRIADO COM SUCESSO]`);
  return newLead.id;
}

async function _createEvent(leadId, eventSchemaData, eventSchemaId) {
  console.log(`[CONNECT.JS - CRIANDO NOVO EVENTO]`);
  const { data: eventInsertData, error: eventInsertError } = await supabase
    .from('events')
    .insert([
      {
        lead_id: leadId,
        data: eventSchemaData.eventData,
        eventSchema_id: eventSchemaId,
      },
    ])
    .select('id')
    .single();

  if (eventInsertError || !eventInsertData) {
    throw new Error(
      '[CONNECT.JS - FALHOU] Erro ao inserir evento:',
      eventInsertError.message
    );
  }

  console.log(`[CONNECT.JS - NOVO EVENTO CRIADO COM SUCESSO`);
  return eventInsertData;
}

function _findCurrentEventSchema({ eventType, eventSchemaId }) {
  if (eventType == 'trackpage') {
    console.log(`[CONNECT.JS - EVENT SCHEMA IDENTIFICADO]`);
    return eventsSchemas.find((schema) => schema.type === 'trackpage');
  } else if (!!eventSchemaId) {
    console.log(`[CONNECT.JS - EVENT SCHEMA IDENTIFICADO]`);
    return eventsSchemas.find((schema) => schema.id === eventSchemaId);
  }
}

function _connectEventDataToEventSchema(eventData, eventsSchemas) {
  console.log(`[CONNECT.JS - CONECTANDO EVENT DATA AO EVENT SCHEMA]`);

  const output = {};
  for (const mainKey in eventsSchemas) {
    // Para cada bloco principal (e.g., "eventData", "profileData", etc.)
    output[mainKey] = processSchema(eventData, eventsSchemas[mainKey]);
  }

  console.log(`[CONNECT.JS - EVENT SCHEMA DATA CRIADO]`);
  return output;
}

function processSchema(eventData, schemaPart) {
  // Esta função percorre recursivamente as chaves do schema
  // e devolve um objeto com os valores correspondentes de eventData
  const result = {};

  for (const key in schemaPart) {
    const value = schemaPart[key];

    if (typeof value === 'string') {
      // Se for string, interpretamos como um "path" do tipo 'data.purchase.price.value'
      const nestedValue = getNestedValue(eventData, value);
      if (nestedValue !== undefined) {
        result[key] = nestedValue;
      }
    } else if (typeof value === 'object' && value !== null) {
      // Se for objeto, chamamos a mesma função recursivamente
      result[key] = processSchema(eventData, value);
    }
  }

  return result;
}

function getNestedValue(obj, path) {
  // Faz o split no ponto e percorre o objeto para achar o valor.
  // Caso alguma parte não exista, ele retorna undefined.
  return path
    .split('.')
    .reduce(
      (acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined),
      obj
    );
}

function _findIdFields({ profileSchema, profileData }) {
  console.log(`[CONNECT.JS - IDENTIFICANDO ID FIELDS]`);

  const result = [];

  // Itera pelas chaves do objeto profileData
  for (const key in profileData) {
    // Verifica se o valor não é nulo e se o schema define o campo como "id"
    if (profileData[key] !== null && profileSchema[key] === 'id') {
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
    if (val.includes(',') || val.includes(')')) {
      throw new Error('Invalid characters in value');
    }
    return val.trim();
  }

  // Monta os filtros no formato: profile->>key.eq.value
  const orConditions = idFields.map(({ key, value }) => {
    const cleanValue = sanitizeValue(value);
    return `profile->>${key}.eq.${cleanValue}`;
  });

  // Junta todas as condições com vírgula
  const orQuery = orConditions.join(',');

  return orQuery;
}

async function _getProfilesByIdFields(idFields) {
  console.log(`[CONNECT.JS - BUSCANDO PROFILES BASEADO NOS ID FIELDS]`);
  const query = _transformIdFieldsInQuery(idFields);

  let { data: profilesByQuery, error } = await supabase
    .from('leadProfiles')
    .select('*')
    .or(query);

  if (error) {
    throw new Error(
      '[CONNECT.JS - FALHOU] Erro ao buscar profiles:',
      error.message
    );
  }

  console.log(
    `[CONNECT.JS - ${profilesByQuery.length} PROFILE(S) IDENTIFICADOS]`
  );

  if (profilesByQuery.length == 0) return { profiles: [], leadIds: [] };

  console.log(
    `[CONNECT.JS - PROCURANDO DEMAIS PROFILES DOS LEADS IDENTIFICADOS]`
  );

  const leadIds = profilesByQuery.map((profileData) => profileData['lead_id']);
  const uniqueLeadIds = [...new Set(leadIds)];

  let { data: profiles, error2 } = await supabase
    .from('leadProfiles')
    .select('*')
    .in('lead_id', uniqueLeadIds);

  if (error2 || !profiles || profiles.length == 0) {
    throw new Error(
      '[CONNECT.JS - FALHOU] Erro ao buscar leads:',
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
  eventProfileData,
  idFields,
  leadId,
}) {
  console.log(`[CONNECT.JS - ORDENANDO PROFILES DO ANTIGO AO MAIS NOVO]`);

  console.log(`[CONNECT.JS - ID FIELDS: ${JSON.stringify(idFields)}]`);

  const orderedProfiles = leadProfiles.sort((a, b) => a.id - b.id);
  const updatedProfiles = [];

  let classifiedCase3fields = eventProfileData;

  console.log(`[CONNECT.JS - INICIANDO LOOP DE ANÁLISE DE PROFILE CONFLICT]`);
  for (let profileIdx = 0; profileIdx < orderedProfiles.length; profileIdx++) {
    console.log(`[CONNECT.JS - ANALISANDO ${profileIdx + 1}º PROFILE]`);
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
        .from('leadProfiles')
        .update({ profile: profileAfterAnalysis })
        .eq('id', orderedProfiles[profileIdx].id);

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

    updatedProfiles.push({
      profile: profileAfterAnalysis,
      id: orderedProfiles[profileIdx].id,
    });
  }

  // Se ainda existirem campos conflituosos após as análises
  // Um novo profile será criado para armazenar todos os campos do caso 3
  if (Object.keys(classifiedCase3fields).length > 0) {
    console.log(
      `[CONNECT.JS - CRIANDO NOVO PROFILE PARA ARMAZENAR ID_FIELDS DO CASO 3]`
    );

    // Cria um novo leadProfile
    const { data, error: profileError } = await supabase
      .from('leadProfiles')
      .insert({ profile: classifiedCase3fields, lead_id: leadId })
      .select('id, profile')
      .maybeSingle();

    if (profileError) {
      throw new Error(
        '[CONNECT.JS - FALHOU] Erro ao criar profile:',
        profileError.message
      );
    }

    updatedProfiles.push(data);
    console.log(`[CONNECT.JS - NOVO PROFILE CRIADO COM SUCESSO]`);
  }

  console.log(`[CONNECT.JS - PROFILES ATUALIZADOS COM SUCESSO]`);

  return updatedProfiles;
}

async function _unifyLeads({
  leadsProfiles,
  idFields,
  leadIds,
  eventSchemaData,
}) {
  console.log(`[CONNECT.JS - INICIANDO PROCESSO DE UNIFICAÇÃO DE LEADS]`);

  // Agrupar os dados por leadId e organizar os profiles
  const eachLeadProfiles = (() => {
    const groupedLeads = leadsProfiles.reduce((result, row) => {
      const existingLead = result.find((lead) => lead.id === row.lead_id);
      const profile = { id: row.id, profile: row.profile };

      if (existingLead) {
        existingLead.profiles.push(profile);
      } else {
        result.push({ id: row.lead_id, profiles: [profile] });
      }

      return result;
    }, []);

    // Ordenar os leads e seus profiles
    groupedLeads
      .sort((a, b) => a.leadId - b.leadId)
      .forEach((lead) => {
        lead.profiles.sort((a, b) => a.id - b.id);
      });

    return groupedLeads;
  })();

  console.log(`[CONNECT.JS - LEADS E PROFILES ORGANIZADOS COM SUCESSO]`);

  console.log(
    `[CONNECT.JS - LEAD ID ${eachLeadProfiles[0].id} ALVO PARA MERGE]`
  );

  console.log(`LOG: ${JSON.stringify(eachLeadProfiles)}`);

  // O primeiro lead ordenado por id do menor ao maior é o escolhido para ser aquele onde todos os outros leads se juntarão
  let leadToMerge = eachLeadProfiles[0];

  // Lista de leadIds que serão mergeados no lead alvo
  const leadsMerged = leadIds.filter((item) => item !== leadToMerge.id);

  // Juntar todos os perfis em um só começando a partir do segundo lead, já que o primeiro será o alvo para juntar
  for (let leadIdx = 1; leadIdx < eachLeadProfiles.length; leadIdx++) {
    const currentLead = eachLeadProfiles[leadIdx];

    // Para cada profile do lead atual
    for (
      let profileIdx = 0;
      profileIdx < currentLead.profiles.length;
      profileIdx++
    ) {
      const currentProfile = currentLead.profiles[profileIdx];
      console.log(
        `[CONNECT.JS - JUNTANDO COM LEAD ID ${currentLead.id} - PROFILE ID ${currentProfile.id}]`
      );

      const currentIdFields = _findIdFields({
        profileSchema,
        profileData: currentProfile.profile,
      });

      // Juntar perfis como se o perfil do lead atual fosse um evento
      const updatedProfiles = await _updateLeadProfiles({
        leadProfiles: leadToMerge.profiles,
        eventProfileData: currentProfile.profile,
        idFields: currentIdFields,
        leadId: leadToMerge.id,
      });

      // Se na junção, um novo profile foi adicionado
      eachLeadProfiles[0].profiles = updatedProfiles;
      leadToMerge = eachLeadProfiles[0];

      console.log(`LOG: ${JSON.stringify(eachLeadProfiles)}`);
    }
  }

  console.log(`[CONNECT.JS - ATRIBUINDO EVENTSCHEMADATA AO LEAD UNIFICADO]`);

  // Adicionar eventSchemaData ao perfil do lead alvo
  await _updateLeadProfiles({
    leadProfiles: leadToMerge.profiles,
    eventProfileData: eventSchemaData.profileData,
    idFields,
    leadId: leadToMerge.id,
  });

  console.log(`LEAD TO MERGE ID ${leadToMerge.id}
    LEADS MERGED ${leadsMerged}`);

  console.log(`[CONNECT.JS - ATRIBUINDO EVENTS AO LEAD ALVO]`);

  // Atribuir todos os eventos dos leads juntados ao lead alvo
  const { error: eventMergeError } = await supabase
    .from('events')
    .update({ lead_id: leadToMerge.id })
    .in('lead_id', leadsMerged);

  if (eventMergeError) {
    throw new Error(
      `[CONNECT.JS - ERRO AO ATRIBUIR EVENTOS AO LEAD ALVO : ${eventMergeError}]`
    );
  }

  console.log(`[CONNECT.JS - EVENTS ATRIBUIDOS COM SUCESSO]`);

  console.log(`[CONNECT.JS - ATRIBUINDO BROWSERS AO LEAD ALVO]`);

  // Atribuir todos os browsers dos leads juntados ao lead alvo
  const { error: browserMergeError } = await supabase
    .from('browsers')
    .update({ lead_id: leadToMerge.id })
    .in('lead_id', leadsMerged);

  if (browserMergeError) {
    throw new Error(
      `[CONNECT.JS - ERRO AO ATRIBUIR BROWSERS AO LEAD ALVO : ${browserMergeError}]`
    );
  }

  console.log(`[CONNECT.JS - BROWSERS ATRIBUIDOS COM SUCESSO]`);

  console.log(`[CONNECT.JS - REMOVENDO PROFILES ANTIGOS DOS LEADS UNIFICADOS]`);

  const { error: deleteProfilesError } = await supabase
    .from('leadProfiles')
    .delete()
    .in('lead_id', leadsMerged);

  if (deleteProfilesError) {
    throw new Error(
      `[CONNECT.JS - ERRO AO REMOVER PROFILES ANTIGOS DOS LEADS UNIFICADOS ${deleteProfilesError}]`
    );
  }

  console.log(`[CONNECT.JS - PROFILES REMOVIDOS COM SUCESSO!]`);

  console.log(`[CONNECT.JS - REMOVENDO LEADS UNIFICADOS DO BANCO]`);

  const { error: deleteLeadsError } = await supabase
    .from('leads')
    .delete()
    .in('id', leadsMerged);

  if (deleteLeadsError) {
    throw new Error(
      `[CONNECT.JS - ERRO AO REMOVER LEADS UNIFICADOS DO BANCO ${deleteLeadsError}]`
    );
  }

  console.log(`[CONNECT.JS - LEADS UNIFICADOS REMOVIDOS COM SUCESSO!]`);

  console.log(
    `[CONNECT.JS - ${leadsMerged.length} LEAD(S) FO(I)RAM UNIFICADO(S) COM SUCESSO]`
  );

  return leadToMerge.id;
}

// Connect Trackpage
async function connectTrackpage({ eventData }) {
  try {
    async function _getBrowserSupabaseId(browserId) {
      console.log(`[CONNECT.JS - VERIFICANDO SE O BROWSER É CONHECIDO]`);
      // Verifica se o browser já existe
      const { data: existingBrowser, error: browserSelectError } =
        await supabase
          .from('browsers')
          .select('id, lead_id')
          .eq('browserId', browserId)
          .maybeSingle();

      if (browserSelectError) {
        throw new Error(
          '[CONNECT.JS - FALHOU] Erro ao consultar browserId:',
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
        .from('browsers')
        .insert([
          {
            browserId: browserId,
            user_agent: eventSchemaData.eventData.user_agent,
            lead_id: currentLeadId,
          },
        ])
        .select('id, lead_id')
        .single();

      if (insertBrowserError || !newBrowser) {
        throw new Error(
          '[CONNECT.JS - FALHOU] Erro ao inserir browser:',
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
        currentBrowserSupabaseId = browserSupabase['id'];
        currentLeadId = browserSupabase['lead_id'];
      }

      console.log(`[CONNECT.JS - LEAD IDENTIFICADO]`);
      return currentLeadId;
    }

    const eventType = 'trackpage';

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
    return false;
  }
  return true;
}

// Connect Workflow
async function connectWorkflow({ eventData, workflow }) {
  try {
    const eventType = 'workflow';

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
        throw new Error('Não foi possível criar novo lead');
      }

      // Atribui evento ao lead
      const currentEvent = await _createEvent(
        currentLeadId,
        eventSchemaData,
        workflow.eventSchema_id
      );

      if (!currentEvent) {
        throw new Error('Não foi possível criar novo evento');
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
        eventProfileData: eventSchemaData.profileData,
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
        throw new Error('Não foi possível criar novo evento');
      }
    }
    // Caso mais de 1 lead tenha sido encontrado
    else if (leadIds.length > 1) {
      console.log(
        `[CONNECT.JS - ${leadIds.length} LEADS FORAM REFERENCIADOS PELO EVENTO]`
      );

      // Unifica multiplos leads em 1
      const unifiedLeadId = await _unifyLeads({
        leadsProfiles,
        idFields,
        leadIds,
        eventSchemaData,
      });

      // Atribui evento ao lead
      const currentEvent = await _createEvent(
        unifiedLeadId,
        eventSchemaData,
        workflow.eventSchema_id
      );

      if (!currentEvent) {
        throw new Error('Não foi possível criar novo evento');
      }
    }
  } catch (err) {
    console.error(err);
    return false;
  }

  return true;
}

module.exports = {
  connectTrackpage,
  connectWorkflow,
};
