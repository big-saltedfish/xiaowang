import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5179',
        changeOrigin: false,
        ws: true,
      },
    },
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [vinext()],
});
