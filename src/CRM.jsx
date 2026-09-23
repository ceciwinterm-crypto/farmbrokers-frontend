// CRM.jsx — Farm Brokers v2: campos, clientes, match automático, tasaciones y seguimiento del equipo
import { useEffect, useMemo, useRef, useState } from 'react';

// ⚠️ Cambia esta dirección por la URL de tu backend en Railway (la misma que usa la plataforma)
const API_BASE = 'https://TU-BACKEND.up.railway.app';
const SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

const REG_NOMBRE = { XV: 'Arica', I: 'Tarapacá', II: 'Antofagasta', III: 'Atacama', IV: 'Coquimbo', V: 'Valparaíso', RM: 'Metropolitana', VI: "O'Higgins",
  VII: 'Maule', XVI: 'Ñuble', VIII: 'Biobío', IX: 'Araucanía', XIV: 'Los Ríos', X: 'Los Lagos', XI: 'Aysén', XII: 'Magallanes' };
const TIPOS = { agricola: 'Agrícola', loteo: 'Loteo / parcelas', urbano: 'Urbano', forestal: 'Forestal', conservacion: 'Conservación', energia: 'Energía' };
const CERRADAS_TAS = ['Pagada', 'Perdida'];

const hoyISO = () => new Date().toLocaleDateString('en-CA');
const fmtFecha = (iso) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : '');
const fmtFechaHora = (iso) => new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtNum = (n) => Number(n).toLocaleString('es-CL', { maximumFractionDigits: 1 });
const fmtPrecio = (c) => (c.precioUF ? `UF ${fmtNum(c.precioUF)}` : c.precioCLP ? `$${fmtNum(c.precioCLP / 1e6)} MM` : c.precioTexto || '');
const plural = (n, s, p) => `${n} ${n === 1 ? s : p || s + 's'}`;
const emailsDe = (t) => (String(t || '').match(/[^\s,;<>]+@[^\s,;<>]+\.[a-z]{2,}/gi) || []);
const fonoWa = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.length === 9 && d[0] === '9' ? '56' + d : d.length === 11 && d.startsWith('569') ? d : ''; };
function leerLocal(k, d = '') { try { return localStorage.getItem(k) || d; } catch { return d; } }
function guardarLocal(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }

function mensajeCampo(c, usuario, cli) {
  const saludo = cli && cli.contactoNombre ? `Hola ${cli.contactoNombre.split(' ')[0]},` : 'Hola,';
  const lineas = [
    saludo, '', 'Te comparto un campo que calza con lo que estás buscando:', '',
    `${c.nombre}${c.sector ? `, ${c.sector}` : ''}${c.region ? ` (${REG_NOMBRE[c.region] || c.region})` : ''}`,
    [c.hectareas ? `${fmtNum(c.hectareas)} ha` : '', c.agua ? `agua: ${c.agua}` : ''].filter(Boolean).join(', '),
    c.plantaciones ? `Plantaciones: ${c.plantaciones}` : '',
    fmtPrecio(c) ? `Precio: ${fmtPrecio(c)}` : '',
    c.linkWeb || c.linkPortal || '', '', '¿Te interesa verlo? Coordinamos una visita cuando quieras.', '', usuario, 'Farm Brokers Chile',
  ];
  return lineas.filter((l, i) => l !== '' || lineas[i - 1] !== '').join('\n');
}

