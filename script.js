// script.js — Muestra el resultado devuelto por n8n en #resultado
(() => {
  // ⛳ Reemplaza por tu webhook real:
  const WEBHOOK_URL = 'https://flanconer.app.n8n.cloud/webhook-test/operacion-ai';

  // Helpers cortos
  const $ = (id) => document.getElementById(id);
  const form = $('calc-form');
  const btn = $('btnEnviar');
  const spn = $('spn');
  const estado = $('estado');
  const resultado = $('resultado');
  const alerta = $('alerta');

  // Carga IP pública (opcional)
  (async () => {
    try {
      const r = await fetch('http://98.80.206.33/ops');
      $('ipPublica').value = (await r.json()).ip || '';
    } catch {
      $('ipPublica').value = '';
    }
  })();

  // Normaliza respuesta de n8n (soporta JSON plano o {items:[{json:{...}}]})
  function extractPayload(any) {
    // n8n típico
    if (any?.items?.length) {
      const j = any.items[0]?.json ?? any.items[0];
      return j || any;
    }
    // { data: {...} }
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

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    hideAlert();
    estado.textContent = 'Procesando...';
    resultado.textContent = '';
    setLoading(true);

    // Validación mínima
    const instr = $('instruccion').value.trim();
    if (!instr) {
      estado.textContent = 'Escribe una instrucción.';
      setLoading(false);
      return;
    }

    const body = {
      instruccion: instr,
      a: $('a').value === '' ? null : Number($('a').value),
      b: $('b').value === '' ? null : Number($('b').value),
      ip_publica: $('ipPublica').value || null,
      ts: new Date().toISOString()
    };

    try {
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
        showAlert('warning', 'El flujo de n8n respondió sin el campo "resultado". Revisa el mapeo.');
        return;
      }

      // ✅ Mostrar SOLO el resultado
      resultado.textContent = String(value);
      estado.textContent = 'Listo.';

    } catch (err) {
      console.error(err);
      estado.textContent = 'Error al comunicar con n8n.';
      showAlert('danger', err?.message || 'Fallo en la solicitud.');
    } finally {
      setLoading(false);
    }
  });
})();
