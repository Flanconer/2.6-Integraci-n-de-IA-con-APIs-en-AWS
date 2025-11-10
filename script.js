// script.js — Envía ip_publica y muestra el resultado devuelto por n8n
(() => {
  // ⛳ Reemplaza por tu webhook real:
  const WEBHOOK_URL = 'https://flanconer.app.n8n.cloud/webhook-test/operacion-ai';

  // Helpers
  const $ = (id) => document.getElementById(id);
  const form = $('calc-form');
  const btn = $('btnEnviar');
  const spn = $('spn');
  const estado = $('estado');
  const resultado = $('resultado');
  const alerta = $('alerta');
  const ipHidden = $('ipPublica');

  // ---- IP Pública (obligatoria para tu flujo) ----
  // Intento principal: ipify (CORS-friendly)
  async function fetchIPViaIpify() {
    const r = await fetch('http://34.237.140.168/ops', { cache: 'no-store' });
    if (!r.ok) throw new Error('ipify no respondió.');
    const { ip } = await r.json();
    if (!ip) throw new Error('ipify no devolvió IP.');
    return ip;
  }
  // Fallback: icanhazip (devuelve texto plano)
  async function fetchIPViaIcanhaz() {
    const r = await fetch('https://ipv4.icanhazip.com/', { cache: 'no-store' });
    if (!r.ok) throw new Error('icanhazip no respondió.');
    const text = (await r.text()).trim();
    if (!text) throw new Error('icanhazip vacío.');
    return text;
  }
  // Asegura IP antes de enviar
  async function ensurePublicIP() {
    if (ipHidden.value) return ipHidden.value;
    try {
      ipHidden.value = await fetchIPViaIpify();
      return ipHidden.value;
    } catch {
      // fallback
    }
    try {
      ipHidden.value = await fetchIPViaIcanhaz();
      return ipHidden.value;
    } catch {
      // si todo falla, no mandamos la solicitud porque tu JSON depende de este campo
      throw new Error('No se pudo obtener la IP pública del cliente.');
    }
  }

  // Normaliza respuesta de n8n (soporta JSON plano o {items:[{json:{...}}]})
  function extractPayload(any) {
    if (any?.items?.length) {
      const j = any.items[0]?.json ?? any.items[0];
      return j || any;
    }
    if (any && any.data) return any.data;
    return any;
  }

  // Toma el valor del resultado sin importar la clave
  function pickResult(payload) {
    const p = extractPayload(payload);
    return p?.resultado ?? p?.res ?? p?.value ?? p?.output ?? p?.answer ?? null;
  }

  function setLoading(on) {
    btn.disabled = on;
    spn.classList.toggle('d-none', !on);
  }

  function showAlert(type, msg) {
    alerta.className = `alert alert-${type}`;
    alerta.textContent = msg;
    alerta.classList.remove('d-none');
  }

  function hideAlert() {
    alerta.classList.add('d-none');
  }

  // Precarga IP (no bloqueante), pero en el submit nos aseguramos de tenerla
  (async () => {
    try {
      ipHidden.value = await fetchIPViaIpify();
    } catch {
      // silenciar; el submit hará el ensure con fallback
    }
  })();

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    hideAlert();
    estado.textContent = 'Procesando...';
    resultado.textContent = '';
    setLoading(true);

    try {
      // 1) Asegura IP pública (requerida por tu flujo)
      const ip = await ensurePublicIP();

      // 2) Construye body
      const body = {
        instruccion: $('instruccion').value.trim(),
        a: $('a').value === '' ? null : Number($('a').value),
        b: $('b').value === '' ? null : Number($('b').value),
        ip_publica: ip,
        ts: new Date().toISOString()
      };

      if (!body.instruccion) {
        setLoading(false);
        estado.textContent = 'Escribe una instrucción.';
        return;
      }

      // 3) POST a n8n
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      const value = pickResult(data);
      if (value === null || typeof value === 'undefined') {
        estado.textContent = 'No se recibió un resultado del flujo.';
        showAlert('warning', 'El flujo respondió sin el campo "resultado". Revisa el mapeo en n8n.');
        return;
      }

      // ✅ Mostrar SOLO el resultado
      resultado.textContent = String(value);
      estado.textContent = 'Listo.';

    } catch (err) {
      console.error(err);
      estado.textContent = 'No se pudo completar la operación.';
      showAlert('danger', err?.message || 'Fallo al enviar la solicitud.');
    } finally {
      setLoading(false);
    }
  });
})();