function useApi(clave, usuario) {
  return async (ruta, opciones = {}) => {
    const r = await fetch(`${API_BASE}/api/crm${ruta}`, {
      ...opciones,
      headers: { 'Content-Type': 'application/json', 'x-crm-key': clave, 'x-crm-user': encodeURIComponent(usuario) },
      body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Error ${r.status} al conectar con el servidor.`);
    return data;
  };
}

// ════════════════════════════ Raíz ════════════════════════════
export default function CRM() {
  const [clave, setClave] = useState(leerLocal('fbcrm_clave'));
  const [usuario, setUsuario] = useState(leerLocal('fbcrm_usuario'));
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [vista, setVista] = useState('agenda');
  const [abierto, setAbierto] = useState(null); // {col, item}
  const [importando, setImportando] = useState(false);
  const api = useApi(clave, usuario);

  const cargar = async () => {
    try { setError(''); setDatos(await api('/')); }
    catch (e) { setError(e.message); if (/clave/i.test(e.message)) { setClave(''); guardarLocal('fbcrm_clave', ''); } }
  };
  useEffect(() => { if (clave && usuario) cargar(); }, [clave, usuario]);
  useEffect(() => {
    if (!clave || !usuario) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') cargar(); }, 60000);
    return () => clearInterval(t);
  }, [clave, usuario]);

  if (!clave || !usuario) return <Acceso error={error} onEntrar={(c, u) => { guardarLocal('fbcrm_clave', c); guardarLocal('fbcrm_usuario', u); setClave(c); setUsuario(u); }} />;

  const guardar = async (col, obj) => {
    const r = obj.id ? await api(`/${col}/${obj.id}`, { method: 'PUT', body: obj }) : await api(`/${col}`, { method: 'POST', body: obj });
    await cargar(); return r;
  };
  const ctx = { datos, api, usuario, guardar, cargar, abrir: (col, item) => setAbierto({ col, item }) };

  return (
    <div className="fbcrm">
      <style>{CSS}</style>
      <header className="fbcrm-top">
        <div>
          <h1>Farm Brokers</h1>
          <p className="fbcrm-sub">Seguimiento del equipo · {usuario}</p>
        </div>
        <a className="fbcrm-link" href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; window.location.reload(); }}>Volver a la plataforma</a>
      </header>

      <nav className="fbcrm-tabs" role="tablist">
        {[['agenda', 'Agenda'], ['campos', 'Campos'], ['clientes', 'Clientes'], ['tasaciones', 'Tasaciones'], ['actividad', 'Actividad']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={vista === k} className={vista === k ? 'on' : ''} onClick={() => setVista(k)}>{l}</button>
        ))}
      </nav>

      {error && <p className="fbcrm-error">{error} <button onClick={cargar}>Reintentar</button></p>}
      {!datos && !error && <p className="fbcrm-vacio">Cargando…</p>}

      {datos && vista === 'agenda' && <Agenda ctx={ctx} irA={setVista} importar={() => setImportando(true)} />}
      {datos && vista === 'campos' && <ListaCampos ctx={ctx} importar={() => setImportando(true)} />}
      {datos && vista === 'clientes' && <ListaClientes ctx={ctx} />}
      {datos && vista === 'tasaciones' && <ListaTasaciones ctx={ctx} />}
      {datos && vista === 'actividad' && <Actividad ctx={ctx} />}

      {abierto?.col === 'campos' && <FichaCampo key={abierto.item.id || 'nuevo'} ctx={ctx} inicial={abierto.item} cerrar={() => setAbierto(null)} />}
      {abierto?.col === 'clientes' && <FichaCliente key={abierto.item.id || 'nuevo'} ctx={ctx} inicial={abierto.item} cerrar={() => setAbierto(null)} />}
      {abierto?.col === 'tasaciones' && <FichaTasacion key={abierto.item.id || 'nuevo'} ctx={ctx} inicial={abierto.item} cerrar={() => setAbierto(null)} />}
      {importando && <Importar ctx={ctx} cerrar={() => setImportando(false)} />}
    </div>
  );
}

function Acceso({ onEntrar, error }) {
  const [c, setC] = useState(''); const [u, setU] = useState('');
  return (
    <div className="fbcrm fbcrm-acceso">
      <style>{CSS}</style>
      <h1>Farm Brokers</h1>
      <p className="fbcrm-sub">Ingresa tu nombre y la clave del equipo. Queda guardado en este navegador.</p>
      {error && <p className="fbcrm-error">{error}</p>}
      <label>Tu nombre<input value={u} onChange={(e) => setU(e.target.value)} autoComplete="name" /></label>
      <label>Clave del equipo<input type="password" value={c} onChange={(e) => setC(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && c && u.trim() && onEntrar(c, u.trim())} /></label>
      <button className="fbcrm-primario" disabled={!c || !u.trim()} onClick={() => onEntrar(c, u.trim())}>Entrar</button>
    </div>
  );
}

// ════════════════════════════ Agenda ════════════════════════════
function pendientesEnvio(datos, campo) {
  const enviados = new Set((campo.envios || []).map((e) => e.clienteId));
  return (datos.matches[campo.id] || []).filter((m) => m.nivel === 'fuerte' && !enviados.has(m.clienteId));
}
function faltantes(datos, campo) { return datos.checklist.filter(([k]) => !(campo.checklist || {})[k]).map(([, l]) => l); }

function Agenda({ ctx, irA, importar }) {
  const { datos, abrir } = ctx;
  const hoy = hoyISO();
  const items = [
    ...datos.campos.filter((c) => datos.activas.includes(c.etapa)).map((x) => ({ col: 'campos', x, titulo: x.nombre, sub: `Campo, ${x.etapa}` })),
    ...datos.clientes.filter((c) => c.etapa === 'Activo').map((x) => ({ col: 'clientes', x, titulo: x.nombre, sub: 'Cliente' })),
    ...datos.tasaciones.filter((t) => !CERRADAS_TAS.includes(t.etapa)).map((x) => ({ col: 'tasaciones', x, titulo: x.titulo, sub: `Tasación, ${x.etapa}` })),
  ];
  const conFecha = items.filter((i) => i.x.proximaFecha).sort((a, b) => a.x.proximaFecha.localeCompare(b.x.proximaFecha));
  const grupos = [
    ['Atrasados', conFecha.filter((i) => i.x.proximaFecha < hoy), 'atrasado'],
    ['Hoy', conFecha.filter((i) => i.x.proximaFecha === hoy), 'hoy'],
    ['Próximos 7 días', conFecha.filter((i) => i.x.proximaFecha > hoy && (new Date(i.x.proximaFecha) - new Date(hoy)) / 864e5 <= 7), ''],
  ];
  const porEnviar = datos.campos.filter((c) => datos.ofrecibles.includes(c.etapa)).map((c) => ({ c, n: pendientesEnvio(datos, c).length })).filter((p) => p.n).sort((a, b) => b.n - a.n);
  const conFaltas = datos.campos.filter((c) => ['Documentación', 'Mandato firmado', 'Publicado', 'En negociación'].includes(c.etapa)).map((c) => ({ c, f: faltantes(datos, c) })).filter((p) => p.f.length);
  const sinAccion = items.filter((i) => i.col !== 'clientes' && !i.x.proximaFecha);
  const porCompletar = datos.clientes.filter((c) => c.revisar && c.etapa === 'Activo');

  if (!datos.campos.length && !datos.clientes.length) return (
    <div className="fbcrm-bienvenida">
      <h2>Empieza cargando la planilla</h2>
      <p>Descarga el Google Sheet de Daniel como Excel (Archivo → Descargar → Microsoft Excel) y súbelo aquí. Se importan los campos, los clientes con sus requerimientos, la captación y la prospección.</p>
      <button className="fbcrm-primario" onClick={importar}>Importar planilla</button>
    </div>
  );

  return (
    <section>
      {grupos.every(([, l]) => !l.length) && <p className="fbcrm-vacio">No hay seguimientos con fecha. Define la próxima acción en cada campo, cliente o tasación y aparecerá aquí.</p>}
      {grupos.map(([titulo, lista, clase]) => lista.length > 0 && (
        <div key={titulo} className="fbcrm-grupo">
          <h2>{titulo} <span>{lista.length}</span></h2>
          {lista.map((i) => (
            <button key={i.col + i.x.id} className={`fbcrm-fila ${clase}`} onClick={() => abrir(i.col, i.x)}>
              <span className="fbcrm-fecha">{fmtFecha(i.x.proximaFecha)}</span>
              <span className="fbcrm-cuerpo"><strong>{i.x.proximaAccion || 'Definir acción'}</strong><small>{i.titulo}, {i.sub}{i.x.responsable ? `, ${i.x.responsable}` : ''}</small></span>
            </button>
          ))}
        </div>
      ))}

      {porEnviar.length > 0 && (
        <details className="fbcrm-aviso" open>
          <summary><strong>Campos por enviar</strong> <span>{plural(porEnviar.reduce((s, p) => s + p.n, 0), 'cliente')} que calzan aún no los reciben</span></summary>
          {porEnviar.map(({ c, n }) => (
            <button key={c.id} className="fbcrm-fila" onClick={() => abrir('campos', c)}>
              <span className="fbcrm-cuerpo"><strong>{c.nombre}</strong><small>{[c.sector, c.hectareas ? `${fmtNum(c.hectareas)} ha` : '', fmtPrecio(c)].filter(Boolean).join(', ')}</small></span>
              <span className="fbcrm-badge">{plural(n, 'cliente')}</span>
            </button>
          ))}
        </details>
      )}
      {conFaltas.length > 0 && (
        <details className="fbcrm-aviso">
          <summary><strong>Documentos pendientes</strong> <span>{plural(conFaltas.length, 'campo')} con documentos sin marcar</span></summary>
          {conFaltas.map(({ c, f }) => (
            <button key={c.id} className="fbcrm-fila" onClick={() => abrir('campos', c)}>
              <span className="fbcrm-cuerpo"><strong>{c.nombre}</strong><small>Falta: {f.join(', ')}</small></span>
            </button>
          ))}
        </details>
      )}
      {sinAccion.length > 0 && (
        <details className="fbcrm-aviso">
          <summary><strong>Sin próxima acción</strong> <span>{plural(sinAccion.length, 'campo o tasación', 'campos o tasaciones')} en curso sin fecha de seguimiento</span></summary>
          {sinAccion.map((i) => (
            <button key={i.col + i.x.id} className="fbcrm-fila" onClick={() => abrir(i.col, i.x)}>
              <span className="fbcrm-cuerpo"><strong>{i.titulo}</strong><small>{i.sub}</small></span>
            </button>
          ))}
        </details>
      )}
      {porCompletar.length > 0 && (
        <details className="fbcrm-aviso">
          <summary><strong>Clientes por completar</strong> <span>{plural(porCompletar.length, 'cliente')} sin datos suficientes para el match</span></summary>
          {porCompletar.map((c) => (
            <button key={c.id} className="fbcrm-fila" onClick={() => abrir('clientes', c)}>
              <span className="fbcrm-cuerpo"><strong>{c.nombre}</strong><small>{c.requerimiento || 'Sin requerimiento'}</small></span>
            </button>
          ))}
        </details>
      )}
      <p className="fbcrm-pie"><button className="fbcrm-texto" onClick={() => irA('actividad')}>Ver lo que ha hecho el equipo</button></p>
    </section>
  );
}

// ════════════════════════════ Campos ════════════════════════════
function ListaCampos({ ctx, importar }) {
  const { datos, abrir, usuario } = ctx;
  const [filtro, setFiltro] = useState('activos');
  const [q, setQ] = useState('');
  const FILTROS = { activos: ['Activos', datos.activas], captacion: ['Captación', ['Prospección', 'Captación', 'Documentación']], publicados: ['Publicados', ['Mandato firmado', 'Publicado', 'En negociación']], cerrados: ['Cerrados', ['Vendido', 'Arrendado', 'Suspendido', 'Descartado']], todos: ['Todos', datos.etapas.campos] };
  const nq = q.toLowerCase();
  const lista = datos.campos.filter((c) => FILTROS[filtro][1].includes(c.etapa) &&
    (!nq || [c.nombre, c.sector, c.codigo, c.rol, c.plantaciones, c.aptitud, c.propietario, REG_NOMBRE[c.region]].join(' ').toLowerCase().includes(nq)));
  const etapas = datos.etapas.campos.filter((e) => FILTROS[filtro][1].includes(e));
  return (
    <section>
      <div className="fbcrm-barra">
        <div className="fbcrm-chips">{Object.entries(FILTROS).map(([k, [l]]) => <button key={k} className={filtro === k ? 'on' : ''} onClick={() => setFiltro(k)}>{l}</button>)}</div>
        <div className="fbcrm-chips">
          <button onClick={importar}>Importar planilla</button>
          <button className="fbcrm-primario" onClick={() => abrir('campos', { etapa: 'Captación', tipo: 'agricola', responsable: usuario })}>Nuevo campo</button>
        </div>
      </div>
      <input className="fbcrm-buscar" placeholder="Buscar por nombre, comuna, código, rol, plantación o propietario" value={q} onChange={(e) => setQ(e.target.value)} />
      {!lista.length && <p className="fbcrm-vacio">{datos.campos.length ? 'Ningún campo coincide con el filtro.' : 'Aún no hay campos. Importa la planilla o usa “Nuevo campo”.'}</p>}
      {etapas.map((et) => {
        const de = lista.filter((c) => c.etapa === et);
        if (!de.length) return null;
        return (
          <div key={et} className="fbcrm-grupo">
            <h2>{et} <span>{de.length}</span></h2>
            {de.map((c) => {
              const nM = (datos.matches[c.id] || []).filter((m) => m.nivel === 'fuerte').length;
              return (
                <button key={c.id} className="fbcrm-fila" onClick={() => abrir('campos', c)}>
                  <span className="fbcrm-cuerpo">
                    <strong>{c.nombre}</strong>
                    <small>{[c.sector, c.region && (REG_NOMBRE[c.region] || c.region), c.hectareas ? `${fmtNum(c.hectareas)} ha` : '', c.plantaciones || c.aptitud].filter(Boolean).join(', ')}</small>
                  </span>
                  <span className="fbcrm-der">
                    <span className="fbcrm-valor">{fmtPrecio(c)}</span>
                    {nM > 0 && <span className="fbcrm-badge">{nM} calzan</span>}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

function FichaCampo({ ctx, inicial, cerrar }) {
  const { datos, api, usuario, guardar, abrir, cargar } = ctx;
  const [f, setF] = useState({ checklist: {}, ...inicial });
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [verDatos, setVerDatos] = useState(!inicial.id);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const esNuevo = !f.id;

  const grabar = async (extra = {}) => {
    setOcupado(true); setMsg('');
    try { const r = await guardar('campos', { ...f, ...extra }); setF(r); setMsg(esNuevo ? 'Campo creado. Ya puedes ver a qué clientes les calza.' : 'Guardado.'); }
    catch (e) { setMsg(e.message); }
    setOcupado(false);
  };
  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar ${f.nombre} con todo su historial?`)) return;
    try { await api(`/campos/${f.id}`, { method: 'DELETE' }); await cargar(); cerrar(); } catch (e) { setMsg(e.message); }
  };

  return (
    <Hoja titulo={esNuevo ? 'Nuevo campo' : f.nombre} sub={esNuevo ? '' : [f.codigo, f.sector, f.region && REG_NOMBRE[f.region], f.hectareas && `${fmtNum(f.hectareas)} ha`, fmtPrecio(f)].filter(Boolean).join(', ')} cerrar={cerrar}>
      {!esNuevo && <Etapas lista={datos.etapas.campos} actual={f.etapa} ocupado={ocupado} onCambio={(et) => grabar({ etapa: et })} />}
      {!esNuevo && <Match ctx={ctx} campo={f} setCampo={setF} />}
      {!esNuevo && (
        <div className="fbcrm-bloque">
          <h3>Documentos <span>{datos.checklist.filter(([k]) => f.checklist[k]).length} de {datos.checklist.length}</span></h3>
          <div className="fbcrm-check">
            {datos.checklist.map(([k, l]) => (
              <label key={k} className={f.checklist[k] ? 'ok' : ''}>
                <input type="checkbox" checked={!!f.checklist[k]} disabled={ocupado} onChange={() => grabar({ checklist: { ...f.checklist, [k]: !f.checklist[k] } })} />{l}
              </label>
            ))}
          </div>
        </div>
      )}
      {!esNuevo && <Seguimiento f={f} setF={setF} ocupado={ocupado} onGuardar={() => grabar()} />}

      <div className="fbcrm-bloque">
        {!esNuevo && <button className="fbcrm-plegable" aria-expanded={verDatos} onClick={() => setVerDatos(!verDatos)}>{verDatos ? 'Ocultar datos del campo' : 'Ver y editar datos del campo'}</button>}
        {verDatos && (
          <>
            <div className="fbcrm-form">
              <Campo label="Nombre" ancho><input value={f.nombre || ''} onChange={set('nombre')} placeholder="Ej. Fundo Mahuidanche" /></Campo>
              <Campo label="Tipo"><select value={f.tipo || 'agricola'} onChange={set('tipo')}>{Object.entries(TIPOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Campo>
              {esNuevo && <Campo label="Etapa"><select value={f.etapa} onChange={set('etapa')}>{datos.etapas.campos.map((e) => <option key={e}>{e}</option>)}</select></Campo>}
              <Campo label="Código"><input value={f.codigo || ''} onChange={set('codigo')} /></Campo>
              <Campo label="Rol SII"><input value={f.rol || ''} onChange={set('rol')} placeholder="28-95" /></Campo>
              <Campo label="Región"><select value={f.region || ''} onChange={set('region')}><option value="">Sin región</option>{datos.regiones.map((r) => <option key={r} value={r}>{r}, {REG_NOMBRE[r]}</option>)}</select></Campo>
              <Campo label="Comuna o sector"><input value={f.sector || ''} onChange={set('sector')} /></Campo>
              <Campo label="Hectáreas"><input type="number" inputMode="decimal" value={f.hectareas ?? ''} onChange={set('hectareas')} /></Campo>
              <Campo label="Precio en UF"><input type="number" inputMode="decimal" value={f.precioUF ?? ''} onChange={set('precioUF')} /></Campo>
              <Campo label="Precio en pesos"><input type="number" inputMode="numeric" value={f.precioCLP ?? ''} onChange={set('precioCLP')} /></Campo>
              <Campo label="Precio (texto de la planilla)"><input value={f.precioTexto || ''} onChange={set('precioTexto')} /></Campo>
              <Campo label="Derechos de agua"><input value={f.agua || ''} onChange={set('agua')} placeholder="Ej. 31 l/s" /></Campo>
              <Campo label="Fuente del agua"><input value={f.fuenteAgua || ''} onChange={set('fuenteAgua')} /></Campo>
              <Campo label="Plantaciones" ancho><input value={f.plantaciones || ''} onChange={set('plantaciones')} placeholder="Ej. 40 ha almendros, 20 ha nogales" /></Campo>
              <Campo label="Aptitud" ancho><input value={f.aptitud || ''} onChange={set('aptitud')} placeholder="Ej. paltos, cítricos, uva de mesa" /></Campo>
              <Campo label="Propietario o contacto"><input value={f.propietario || ''} onChange={set('propietario')} /></Campo>
              <Campo label="Teléfono"><input type="tel" value={f.telefono || ''} onChange={set('telefono')} /></Campo>
              <Campo label="Email"><input type="email" value={f.email || ''} onChange={set('email')} /></Campo>
              <Campo label="Corredor"><input value={f.corredor || ''} onChange={set('corredor')} /></Campo>
              <Campo label="Asociado"><input value={f.asociado || ''} onChange={set('asociado')} /></Campo>
              <Campo label="Link web" ancho><input value={f.linkWeb || ''} onChange={set('linkWeb')} placeholder="https://farmbrokers.cl/propiedad/…" /></Campo>
              <Campo label="Link portal" ancho><input value={f.linkPortal || ''} onChange={set('linkPortal')} /></Campo>
              <Campo label="Observaciones" ancho><textarea rows={3} value={f.observaciones || ''} onChange={set('observaciones')} /></Campo>
            </div>
            <div className="fbcrm-acciones">
              <button className="fbcrm-primario" disabled={ocupado || !f.nombre} onClick={() => grabar()}>{esNuevo ? 'Crear campo' : 'Guardar datos'}</button>
              {!esNuevo && <button className="fbcrm-peligro" onClick={eliminar}>Eliminar campo</button>}
              {(f.linkWeb || f.linkPortal) && <a className="fbcrm-link" href={f.linkWeb || f.linkPortal} target="_blank" rel="noreferrer">Abrir publicación</a>}
            </div>
          </>
        )}
        {msg && <p className="fbcrm-msg" role="status">{msg}</p>}
      </div>
      {!esNuevo && <Historial col="campos" f={f} setF={setF} api={api} cargar={cargar} />}
    </Hoja>
  );
}

function Match({ ctx, campo, setCampo }) {
  const { datos, api, usuario, cargar, abrir } = ctx;
  const lista = datos.matches[campo.id] || [];
  const enviados = useMemo(() => {
    const m = {}; for (const e of campo.envios || []) m[e.clienteId] = e; return m;
  }, [campo.envios]);
  const [sel, setSel] = useState(() => new Set(lista.filter((m) => m.nivel === 'fuerte' && !enviados[m.clienteId]).map((m) => m.clienteId)));
  const [verParciales, setVerParciales] = useState(false);
  const [msg, setMsg] = useState('');
  const cli = (id) => datos.clientes.find((c) => c.id === id) || {};
  const ofrecible = datos.ofrecibles.includes(campo.etapa);

  const registrar = async (ids, canal) => {
    try { const r = await api(`/campos/${campo.id}/envio`, { method: 'POST', body: { clienteIds: ids, canal } }); setCampo(r); await cargar(); setSel(new Set()); }
    catch (e) { setMsg(e.message); }
  };
  const enviarCorreo = () => {
    const ids = [...sel].filter((id) => emailsDe(cli(id).email).length);
    const correos = [...new Set(ids.flatMap((id) => emailsDe(cli(id).email)))];
    if (!correos.length) { setMsg('Ninguno de los seleccionados tiene email registrado.'); return; }
    const sinCorreo = sel.size - ids.length;
    const asunto = `Campo en venta: ${campo.nombre}${campo.sector ? `, ${campo.sector}` : ''}`;
    window.location.href = `mailto:?bcc=${encodeURIComponent(correos.join(','))}&subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensajeCampo(campo, usuario))}`;
    registrar(ids, 'correo');
    setMsg(`Se abrió tu correo con ${plural(correos.length, 'destinatario')} en copia oculta.${sinCorreo ? ` ${plural(sinCorreo, 'cliente')} sin email: envíalos por WhatsApp.` : ''}`);
  };
  const enviarWa = (id) => {
    const c = cli(id); const n = fonoWa(c.telefono);
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(mensajeCampo(campo, usuario, c))}`, '_blank', 'noopener');
    registrar([id], 'whatsapp');
  };

  const fuertes = lista.filter((m) => m.nivel === 'fuerte'), parciales = lista.filter((m) => m.nivel === 'parcial');
  const fila = (m) => {
    const c = cli(m.clienteId), env = enviados[m.clienteId];
    return (
      <li key={m.clienteId} className={env ? 'enviado' : ''}>
        <label className="fbcrm-match-sel"><input type="checkbox" checked={sel.has(m.clienteId)} onChange={() => { const s = new Set(sel); s.has(m.clienteId) ? s.delete(m.clienteId) : s.add(m.clienteId); setSel(s); }} aria-label={`Seleccionar ${c.nombre}`} /></label>
        <div className="fbcrm-match-cuerpo">
          <button className="fbcrm-texto" onClick={() => abrir('clientes', c)}><strong>{c.nombre}</strong></button>
          <small>{m.razones.join(' · ')}</small>
          {m.alertas.length > 0 && <small className="fbcrm-alerta">{m.alertas.join(' · ')}</small>}
          {env && <small className="fbcrm-ok">Enviado {fmtFecha(env.fecha)} por {env.canal}, {env.autor}</small>}
        </div>
        {fonoWa(c.telefono) && <button className="fbcrm-mini" onClick={() => enviarWa(m.clienteId)}>WhatsApp</button>}
      </li>
    );
  };

  return (
    <div className="fbcrm-bloque fbcrm-match">
      <h3>{fuertes.length ? `Calza con ${plural(fuertes.length, 'cliente')}` : 'Sin clientes que calcen fuerte'} {parciales.length > 0 && <span>+ {parciales.length} parcial{parciales.length === 1 ? '' : 'es'}</span>}</h3>
      {!ofrecible && lista.length > 0 && <p className="fbcrm-nota-suave">El campo está en {campo.etapa}. Puedes enviarlo igual, pero lo normal es esperar el mandato firmado.</p>}
      {!lista.length && <p className="fbcrm-nota-suave">Completa región, hectáreas y plantaciones o aptitud para mejorar el match, o agrega clientes con sus requerimientos.</p>}
      <ul>{fuertes.map(fila)}</ul>
      {parciales.length > 0 && <button className="fbcrm-plegable" aria-expanded={verParciales} onClick={() => setVerParciales(!verParciales)}>{verParciales ? 'Ocultar calces parciales' : `Ver ${plural(parciales.length, 'calce parcial', 'calces parciales')}`}</button>}
      {verParciales && <ul>{parciales.map(fila)}</ul>}
      {lista.length > 0 && (
        <div className="fbcrm-acciones">
          <button className="fbcrm-primario" disabled={!sel.size} onClick={enviarCorreo}>Enviar correo a {plural(sel.size, 'seleccionado')}</button>
          <button className="fbcrm-texto" onClick={() => navigator.clipboard && navigator.clipboard.writeText(mensajeCampo(campo, usuario)).then(() => setMsg('Mensaje copiado.'))}>Copiar mensaje</button>
        </div>
      )}
      {msg && <p className="fbcrm-msg" role="status">{msg}</p>}
    </div>
  );
}

// ════════════════════════════ Clientes ════════════════════════════
function ListaClientes({ ctx }) {
  const { datos, abrir, usuario } = ctx;
  const [filtro, setFiltro] = useState('Activo');
  const [q, setQ] = useState('');
  const porCliente = useMemo(() => {
    const m = {}; for (const [cid, lista] of Object.entries(datos.matches)) {
      const campo = datos.campos.find((c) => c.id === cid);
      if (!campo || !datos.ofrecibles.includes(campo.etapa)) continue;
      for (const x of lista) if (x.nivel === 'fuerte') m[x.clienteId] = (m[x.clienteId] || 0) + 1;
    } return m;
  }, [datos]);
  const nq = q.toLowerCase();
  const lista = datos.clientes.filter((c) => (filtro === 'todos' || (filtro === 'revisar' ? c.revisar : c.etapa === filtro)) &&
    (!nq || [c.nombre, c.contactoNombre, c.requerimiento, c.zona, c.email, c.observaciones].join(' ').toLowerCase().includes(nq)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return (
    <section>
      <div className="fbcrm-barra">
        <div className="fbcrm-chips">
          {[['Activo', 'Activos'], ['revisar', 'Por completar'], ['Pausado', 'Pausados'], ['todos', 'Todos']].map(([k, l]) => <button key={k} className={filtro === k ? 'on' : ''} onClick={() => setFiltro(k)}>{l}</button>)}
        </div>
        <button className="fbcrm-primario" onClick={() => abrir('clientes', { etapa: 'Activo', operacion: 'compra', tipo: 'agricola', regiones: [], cultivos: [], responsable: usuario, fechaRequerimiento: hoyISO() })}>Nuevo cliente</button>
      </div>
      <input className="fbcrm-buscar" placeholder="Buscar por nombre, requerimiento, zona o email" value={q} onChange={(e) => setQ(e.target.value)} />
      {!lista.length && <p className="fbcrm-vacio">{datos.clientes.length ? 'Ningún cliente coincide.' : 'Aún no hay clientes. Importa la planilla o usa “Nuevo cliente”.'}</p>}
      <div className="fbcrm-grupo">
        {lista.map((c) => (
          <button key={c.id} className="fbcrm-fila" onClick={() => abrir('clientes', c)}>
            <span className="fbcrm-cuerpo">
              <strong>{c.nombre}</strong>
              <small>{[c.requerimiento, c.regiones.length ? c.regiones.join('–') : c.zona, c.haMin != null || c.haMax != null ? rangoTxt(c) : ''].filter(Boolean).join(', ')}</small>
            </span>
            <span className="fbcrm-der">
              {c.revisar && <span className="fbcrm-badge gris">Completar</span>}
              {porCliente[c.id] > 0 && <span className="fbcrm-badge">{plural(porCliente[c.id], 'campo')}</span>}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
const rangoTxt = (c) => (c.haMax == null ? `${c.haMin}+ ha` : `${c.haMin || 0}–${c.haMax} ha`);

function FichaCliente({ ctx, inicial, cerrar }) {
  const { datos, api, usuario, guardar, abrir, cargar } = ctx;
  const [f, setF] = useState({ regiones: [], cultivos: [], ...inicial });
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (k, v) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });
  const esNuevo = !f.id;
  const grabar = async (extra = {}) => {
    setOcupado(true); setMsg('');
    try { const r = await guardar('clientes', { ...f, ...extra }); setF(r); setMsg('Guardado. El match se recalculó.'); }
    catch (e) { setMsg(e.message); }
    setOcupado(false);
  };
  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar a ${f.nombre}?`)) return;
    try { await api(`/clientes/${f.id}`, { method: 'DELETE' }); await cargar(); cerrar(); } catch (e) { setMsg(e.message); }
  };
  const camposQueCalzan = esNuevo ? [] : Object.entries(datos.matches).map(([cid, l]) => ({ campo: datos.campos.find((c) => c.id === cid), m: l.find((x) => x.clienteId === f.id) }))
    .filter((x) => x.m && x.campo).sort((a, b) => b.m.score - a.m.score);
  const antiguedad = f.fechaRequerimiento ? (Date.now() - new Date(f.fechaRequerimiento.slice(0, 7) + '-15')) / (864e5 * 30.4) : 0;

  return (
    <Hoja titulo={esNuevo ? 'Nuevo cliente' : f.nombre} sub={esNuevo ? '' : f.requerimiento} cerrar={cerrar}>
      {!esNuevo && <Etapas lista={datos.etapas.clientes} actual={f.etapa} ocupado={ocupado} onCambio={(et) => grabar({ etapa: et })} />}
      {antiguedad > 24 && (
        <p className="fbcrm-aviso-linea">Requerimiento de {f.fechaRequerimiento.slice(0, 4)}. Conviene reconfirmar lo que busca. <button className="fbcrm-mini" onClick={() => grabar({ fechaRequerimiento: hoyISO() })}>Reconfirmado hoy</button></p>
      )}
      <div className="fbcrm-bloque">
        <h3>Qué busca</h3>
        <div className="fbcrm-form">
          <Campo label="Requerimiento (como lo dijo el cliente)" ancho><textarea rows={2} value={f.requerimiento || ''} onChange={set('requerimiento')} /></Campo>
          <Campo label="Tipo"><select value={f.tipo || ''} onChange={set('tipo')}><option value="">Cualquiera</option>{Object.entries(TIPOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Campo>
          <Campo label="Operación"><select value={f.operacion} onChange={set('operacion')}><option value="compra">Compra</option><option value="arriendo">Arriendo</option></select></Campo>
          <Campo label="Hectáreas mínimo"><input type="number" inputMode="decimal" value={f.haMin ?? ''} onChange={set('haMin')} /></Campo>
          <Campo label="Hectáreas máximo"><input type="number" inputMode="decimal" value={f.haMax ?? ''} onChange={set('haMax')} placeholder="Sin límite" /></Campo>
          <Campo label="Presupuesto" ancho><input value={f.presupuesto || ''} onChange={set('presupuesto')} placeholder="Ej. hasta UF 150.000" /></Campo>
          <Campo label="Zonas o comunas específicas" ancho><input value={f.zona || ''} onChange={set('zona')} placeholder="Ej. Las Cabras, Rapel, Mallarauco" /></Campo>
        </div>
        <p className="fbcrm-etq">Cultivos</p>
        <div className="fbcrm-chips">{Object.entries(datos.cultivos).map(([k, l]) => <button key={k} className={f.cultivos.includes(k) ? 'on' : ''} aria-pressed={f.cultivos.includes(k)} onClick={() => toggle('cultivos', k)}>{l}</button>)}</div>
        <p className="fbcrm-etq">Regiones</p>
        <div className="fbcrm-chips">{datos.regiones.map((r) => <button key={r} className={f.regiones.includes(r) ? 'on' : ''} aria-pressed={f.regiones.includes(r)} title={REG_NOMBRE[r]} onClick={() => toggle('regiones', r)}>{r}</button>)}</div>
      </div>
      <div className="fbcrm-bloque">
        <h3>Contacto</h3>
        <div className="fbcrm-form">
          <Campo label="Nombre o empresa" ancho><input value={f.nombre || ''} onChange={set('nombre')} /></Campo>
          <Campo label="Persona de contacto"><input value={f.contactoNombre || ''} onChange={set('contactoNombre')} /></Campo>
          <Campo label="Teléfono"><input type="tel" value={f.telefono || ''} onChange={set('telefono')} /></Campo>
          <Campo label="Email" ancho><input value={f.email || ''} onChange={set('email')} placeholder="Varios separados por coma" /></Campo>
          <Campo label="Corredor"><input value={f.corredor || ''} onChange={set('corredor')} /></Campo>
          <Campo label="Fecha del requerimiento"><input type="date" value={(f.fechaRequerimiento || '').length === 10 ? f.fechaRequerimiento : (f.fechaRequerimiento ? f.fechaRequerimiento + '-01' : '')} onChange={set('fechaRequerimiento')} /></Campo>
          <Campo label="Observaciones" ancho><textarea rows={2} value={f.observaciones || ''} onChange={set('observaciones')} /></Campo>
        </div>
        <label className="fbcrm-check-linea"><input type="checkbox" checked={!!f.revisar} onChange={() => setF({ ...f, revisar: !f.revisar })} />Marcar como “por completar”</label>
        <div className="fbcrm-acciones">
          <button className="fbcrm-primario" disabled={ocupado || !f.nombre} onClick={() => grabar()}>{esNuevo ? 'Crear cliente' : 'Guardar cambios'}</button>
          {fonoWa(f.telefono) && <a className="fbcrm-link" href={`https://wa.me/${fonoWa(f.telefono)}`} target="_blank" rel="noreferrer">WhatsApp</a>}
          {!esNuevo && <button className="fbcrm-peligro" onClick={eliminar}>Eliminar</button>}
        </div>
        {msg && <p className="fbcrm-msg" role="status">{msg}</p>}
      </div>
      {!esNuevo && <Seguimiento f={f} setF={setF} ocupado={ocupado} onGuardar={() => grabar()} />}
      {camposQueCalzan.length > 0 && (
        <div className="fbcrm-bloque">
          <h3>Campos que le calzan <span>{camposQueCalzan.length}</span></h3>
          {camposQueCalzan.map(({ campo, m }) => {
            const env = (campo.envios || []).find((e) => e.clienteId === f.id);
            return (
              <button key={campo.id} className="fbcrm-fila" onClick={() => abrir('campos', campo)}>
                <span className="fbcrm-cuerpo"><strong>{campo.nombre}</strong><small>{[campo.sector, campo.etapa, m.nivel === 'fuerte' ? 'calce fuerte' : 'calce parcial', env ? `enviado ${fmtFecha(env.fecha)}` : 'no enviado'].join(', ')}</small></span>
              </button>
            );
          })}
        </div>
      )}
      {!esNuevo && <Historial col="clientes" f={f} setF={setF} api={api} cargar={cargar} />}
    </Hoja>
  );
}

// ════════════════════════════ Tasaciones ════════════════════════════
function ListaTasaciones({ ctx }) {
  const { datos, abrir, usuario } = ctx;
  const [q, setQ] = useState('');
  const nq = q.toLowerCase();
  const lista = datos.tasaciones.filter((t) => !nq || [t.titulo, t.cliente, t.rol, t.comuna, t.codigo].join(' ').toLowerCase().includes(nq));
  return (
    <section>
      <div className="fbcrm-barra">
        <input className="fbcrm-buscar" placeholder="Buscar por cliente, rol, comuna o N° de tasación" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="fbcrm-primario" onClick={() => abrir('tasaciones', { etapa: 'Solicitud', responsable: usuario })}>Nueva tasación</button>
      </div>
      {!lista.length && <p className="fbcrm-vacio">{datos.tasaciones.length ? 'Ninguna tasación coincide.' : 'Aún no hay tasaciones registradas. Usa “Nueva tasación” para seguir la primera.'}</p>}
      {datos.etapas.tasaciones.map((et) => {
        const de = lista.filter((t) => t.etapa === et);
        if (!de.length) return null;
        return (
          <div key={et} className="fbcrm-grupo">
            <h2>{et} <span>{de.length}</span></h2>
            {de.map((t) => (
              <button key={t.id} className="fbcrm-fila" onClick={() => abrir('tasaciones', t)}>
                <span className="fbcrm-cuerpo"><strong>{t.titulo}</strong><small>{[t.cliente, t.comuna, t.rol && `Rol ${t.rol}`, t.codigo].filter(Boolean).join(', ')}</small></span>
                <span className="fbcrm-valor">{t.honorariosUF ? `UF ${fmtNum(t.honorariosUF)}` : ''}</span>
              </button>
            ))}
          </div>
        );
      })}
    </section>
  );
}

function FichaTasacion({ ctx, inicial, cerrar }) {
  const { datos, api, guardar, cargar } = ctx;
  const [f, setF] = useState(inicial);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const esNuevo = !f.id;
  const grabar = async (extra = {}) => {
    setOcupado(true); setMsg('');
    try { const r = await guardar('tasaciones', { ...f, ...extra }); setF(r); setMsg('Guardado.'); } catch (e) { setMsg(e.message); }
    setOcupado(false);
  };
  const eliminar = async () => {
    if (!window.confirm('¿Eliminar esta tasación?')) return;
    try { await api(`/tasaciones/${f.id}`, { method: 'DELETE' }); await cargar(); cerrar(); } catch (e) { setMsg(e.message); }
  };
  return (
    <Hoja titulo={esNuevo ? 'Nueva tasación' : f.titulo} sub={[f.cliente, f.codigo].filter(Boolean).join(', ')} cerrar={cerrar}>
      {!esNuevo && <Etapas lista={datos.etapas.tasaciones} actual={f.etapa} ocupado={ocupado} onCambio={(et) => grabar({ etapa: et })} />}
      <div className="fbcrm-bloque">
        <div className="fbcrm-form">
          <Campo label="Título" ancho><input value={f.titulo || ''} onChange={set('titulo')} placeholder="Ej. Tasación El Portal" /></Campo>
          <Campo label="Cliente"><input value={f.cliente || ''} onChange={set('cliente')} /></Campo>
          <Campo label="Teléfono"><input type="tel" value={f.telefono || ''} onChange={set('telefono')} /></Campo>
          <Campo label="Email" ancho><input type="email" value={f.email || ''} onChange={set('email')} /></Campo>
          <Campo label="Rol SII"><input value={f.rol || ''} onChange={set('rol')} /></Campo>
          <Campo label="Comuna"><input value={f.comuna || ''} onChange={set('comuna')} /></Campo>
          <Campo label="N° de tasación"><input value={f.codigo || ''} onChange={set('codigo')} placeholder="T-2026-001" /></Campo>
          <Campo label="Honorarios (UF)"><input type="number" inputMode="decimal" value={f.honorariosUF ?? ''} onChange={set('honorariosUF')} /></Campo>
          <Campo label="Campo relacionado" ancho>
            <select value={f.campoId || ''} onChange={set('campoId')}>
              <option value="">Ninguno</option>
              {[...datos.campos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.sector ? `, ${c.sector}` : ''}</option>)}
            </select>
          </Campo>
        </div>
        <div className="fbcrm-acciones">
          <button className="fbcrm-primario" disabled={ocupado || !f.titulo} onClick={() => grabar()}>{esNuevo ? 'Crear tasación' : 'Guardar cambios'}</button>
          {!esNuevo && <button className="fbcrm-peligro" onClick={eliminar}>Eliminar</button>}
        </div>
        {msg && <p className="fbcrm-msg" role="status">{msg}</p>}
      </div>
      {!esNuevo && <Seguimiento f={f} setF={setF} ocupado={ocupado} onGuardar={() => grabar()} />}
      {!esNuevo && <Historial col="tasaciones" f={f} setF={setF} api={api} cargar={cargar} />}
    </Hoja>
  );
}

