import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// client-side فقط، يتبني static ويتنشر على أي static host
export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
