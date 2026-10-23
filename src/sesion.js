// Sesión individual (correo y contraseña).
// El token se guarda solo en este navegador y vence solo (el servidor decide cuántos días dura).
// Toda petición al backend lo lleva automáticamente en la cabecera Authorization.
export const BACKEND = 'https://farmbrokers-backend-production.up.railway.app';
const LLAVE = 'fb_sesion';
const MODO_CLAVE = 'fb_modo_clave'; // el equipo eligió seguir con la clave antigua (temporal)

const leerLS = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const guardarLS = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} };

export function leerSesion() {
  try {
    const s = JSON.parse(leerLS(LLAVE) || 'null');
    if (!s || !/^[a-f0-9]{64}$/.test(s.token || '') || !s.usuario) return null;
    if (s.expira && new Date(s.expira).getTime() < Date.now()) { guardarLS(LLAVE, ''); return null; }
    return s;
  } catch (e) { return null; }
}
export const haySesion = () => !!leerSesion();
export const usuarioSesion = () => { const s = leerSesion(); return s ? s.usuario : null; };
export function guardarSesion(s) { guardarLS(LLAVE, s ? JSON.stringify(s) : ''); if (s) guardarLS(MODO_CLAVE, ''); }
export function actualizarUsuarioSesion(u) { const s = leerSesion(); if (s && u) guardarSesion({ ...s, usuario: u }); }
export const modoClave = () => leerLS(MODO_CLAVE) === '1';
export const elegirModoClave = (si) => guardarLS(MODO_CLAVE, si ? '1' : '');

function baseBackend() { return (leerLS('fb_backend') || BACKEND).replace(/\/$/, ''); }
const esDelBackend = (u) => !!u && (u.startsWith(BACKEND) || u.startsWith(baseBackend()));

// Una sola vez: agrega el token a cada petición al backend y, si el servidor dice que la sesión venció, avisa
if (typeof window !== 'undefined' && !window.__fbSesionParcheada) {
  window.__fbSesionParcheada = true;
  const original = window.fetch.bind(window);
  window.fetch = async (url, opts) => {
    let u = '';
    try { u = typeof url === 'string' ? url : url instanceof URL ? url.href : (url && url.url) || ''; } catch (e) {}
    const s = esDelBackend(u) ? leerSesion() : null;
    if (!s) return original(url, opts);
    const o = { ...(opts || {}) };
    if (o.headers instanceof Headers) { const h = new Headers(o.headers); if (!h.has('Authorization')) h.set('Authorization', `Bearer ${s.token}`); o.headers = h; }
    else if (!(o.headers && (o.headers.Authorization || o.headers.authorization))) o.headers = { ...(o.headers || {}), Authorization: `Bearer ${s.token}` };
    const r = await original(url, o);
    if (r.status === 401) {
      r.clone().json().then((d) => {
        if (d && d.sesion) { guardarSesion(null); window.dispatchEvent(new CustomEvent('fb-sesion-vencida', { detail: d.error || '' })); }
      }).catch(() => {});
    }
    return r;
  };
}

async function pedir(ruta, cuerpo, metodo) {
  const r = await fetch(`${BACKEND}/auth${ruta}`, {
    method: metodo || (cuerpo ? 'POST' : 'GET'),
    headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Error ${r.status} al conectar con el servidor.`);
  return d;
}
export const authApi = {
  estado: () => pedir('/estado'),
  entrar: async (email, clave) => { const d = await pedir('/login', { email, clave }); guardarSesion(d); return d; },
  primerAdmin: async (datos) => { const d = await pedir('/primer-admin', datos); if (d.token) guardarSesion(d); return d; },
  cambiarClave: (actual, nueva) => pedir('/cambiar-clave', { actual, nueva }),
  usuarios: () => pedir('/usuarios'),
  crearUsuario: (datos) => pedir('/usuarios', datos),
  editarUsuario: (id, datos) => pedir(`/usuarios/${encodeURIComponent(id)}`, datos, 'PUT'),
  olvide: (email) => pedir('/olvide', { email }),
  restablecer: async (token, nueva) => { const d = await pedir('/restablecer', { token, nueva }); guardarSesion(d); return d; },
  recuperarAdmin: async (email, claveAdmin, nueva) => { const d = await pedir('/recuperar-admin', { email, claveAdmin, nueva }); guardarSesion(d); return d; },
  salir: async () => { try { await pedir('/logout', {}); } catch (e) {} guardarSesion(null); },
};
