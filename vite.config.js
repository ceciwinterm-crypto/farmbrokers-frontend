import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Páginas aparte para los links que se envían a clientes y propietarios: cada una tiene su propio título
// (es lo que muestra WhatsApp al pegar el link). Todas cargan la misma aplicación.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        orden: resolve(__dirname, 'orden.html'),
        plano: resolve(__dirname, 'plano.html'),
        propietario: resolve(__dirname, 'propietario.html'),
      },
    },
  },
})
