import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

const testAppIcons = {
  name: 'lago-test-app-icons',
  transformIndexHtml(html) {
    return html
      .replace('href="/lago.svg" type="image/svg+xml"', 'href="/lago-test-192.png" type="image/png"')
      .replace('/lago-apple-touch.png', '/lago-test-apple-touch.png')
      .replace('/manifest.webmanifest', '/manifest-test.webmanifest');
  }
};

export default defineConfig({
  plugins: [vue(), tailwindcss(), process.env.RAILWAY_ENVIRONMENT_NAME === 'test' && testAppIcons],
  server: { proxy: { '/api': 'http://127.0.0.1:3000', '/calendar': 'http://127.0.0.1:3000' } }
});