// ════════════════════════════ Actividad ════════════════════════════
function Actividad({ ctx }) {
  const { datos, abrir } = ctx;
  if (!datos.actividad.length) return <p className="fbcrm-vacio">Todavía no hay actividad. Aquí verás lo que hace cada persona del equipo: cambios de etapa, envíos, documentos y notas.</p>;
  const ir = (ref) => { if (!ref) return; const x = (datos[ref.col] || []).find((y) => y.id === ref.id); if (x) abrir(ref.col, x); };
  return (
    <ul className="fbcrm-feed">
      {datos.actividad.map((a, i) => (
        <li key={i}>
          <span>{fmtFechaHora(a.fecha)}, {a.autor}</span>
          {a.ref ? <button className="fbcrm-texto" onClick={() => ir(a.ref)}>{a.texto}</button> : <p>{a.texto}</p>}
        </li>
      ))}
    </ul>
  );
}

// ════════════════════════════ Importar planilla ════════════════════════════
function cargarSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((ok, mal) => {
    const s = document.createElement('script'); s.src = SHEETJS;
    s.onload = () => ok(window.XLSX); s.onerror = () => mal(new Error('No se pudo cargar el lector de Excel. Revisa tu conexión.'));
    document.head.appendChild(s);
  });
}

function Importar({ ctx, cerrar }) {
  const { datos, api, cargar } = ctx;
  const [hojas, setHojas] = useState(null);
  const [archivo, setArchivo] = useState('');
  const [estado, setEstado] = useState('');
  const [resumen, setResumen] = useState(null);
  const hayDatos = datos.campos.length + datos.clientes.length > 0;
  const [modo, setModo] = useState(hayDatos ? '' : 'reemplazar');

  const leer = async (file) => {
    setEstado('Leyendo el archivo…'); setResumen(null); setArchivo(file.name);
    try {
      const XLSX = await cargarSheetJS();
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const h = wb.SheetNames.map((n) => ({ nombre: n, filas: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' }) }));
      setHojas(h); setEstado(`${plural(h.length, 'hoja')} encontrada${h.length === 1 ? '' : 's'}: ${h.map((x) => x.nombre).join(', ')}.`);
    } catch (e) { setEstado(e.message || 'No se pudo leer el archivo. Debe ser un Excel (.xlsx).'); }
  };
  const importar = async () => {
    setEstado('Importando…');
    try { const r = await api('/importar', { method: 'POST', body: { hojas, modo } }); setResumen(r.resumen); setEstado(''); await cargar(); }
    catch (e) { setEstado(e.message); }
  };

  return (
    <Hoja titulo="Importar planilla" cerrar={cerrar}>
      {!resumen && (
        <div className="fbcrm-bloque">
          <p>Descarga el Google Sheet como Excel (Archivo → Descargar → Microsoft Excel .xlsx) y elígelo aquí. Se reconocen solas las hojas de campos, clientes, captación y prospección.</p>
          <label className="fbcrm-archivo">
            <input type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files[0] && leer(e.target.files[0])} />
            <span>{archivo || 'Elegir archivo Excel'}</span>
          </label>
          {hayDatos && hojas && (
            <fieldset className="fbcrm-opciones">
              <legend>Ya hay {plural(datos.campos.length, 'campo')} y {plural(datos.clientes.length, 'cliente')} en el sistema</legend>
              <label><input type="radio" name="modo" checked={modo === 'reemplazar'} onChange={() => setModo('reemplazar')} />Reemplazar campos y clientes por los de la planilla</label>
              <label><input type="radio" name="modo" checked={modo === 'agregar'} onChange={() => setModo('agregar')} />Agregar sin borrar lo existente (puede duplicar)</label>
            </fieldset>
          )}
          {estado && <p className="fbcrm-msg" role="status">{estado}</p>}
          <div className="fbcrm-acciones">
            <button className="fbcrm-primario" disabled={!hojas || !modo} onClick={importar}>Importar</button>
          </div>
        </div>
      )}
      {resumen && (
        <div className="fbcrm-bloque">
          <h3>Importación lista</h3>
          <ul className="fbcrm-resumen">
            <li><strong>{resumen.campos}</strong> campos de la cartera</li>
            <li><strong>{resumen.captacion}</strong> campos en captación</li>
            <li><strong>{resumen.prospeccion}</strong> prospectos por rol</li>
            <li><strong>{resumen.clientes}</strong> clientes con requerimientos{resumen.clientesRevisar ? `, ${resumen.clientesRevisar} por completar` : ''}</li>
          </ul>
          {resumen.hojasIgnoradas.length > 0 && <p className="fbcrm-nota-suave">Hojas no reconocidas: {resumen.hojasIgnoradas.join(', ')}.</p>}
          <p className="fbcrm-nota-suave">Los clientes “por completar” aparecen en la Agenda: son los que no tienen suficientes datos para el match automático.</p>
          <div className="fbcrm-acciones"><button className="fbcrm-primario" onClick={cerrar}>Ver la agenda</button></div>
        </div>
      )}
    </Hoja>
  );
}

// ════════════════════════════ Piezas comunes ════════════════════════════
function Hoja({ titulo, sub, cerrar, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && cerrar();
    window.addEventListener('keydown', f); ref.current && ref.current.focus();
    return () => window.removeEventListener('keydown', f);
  }, []);
  return (
    <div className="fbcrm-velo" onClick={cerrar}>
      <div className="fbcrm-hoja" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="fbcrm-hoja-top">
          <div><h2>{titulo}</h2>{sub && <p className="fbcrm-sub">{sub}</p>}</div>
          <button onClick={cerrar}>Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Campo({ label, children, ancho }) { return <label className={ancho ? 'ancho' : ''}>{label}{children}</label>; }

function Etapas({ lista, actual, ocupado, onCambio }) {
  return (
    <ol className="fbcrm-etapas" aria-label="Etapa">
      {lista.map((et) => <li key={et}><button className={actual === et ? 'on' : ''} aria-current={actual === et ? 'step' : undefined} disabled={ocupado} onClick={() => actual !== et && onCambio(et)}>{et}</button></li>)}
    </ol>
  );
}

function Seguimiento({ f, setF, ocupado, onGuardar }) {
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="fbcrm-bloque">
      <h3>Próxima acción</h3>
      <div className="fbcrm-form">
        <Campo label="Qué hay que hacer" ancho><input value={f.proximaAccion || ''} onChange={set('proximaAccion')} placeholder="Ej. Pedir certificado de dominio vigente" /></Campo>
        <Campo label="Fecha"><input type="date" value={f.proximaFecha || ''} onChange={set('proximaFecha')} /></Campo>
        <Campo label="Responsable"><input value={f.responsable || ''} onChange={set('responsable')} /></Campo>
      </div>
      <div className="fbcrm-acciones"><button disabled={ocupado} onClick={onGuardar}>Guardar próxima acción</button></div>
    </div>
  );
}

function Historial({ col, f, setF, api, cargar }) {
  const [nota, setNota] = useState('');
  const [msg, setMsg] = useState('');
  const agregar = async () => {
    try { const r = await api(`/${col}/${f.id}/nota`, { method: 'POST', body: { texto: nota } }); setF(r); setNota(''); cargar(); } catch (e) { setMsg(e.message); }
  };
  return (
    <div className="fbcrm-bloque fbcrm-historial">
      <h3>Historial</h3>
      <div className="fbcrm-nota">
        <textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Registrar llamada, visita, acuerdo…" aria-label="Nueva nota" />
        <button disabled={!nota.trim()} onClick={agregar}>Agregar nota</button>
      </div>
      {msg && <p className="fbcrm-msg">{msg}</p>}
      <ul>{[...(f.historial || [])].reverse().map((h, i) => <li key={i}><span>{fmtFechaHora(h.fecha)}, {h.autor}</span><p>{h.texto}</p></li>)}</ul>
    </div>
  );
}

const CSS = `
.fbcrm{--bg:#F2F4F1;--papel:#FFFFFF;--tinta:#1F2B25;--verde:#3D6A4F;--verde2:#E3ECE5;--trigo:#B8892A;--trigo2:#F6EDD6;--salvia:#65736A;--linea:#D8DED8;--oxido:#9C3F2B;--oxido2:#F8E9E5;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--tinta);background:var(--bg);min-height:100vh;padding:20px 16px 60px;box-sizing:border-box;max-width:920px;margin:0 auto;line-height:1.45}
.fbcrm *{box-sizing:border-box}
.fbcrm h1{font-size:1.75rem;margin:0;letter-spacing:-.01em;font-weight:700}
.fbcrm-sub{color:var(--salvia);margin:2px 0 0;font-size:.9rem}
.fbcrm-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
.fbcrm-link{color:var(--verde);font-size:.9rem;text-decoration:underline;text-underline-offset:3px}
.fbcrm button{font:inherit;cursor:pointer;border:1px solid var(--linea);background:var(--papel);color:var(--tinta);border-radius:8px;padding:8px 12px}
.fbcrm button:disabled{opacity:.5;cursor:default}
.fbcrm button:focus-visible,.fbcrm input:focus-visible,.fbcrm select:focus-visible,.fbcrm textarea:focus-visible,.fbcrm summary:focus-visible{outline:2px solid var(--verde);outline-offset:2px}
.fbcrm-tabs{display:flex;gap:2px;border-bottom:1px solid var(--linea);margin-bottom:16px;overflow-x:auto;scrollbar-width:none}
.fbcrm-tabs button{border:0;background:none;border-radius:0;padding:10px 12px;color:var(--salvia);border-bottom:3px solid transparent;margin-bottom:-1px;white-space:nowrap}
.fbcrm-tabs button.on{color:var(--tinta);border-bottom-color:var(--verde);font-weight:600}
.fbcrm .fbcrm-primario{background:var(--verde);color:#fff;border-color:var(--verde);font-weight:600}
.fbcrm .fbcrm-peligro{color:var(--oxido);border-color:transparent;background:none}
.fbcrm .fbcrm-texto{border:0;background:none;padding:0;color:var(--verde);text-align:left;text-decoration:underline;text-underline-offset:3px}
.fbcrm .fbcrm-mini{padding:4px 10px;font-size:.85rem;flex:none}
.fbcrm-barra{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;margin-bottom:10px}
.fbcrm-chips{display:flex;gap:6px;flex-wrap:wrap}
.fbcrm-chips button{border-radius:999px;padding:6px 12px;font-size:.9rem}
.fbcrm-chips button.on{background:var(--tinta);color:#fff;border-color:var(--tinta)}
.fbcrm input,.fbcrm select,.fbcrm textarea{font:inherit;width:100%;border:1px solid var(--linea);border-radius:8px;padding:8px 10px;background:var(--papel);color:var(--tinta)}
.fbcrm input[type=checkbox],.fbcrm input[type=radio]{width:auto;accent-color:var(--verde)}
.fbcrm-buscar{margin-bottom:12px}
.fbcrm-barra .fbcrm-buscar{flex:1;min-width:200px;margin:0}
.fbcrm-grupo{margin-bottom:22px}
.fbcrm-grupo h2{font-size:1rem;margin:0 0 6px;display:flex;align-items:baseline;gap:8px}
.fbcrm-grupo h2 span,.fbcrm h3 span{color:var(--salvia);font-weight:400;font-size:.9rem}
.fbcrm .fbcrm-fila{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:0;border-bottom:1px solid var(--linea);border-radius:0;background:var(--papel);padding:12px}
.fbcrm .fbcrm-grupo .fbcrm-fila:first-of-type,.fbcrm details .fbcrm-fila:first-of-type{border-radius:8px 8px 0 0}
.fbcrm .fbcrm-grupo .fbcrm-fila:last-child,.fbcrm details .fbcrm-fila:last-child{border-radius:0 0 8px 8px;border-bottom:0}
.fbcrm .fbcrm-grupo .fbcrm-fila:only-of-type{border-radius:8px}
.fbcrm .fbcrm-fila:hover{background:var(--verde2)}
.fbcrm-cuerpo{flex:1;min-width:0;display:flex;flex-direction:column}
.fbcrm-cuerpo small{color:var(--salvia);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fbcrm-der{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:none}
.fbcrm-fecha{width:64px;flex:none;font-weight:700;font-variant-numeric:tabular-nums;font-size:1.05rem}
.fbcrm-fila.atrasado .fbcrm-fecha{color:var(--oxido)}
.fbcrm .fbcrm-fila.atrasado{box-shadow:inset 4px 0 0 var(--oxido)}
.fbcrm .fbcrm-fila.hoy{box-shadow:inset 4px 0 0 var(--trigo);background:var(--trigo2)}
.fbcrm-valor{color:var(--salvia);font-variant-numeric:tabular-nums;white-space:nowrap;font-size:.9rem}
.fbcrm-badge{background:var(--verde2);color:var(--verde);font-size:.78rem;font-weight:600;padding:2px 8px;border-radius:999px;white-space:nowrap}
.fbcrm-badge.gris{background:#ECEEEB;color:var(--salvia)}
.fbcrm-vacio{color:var(--salvia);padding:24px;background:var(--papel);border-radius:8px}
.fbcrm-error{color:var(--oxido);background:var(--oxido2);padding:10px 12px;border-radius:8px}
.fbcrm-aviso{background:var(--papel);border-radius:8px;margin-bottom:12px;border:1px solid var(--linea)}
.fbcrm-aviso summary{cursor:pointer;padding:12px;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;list-style-position:inside}
.fbcrm-aviso summary span{color:var(--salvia);font-size:.9rem}
.fbcrm-aviso[open] summary{border-bottom:1px solid var(--linea)}
.fbcrm-aviso .fbcrm-fila{border-radius:0!important}
.fbcrm-pie{margin-top:20px}
.fbcrm-bienvenida{background:var(--papel);border-radius:8px;padding:28px;max-width:560px}
.fbcrm-bienvenida h2{margin:0 0 8px;font-size:1.25rem}
.fbcrm-bienvenida p{color:var(--salvia);margin:0 0 16px}
.fbcrm-velo{position:fixed;inset:0;background:rgba(31,43,37,.35);display:flex;justify-content:flex-end;z-index:1000}
.fbcrm-hoja{background:var(--bg);width:min(620px,100%);height:100%;overflow-y:auto;padding:18px 18px 48px;outline:none}
.fbcrm-hoja-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}
.fbcrm-hoja-top h2{margin:0;font-size:1.3rem}
.fbcrm-etapas{list-style:none;padding:0;margin:0 0 14px;display:flex;flex-wrap:wrap;gap:4px}
.fbcrm-etapas button{font-size:.82rem;padding:5px 10px;border-radius:999px}
.fbcrm-etapas button.on{background:var(--verde);color:#fff;border-color:var(--verde)}
.fbcrm-bloque{background:var(--papel);border-radius:10px;padding:14px;margin-bottom:12px}
.fbcrm-bloque h3{font-size:1rem;margin:0 0 10px;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.fbcrm-bloque>p{margin:0 0 12px}
.fbcrm-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fbcrm-form label,.fbcrm-acceso label{display:flex;flex-direction:column;gap:4px;font-size:.85rem;color:var(--salvia)}
.fbcrm-form label.ancho{grid-column:1/-1}
.fbcrm-etq{font-size:.85rem;color:var(--salvia);margin:14px 0 6px}
.fbcrm-check{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px}
.fbcrm-check label,.fbcrm-check-linea{display:flex;gap:8px;align-items:center;font-size:.92rem;cursor:pointer}
.fbcrm-check label.ok{color:var(--salvia);text-decoration:line-through}
.fbcrm-check-linea{margin-top:10px;color:var(--salvia)}
.fbcrm-acciones{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px}
.fbcrm-msg{color:var(--salvia);font-size:.9rem;margin:10px 0 0}
.fbcrm-nota-suave{color:var(--salvia);font-size:.9rem;margin:0 0 10px}
.fbcrm-plegable{margin-top:10px;background:none!important;border:0!important;padding:4px 0!important;color:var(--verde)!important;text-decoration:underline;text-underline-offset:3px}
.fbcrm-aviso-linea{background:var(--trigo2);border-radius:8px;padding:10px 12px;margin:0 0 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:.92rem}
.fbcrm-match{box-shadow:inset 0 0 0 2px var(--verde2)}
.fbcrm-match ul{list-style:none;margin:0;padding:0}
.fbcrm-match li{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--linea)}
.fbcrm-match li:last-child{border-bottom:0}
.fbcrm-match li.enviado{opacity:.75}
.fbcrm-match-sel{padding-top:2px}
.fbcrm-match-cuerpo{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.fbcrm-match-cuerpo small{color:var(--salvia);font-size:.84rem}
.fbcrm-match-cuerpo .fbcrm-alerta{color:#7A5A15}
.fbcrm-match-cuerpo .fbcrm-ok{color:var(--verde)}
.fbcrm-historial ul{list-style:none;padding:0;margin:10px 0 0;border-left:2px solid var(--linea)}
.fbcrm-historial li{padding:4px 0 10px 12px}
.fbcrm-historial li span,.fbcrm-feed li span{font-size:.8rem;color:var(--salvia)}
.fbcrm-historial li p,.fbcrm-feed li p{margin:2px 0 0}
.fbcrm-nota{display:flex;gap:8px;align-items:flex-start}
.fbcrm-feed{list-style:none;padding:0;margin:0;background:var(--papel);border-radius:8px}
.fbcrm-feed li{padding:10px 14px;border-bottom:1px solid var(--linea);display:flex;flex-direction:column;gap:2px}
.fbcrm-feed li:last-child{border-bottom:0}
.fbcrm-archivo{display:block;border:2px dashed var(--linea);border-radius:10px;padding:22px;text-align:center;cursor:pointer;color:var(--verde);font-weight:600}
.fbcrm-archivo input{position:absolute;opacity:0;width:1px;height:1px}
.fbcrm-archivo:focus-within{outline:2px solid var(--verde);outline-offset:2px}
.fbcrm-opciones{border:1px solid var(--linea);border-radius:8px;margin:14px 0 0;padding:10px 14px;display:flex;flex-direction:column;gap:8px}
.fbcrm-opciones legend{font-size:.9rem;color:var(--salvia);padding:0 4px}
.fbcrm-opciones label{display:flex;gap:8px;align-items:center}
.fbcrm-resumen{margin:0 0 12px;padding-left:18px}
.fbcrm-acceso{max-width:380px;display:flex;flex-direction:column;gap:12px;padding-top:15vh}
@media (max-width:600px){.fbcrm-form,.fbcrm-check{grid-template-columns:1fr}.fbcrm-nota{flex-direction:column}.fbcrm-nota button{align-self:flex-end}.fbcrm-hoja{padding:14px 12px 48px}}
@media (prefers-reduced-motion:reduce){.fbcrm *{transition:none!important;scroll-behavior:auto!important}}
`;
