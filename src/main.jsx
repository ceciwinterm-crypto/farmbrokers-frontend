import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import CRM, { FormularioPropietario, FormularioPlano, FormularioOrden } from './CRM.jsx'

const hash = window.location.hash
let pantalla = <App />
if (hash.startsWith('#propietario/')) pantalla = <FormularioPropietario token={hash.split('/')[1]} />
else if (hash.startsWith('#plano/')) pantalla = <FormularioPlano token={hash.split('/')[1]} />
else if (hash.startsWith('#orden/')) pantalla = <FormularioOrden token={hash.split('/')[1]} />
// Instalada en el celular (o abierta como app), siempre entra al CRM
else if (hash === '#crm' || new URLSearchParams(window.location.search).get('app') === 'crm' || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone) pantalla = <CRM />

// Permite instalar el CRM en el celular como app
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__fbInstalar = e; window.dispatchEvent(new Event('fb-instalable')) })

// Si algo falla, muestra un aviso con botón para recargar en vez de dejar la pantalla en blanco
class Resguardo extends React.Component {
  constructor(p) { super(p); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('Error en la pantalla:', error, info) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ fontFamily: 'system-ui,sans-serif', maxWidth: 520, margin: '12vh auto', padding: 24, color: '#17261D', textAlign: 'center' }}>
        <h2 style={{ color: '#1F4D31' }}>Algo falló en esta pantalla</h2>
        <p>Tus datos están guardados. Toca el botón para volver a cargar.</p>
        <button onClick={() => window.location.reload()} style={{ background: '#2D6A45', color: '#fff', border: 0, borderRadius: 10, padding: '12px 22px', fontSize: 16, cursor: 'pointer' }}>Volver a cargar</button>
        <p style={{ color: '#5E6E64', fontSize: 13, marginTop: 24 }}>Detalle para soporte: {String(this.state.error && this.state.error.message || this.state.error).slice(0, 200)}</p>
      </div>
    )
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Resguardo>{pantalla}</Resguardo>
  </React.StrictMode>,
)
