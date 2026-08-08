import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Allows opening the dev server from a phone/tablet on the same network.
    // Note: camera access requires a secure context (HTTPS) on any device
    // that isn't "localhost" — see README for options.
    host: true,
  },
});
