import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://trustjonathan.github.io',
  base: '/MATHEMATICS',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' }
});