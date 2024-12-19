(function() {
    // Obtém o elemento com as informações
    const infoEl = document.getElementById('redirect-info');
    const finalUrl = infoEl.dataset.finalUrl;
    const shortcode = infoEl.dataset.shortcode;
  
    // Gera ou obtém lead_id do localStorage
    let leadId = localStorage.getItem('lead_id');
    if (!leadId) {
      // Gera um UUID para o lead_id
      leadId = crypto.randomUUID();
      localStorage.setItem('lead_id', leadId);
    }
  
    // Envia requisição de tracking
    fetch('/api/v1/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: leadId,
        shortcode: shortcode,
        timestamp: Date.now(),
        user_agent: navigator.userAgent
      })
    }).then(() => {
      // Após track, redireciona
      window.location = finalUrl;
    }).catch(() => {
      // Em caso de erro no tracking, ainda assim redireciona
      window.location = finalUrl;
    });
  })();
  