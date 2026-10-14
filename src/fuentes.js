// Fuentes externas (SII, CIREN, SIT Rural, DGA, Open-Meteo, mindicador…): tiempo máximo de espera,
// un reintento y aviso claro en pantalla cuando una fuente falla, para poder generar el informe igual.

export const DATOS_FUENTE = {
  SII: 'Datos del SII (propietario, avalúo y polígono del rol)',
  CIREN: 'Suelos, plantaciones y plano de CIREN',
  SITRURAL: 'Capas de SIT Rural (catastro frutícola y uso de suelo)',
  DGA: 'Derechos de agua y decretos de escasez (DGA)',
  'Open-Meteo': 'Clima y altitud (Open-Meteo)',
  mindicador: 'Valor de la UF (mindicador.cl)',
  Distancias: 'Distancias a Santiago y a la comuna',
  Energia: 'Líneas y subestaciones eléctricas cercanas',
  INIA: 'Información agronómica (INIA)',
  Comparables: 'Referencias de mercado',
  Normativa: 'Normativa solar',
  'Google Maps': 'Imagen satelital de Google',
};

// Avisa a la pantalla: { tipo: 'falla' | 'ok', fuente, detalle }
export function avisarFuente(fuente, detalle) { window.dispatchEvent(new CustomEvent('fb-fuente', { detail: { tipo: 'falla', fuente, detalle: detalle || '' } })); }
export function fuenteOk(fuente) { window.dispatchEvent(new CustomEvent('fb-fuente', { detail: { tipo: 'ok', fuente } })); }

// Mezcla un aviso en la lista guardada en la tasación (texto JSON)
export function aplicarAviso(lista, ev) {
  let l = []; try { l = JSON.parse(lista || '[]'); } catch (e) { l = []; }
  if (!Array.isArray(l)) l = [];
  l = l.filter((x) => x.fuente !== ev.fuente);
  if (ev.tipo === 'falla') l.push({ fuente: ev.fuente, dato: DATOS_FUENTE[ev.fuente] || ev.fuente, detalle: String(ev.detalle || '').slice(0, 200), fecha: new Date().toISOString() });
  return JSON.stringify(l);
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const motivoDe = (e, status) => (status ? (status === 429 ? 'está recibiendo demasiadas consultas' : `respondió con error ${status}`) : e && e.name === 'AbortError' ? 'no respondió a tiempo' : 'no se pudo conectar');

// fetch con tiempo máximo y reintento. Si al final falla, avisa y lanza un error con mensaje claro.
export async function fetchFuente(fuente, url, opciones = {}, { timeoutMs = 20000, reintentos = 1 } = {}) {
  let ultimo = null, status = 0;
  for (let i = 0; i <= reintentos; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { ...opciones, signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429 && r.status !== 408)) { if (r.ok) fuenteOk(fuente); return r; }
      status = r.status; ultimo = null;
    } catch (e) { clearTimeout(t); ultimo = e; status = 0; }
    if (i < reintentos) await esperar(1500 * (i + 1));
  }
  const motivo = motivoDe(ultimo, status);
  avisarFuente(fuente, `${motivo} (se reintentó ${reintentos} ${reintentos === 1 ? 'vez' : 'veces'})`);
  throw new Error(`${DATOS_FUENTE[fuente] || fuente}: la fuente ${motivo}. Puedes generar el informe igual y completar este dato a mano.`);
}

// Carga una imagen (capas de mapas) con tiempo máximo y un reintento; si falla avisa y devuelve null
export async function imagenFuente(fuente, url, { timeoutMs = 25000, reintentos = 1 } = {}) {
  for (let i = 0; i <= reintentos; i++) {
    const im = await new Promise((res) => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      const t = setTimeout(() => { img.src = ''; res(null); }, timeoutMs);
      img.onload = () => { clearTimeout(t); res(img); };
      img.onerror = () => { clearTimeout(t); res(null); };
      img.src = url + (i ? `${url.includes('?') ? '&' : '?'}_r=${i}` : '');
    });
    if (im) { fuenteOk(fuente); return im; }
    if (i < reintentos) await esperar(1500);
  }
  avisarFuente(fuente, 'la imagen del mapa no se pudo descargar');
  return null;
}

// Qué fuente consulta cada ruta del servidor
export const FUENTE_DE_RUTA = {
  '/buscar-propietario': 'SII', '/buscar-rol': 'SII', '/poligono-catastral': 'SII',
  '/suelos-rol': 'CIREN', '/leyenda-ciren': 'CIREN', '/deslindes': 'CIREN',
  '/img-sitrural': 'SITRURAL', '/derechos-agua': 'DGA', '/escasez': 'DGA',
  '/distancias': 'Distancias', '/energia-cercana': 'Energia', '/consultar-inia': 'INIA',
  '/buscar-comparables': 'Comparables', '/consultar-normativa-solar': 'Normativa',
};

// Imagen que pasa por el servidor (necesita la sesión): se descarga con fetch y se convierte en imagen local
export async function imagenPorServidor(fuente, url, { timeoutMs = 30000 } = {}) {
  try {
    const r = await fetchFuente(fuente, url, {}, { timeoutMs });
    if (!r.ok || !/^image\//.test(r.headers.get('content-type') || '')) { avisarFuente(fuente, 'la capa del mapa no está disponible'); return null; }
    const obj = URL.createObjectURL(await r.blob());
    return await new Promise((res) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = obj; });
  } catch (e) { return null; }
}
