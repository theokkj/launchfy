const express = require('express');
const router = express.Router();

// Rota de tracking
router.post('/', (req, res) => {
  const { lead_id, shortcode, timestamp, user_agent } = req.body;
  console.log(`[TRACK] lead_id=${lead_id} shortcode=${shortcode} time=${new Date(timestamp).toISOString()} ua=${user_agent}`);
  res.status(200).json({ status: 'ok' });
});

module.exports = router;
