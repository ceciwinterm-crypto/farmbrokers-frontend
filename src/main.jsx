import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import CRM, { FormularioPropietario, FormularioPlano } from './CRM.jsx'

const hash = window.location.hash
let pantalla = <App />
if (hash.startsWith('#propietario/')) pantalla = <FormularioPropietario token={hash.split('/')[1]} />
else if (hash.startsWith('#plano/')) pantalla = <FormularioPlano token={hash.split('/')[1]} />
else if (hash === '#crm') pantalla = <CRM />

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {pantalla}
  </React.StrictMode>,
)
