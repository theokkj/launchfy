const { createClient } = require("@supabase/supabase-js");

module.exports = async function importSchemas(supabaseUrl, supabaseAnonKey) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Get event schemas
  let { data: eventsSchemas, error: eventError } = await supabase
    .from("eventsSchema")
    .select("*");
  if (eventError) {
    console.error("Erro ao importar event schemas:", eventError);
    return;
  }

  // Get profile schema
  let { data: profileSchema, error: profileError } = await supabase
    .from("profileSchema")
    .select("*")
    .single();

  if (profileError) {
    console.error("Erro ao importar profile schema:", profileError);
    return;
  }

  console.log(`[SCHEMAS IMPORTED]`);

  return {
    eventsSchemas,
    profileSchema,
  };
};
