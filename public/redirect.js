document.addEventListener("DOMContentLoaded", () => {
  // Código do tracking
  const infoEl = document.getElementById("redirect-info");
  const finalUrl = infoEl.dataset.finalUrl;
  const shortcode = infoEl.dataset.shortcode;

  let leadId = localStorage.getItem("lead_id");
  if (!leadId) {
    leadId = crypto.randomUUID();
    localStorage.setItem("lead_id", leadId);
  }

  fetch("/api/v1/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lead_id: leadId,
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
