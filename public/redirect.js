window.addEventListener('load', () => {
  // Código do tracking
  const infoEl = document.getElementById('redirect-info');
  const finalUrl = infoEl.dataset.finalUrl;
  const shortcode = infoEl.dataset.shortcode;

  let browserId = localStorage.getItem('browser_Id');
  if (!browserId) {
    browserId = crypto.randomUUID();
    localStorage.setItem('browser_Id', browserId);
  }

  fetch('/api/v1/trackpage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      browser_id: browserId,
      shortcode: shortcode,
      timestamp: Date.now(),
      user_agent: navigator.userAgent,
    }),
  })
    .then(() => {
      window.location = finalUrl;
    })
    .catch(() => {
      window.location = finalUrl;
    });
});
