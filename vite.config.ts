import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const paquete = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

function git(comando: string): string | null {
  try {
    return execSync(`git ${comando}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

// Número de build de la web: la fecha (segundos Unix) del último commit. Ajustes lo muestra como fecha de publicación.
const build = Number(git('log -1 --format=%ct') ?? 0);
const commit = git('rev-parse --short HEAD') ?? 'local';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_WEB__: JSON.stringify(build),
    __VERSION_WEB__: JSON.stringify(`${paquete.version} (${commit})`),
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
});
