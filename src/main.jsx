import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import CRM, { FormularioPropietario, FormularioPlano, FormularioOrden } from './CRM.jsx'

const hash = window.location.hash
let pantalla = <App />
if (hash.startsWith('#propietario/')) pantalla = <FormularioPropietario token={hash.split('/')[1]} />
else if (hash.startsWith('#plano/')) pantalla = <FormularioPlano token={hash.split('/')[1]} />
else if (hash.startsWith('#orden/')) pantalla = <FormularioOrden token={hash.split('/')[1]} />
else if (hash === '#crm') pantalla = <CRM />

// Permite instalar el CRM en el celular como app
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__fbInstalar = e; window.dispatchEvent(new Event('fb-instalable')) })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {pantalla}
  </React.StrictMode>,
)
