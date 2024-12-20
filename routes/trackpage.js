const express = require("express");
const router = express.Router();

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getTrackpageId(slug) {
  // Obter trackpage_id
  const { data: trackpageData, error: trackpageError } = await supabase
    .from("trackpages")
    .select("id")
    .eq("slug", slug)
    .single();

  if (trackpageError || !trackpageData) {
    console.error(
      "Trackpage não encontrada para o shortcode:",
      slug,
      trackpageError
    );
    return null;
  }

  return trackpageData.id;
}

function getLeadIPAddress(req) {
  const userIpRaw = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const userIp = userIpRaw.split(",")[0].trim();

  return userIp;
}

async function getGeolocationData(leadIp) {
  // Chama a API do geojs.io para obter dados de geolocalização
  const geoResponse = await fetch(
    `https://get.geojs.io/v1/ip/geo/${leadIp}.json`
  );
  let geoData = {};
  if (geoResponse.ok) {
    geoData = await geoResponse.json();
  }

  return geoData;
}

const connect = require("../connections/connect.js");

router.post("/", (req, res) => {
  const { browser_id, shortcode, timestamp, user_agent } = req.body;

  res.status(200).json({ status: "ok" });

  (async () => {
    // Pega trackpageId do Supabase
    const trackpageId = await getTrackpageId(shortcode);
    if (!trackpageId) return;

    // Pega IP Address
    const leadIp = getLeadIPAddress(req);

    // Pega Geo Data
    const geoData = getGeolocationData(leadIp);

    const eventSchemaData = {
      profileData: {
        browser_id: browser_id,
        ipAddress: leadIp,
      },
      eventData: {
        city: geoData.city || null,
        country: geoData.country || null,
        timezone: geoData.timezone || null,
        trackpage_id: trackpageId,
        user_agent: user_agent || null,
        slug: shortcode,
      },
    };

    await connect({ eventSchemaData: eventSchemaData, eventType: "trackpage" });
  })();
});

module.exports = router;
