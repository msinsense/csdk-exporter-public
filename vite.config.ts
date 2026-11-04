import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { zipSync } from 'fflate';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const PLUGIN_DIR = path.resolve(import.meta.dirname, 'sisense-plugin');
const PLUGIN_FILES = ['plugin.json', 'config.js', 'lib.js', 'main.js', 'README.md'];
const PLUGIN_ZIP_NAME = 'csdkExporter.zip';

function readDirRecursive(dir: string, prefix: string, files: Record<string, Uint8Array>) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const zipPath = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) readDirRecursive(fullPath, zipPath, files);
    else if (entry.name !== PLUGIN_ZIP_NAME) files[zipPath] = readFileSync(fullPath);
  }
}

// Zips the Sisense plugin, with the built app under app/, into the build
// output so the app can offer it for download. Sisense serves the app from
// /plugins/csdkExporter/app/.
function sisensePluginZip(): Plugin {
  let outDir = '';
  return {
    name: 'sisense-plugin-zip',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files: Record<string, Uint8Array> = {};
      for (const file of PLUGIN_FILES) {
        files[`csdkExporter/${file}`] = readFileSync(path.join(PLUGIN_DIR, file));
      }
      readDirRecursive(outDir, 'csdkExporter/app', files);
      writeFileSync(path.join(outDir, PLUGIN_ZIP_NAME), zipSync(files));
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths, so the app also works from the plugin folder.
  base: './',
  plugins: [react(), tailwindcss(), ...(process.env.VITEST ? [] : [sisensePluginZip()])],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
