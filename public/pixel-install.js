(function () {
  // ==============================================
  // =============== CONFIGURAÇÕES ================
  // ==============================================
  // Mude para seu domínio real.
  const BRIDGE_ORIGIN = 'https://meusite.com';
  // Caminho do bridge do seu site que faz a leitura do localStorage
  const BRIDGE_PATH = '/pixel.html';

  // ==============================================
  // =========== CRIAÇÃO DO IFRAME ================
  // ==============================================
  let iframe;
  const initIframe = () => {
    // Evite inserir várias vezes se o script for chamado novamente
    if (iframe) return;

    iframe = document.createElement('iframe');
    iframe.src = BRIDGE_ORIGIN + BRIDGE_PATH;
    iframe.style.display = 'none';
    // Adiciona o iframe ao body (ou outro local do DOM)
    document.body.appendChild(iframe);
  };

  // ==============================================
  // ========= COMUNICAÇÃO VIA postMessage ========
  // ==============================================
  // Listener para tratar respostas do iframe
  window.addEventListener('message', (event) => {
    // Verificar se a mensagem vem do seu domínio
    if (event.origin !== BRIDGE_ORIGIN) return;

    const data = event.data;
    if (!data || !data.command) return;

    switch (data.command) {
      case 'BROWSER_ID_RESPONSE':
        console.log(
          '[meuscript.js] Valor de browserId recebido:',
          data.browserId
        );
        // Aqui você poderia disparar algum evento customizado no DOM
        // ou chamar outra função para processar o valor.
        break;
      case 'WRITE_CONFIRMATION':
        if (data.success) {
          console.log(
            '[meuscript.js] Sucesso ao gravar o browser_Id no localStorage remoto'
          );
        } else {
          console.error(
            '[meuscript.js] Falha ao gravar o browser_Id no localStorage remoto'
          );
        }
        break;
      default:
        console.log('[meuscript.js] Comando desconhecido:', data.command);
    }
  });

  // ==============================================
  // ========= FUNÇÕES DE LEITURA/ESCRITA =========
  // ==============================================
  // Função para solicitar ao iframe o browserId
  const readBrowserId = () => {
    if (!iframe) initIframe(); // Garante que o iframe está criado
    iframe.contentWindow.postMessage(
      { command: 'READ_BROWSER_ID' },
      BRIDGE_ORIGIN
    );
  };

  // Função para escrever valor no browserId do localStorage remoto
  const writeBrowserId = (newValue) => {
    if (!iframe) initIframe();
    iframe.contentWindow.postMessage(
      { command: 'WRITE_BROWSER_ID', value: newValue },
      BRIDGE_ORIGIN
    );
  };

  // ==============================================
  // =========== INICIALIZAÇÃO DO SCRIPT ==========
  // ==============================================
  // Exemplo: iniciar ao carregar a página
  window.addEventListener('load', () => {
    initIframe();

    // Exemplo: Ler o browserId automaticamente
    readBrowserId();

    // Se quiser escrever:
    // writeBrowserId('seu-novo-valor-de-browser-id');
  });

  // ==============================================
  // =========== EXPOREMOS ALGUMAS FUNÇÕES ========
  // ==============================================
  // Se quiser que outras partes do site possam chamar as funções:
  window.meuScriptLocalStorage = {
    readBrowserId,
    writeBrowserId,
  };
})();
