const express = require('express');

module.exports = function createPixelRouter() {
  const router = express.Router();

  router.get('/', (req, res) => {
    console.log(`[PIXEL.JS - LOAD`);

    // Caminho relativo: sobe uma pasta, depois entra em "public"
    const pixelPath = path.join(__dirname, '..', 'public', 'pixel.html');
    res.sendFile(pixelPath);

    console.log(`[PIXEL.JS - DONE`);
  });
};
