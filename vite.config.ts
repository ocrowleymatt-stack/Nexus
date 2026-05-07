import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

const getPackageName = (id: string) => {
  const normalizedId = id.replace(/\\/g, '/');
  const marker = '/node_modules/';
  const markerIndex = normalizedId.lastIndexOf(marker);

  if (markerIndex === -1) return undefined;

  const packagePath = normalizedId.slice(markerIndex + marker.length);
  const parts = packagePath.split('/');

  if (!parts[0]) return undefined;

  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
};

const reactPackages = new Set(['react', 'react-dom', 'scheduler']);
const aiPackages = new Set(['@google/genai', '@google/generative-ai']);
const motionPackages = new Set(['framer-motion', 'motion']);
const markdownPackages = new Set(['react-markdown', 'remark-parse', 'remark-rehype']);
const parsingPackages = new Set(['exceljs', 'jszip', 'mammoth', 'papaparse', 'pdf-parse']);

const getManualChunkName = (id: string) => {
  const packageName = getPackageName(id);

  if (!packageName) return undefined;
  if (reactPackages.has(packageName)) return 'react';
  if (packageName === 'firebase' || packageName.startsWith('@firebase/')) return 'firebase';
  if (aiPackages.has(packageName)) return 'ai';
  if (packageName.startsWith('d3-') || packageName === 'react-force-graph-2d') return 'graph';
  if (motionPackages.has(packageName)) return 'motion';
  if (packageName === 'lucide-react') return 'icons';
  if (markdownPackages.has(packageName)) return 'markdown';
  if (parsingPackages.has(packageName)) return 'parsing';

  return undefined;
};

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Expose GEMINI_API_KEY as process.env.API_KEY so the client-side
      // Gemini service can pick it up when running outside AI Studio.
      // AI Studio injects this at runtime; locally it reads from .env.
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: getManualChunkName,
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
