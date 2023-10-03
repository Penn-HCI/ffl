import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/ffl/getting-started',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'basic-styles': resolve(__dirname, 'basic-styles.html'),
        'additional-styles': resolve(__dirname, 'additional-styles.html'),
        'basic-selectors': resolve(__dirname, 'basic-selectors.html'),
        'combining-selectors': resolve(__dirname, 'combining-selectors.html'),
        'pseudo-selectors': resolve(__dirname, 'pseudo-selectors.html'),
      },
    }
  },
})
