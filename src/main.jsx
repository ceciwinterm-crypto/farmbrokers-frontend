import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import CRM from './CRM.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {window.location.hash === '#crm' ? <CRM /> : <App />}
  </React.StrictMode>,
)
