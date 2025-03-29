const express = require('express');
const router = express.Router();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getTrackpageId(slug) {
  console.log(`[TRACKPAGE.JS - BUSCANDO TRACKPAGE REFERENCIADA PELO SLUG`);

  // Obter trackpage_id
  const { data: trackpageData, error: trackpageError } = await supabase
    .from('trackpages')
    .select('id')
    .eq('slug', slug)
    .single();

  if (trackpageError || !trackpageData) {
    throw new Error(
      `[TRACKPAGE.JS - FALHOU] TRACKPAGE NÃO FOI ENCONTRADA NO BANCO`,
      slug,
      trackpageError
    );
  }

  console.log(`[TRACKPAGE.JS - TRACKPAGE IDENTIFICADA]`);
  return trackpageData.id;
}

function getLeadIPAddress(req) {
  const userIpRaw = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userIp = userIpRaw.split(',')[0].trim();

  console.log(`[TRACKPAGE.JS - ENDEREÇO DE IP DO LEAD IDENTIFICADO]`);
  return userIp;
}

async function getGeolocationData(leadIp) {
  console.log(`[TRACKPAGE.JS - BUSCANDO DADOS GEOGRÁFICOS DO LEAD]`);
  // Chama a API do geojs.io para obter dados de geolocalização
  const geoResponse = await fetch(
    `https://get.geojs.io/v1/ip/geo/${leadIp}.json`
  );
  let geoData = {};
  if (geoResponse.ok) {
    geoData = await geoResponse.json();
  }

  console.log(`[TRACKPAGE.JS - DADOS GEOGRÁFICOS IDENTIFICADOS]`);
  return geoData;
}

const { connectTrackpage } = require('../connections/connect.js');

router.post('/', (req, res) => {
  const { browser_id, shortcode, timestamp, user_agent } = req.body;
  console.log(`-------------------------------------`);
  console.log(`[TRACKPAGE.JS - RECEBIDO] SHORTCODE: ${shortcode}`);

  res.status(200).json({ status: 'ok' });
  console.log(`[TRACKPAGE.JS - STATUS 200 ENVIADO`);

  try {
    (async () => {
      // Pega trackpageId do Supabase
      const trackpageId = await getTrackpageId(shortcode);
      if (!trackpageId) return;

      // Pega IP Address
      const leadIp = getLeadIPAddress(req);

      // Pega Geo Data
      const geoData = await getGeolocationData(leadIp);

      const eventData = {
        browser_id: browser_id,
        ipAddress: leadIp,
        city: geoData.city || null,
        country: geoData.country || null,
        timezone: geoData.timezone || null,
        trackpage_id: trackpageId,
        user_agent: user_agent || null,
        slug: shortcode,
      };

      console.log(`[TRACKPAGE.JS - INICIANDO CONNECT.JS]`);
      const isSuccessful = await connectTrackpage({
        eventData: eventData,
        eventType: 'trackpage',
      });
      if (!isSuccessful) throw new Error();
      console.log(`[TRACKPAGE.JS - SUCESSO!]`);
      console.log(`-------------------------------------`);
    })();
  } catch (err) {
    console.error(
      '[TRACKPAGE.JS - FALHOU] Erro inesperado no processamento:',
      err
    );
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
