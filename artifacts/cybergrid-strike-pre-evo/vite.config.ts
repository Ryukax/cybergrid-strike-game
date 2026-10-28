import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

const lanEntryRedirect = (): Plugin => {
  const redirectRoot = (
    request: { url?: string; headers?: Record<string, string | string[] | undefined> },
    response: { statusCode: number; setHeader(name: string, value: string): void; end(): void },
    next: () => void,
  ) => {
    const requestUrl = request.url ?? '/';
    if (requestUrl.startsWith(`${basePath}__client-error`)) {
      const diagnostic = new URL(requestUrl, 'http://cybergrid.local');
      const clean = (value: string | null, limit: number) => (value ?? '')
        .replace(/[\r\n\t]+/g, ' ')
        .slice(0, limit);
      const kind = clean(diagnostic.searchParams.get('kind'), 80) || 'client error';
      const message = clean(diagnostic.searchParams.get('message'), 300) || 'No message';
      const userAgent = clean(
        diagnostic.searchParams.get('ua')
          ?? String(request.headers?.['user-agent'] ?? ''),
        320,
      );
      console.warn(`[CyberGrid Safari] ${kind}: ${message} | ${userAgent}`);
      response.statusCode = 204;
      response.setHeader('Cache-Control', 'no-store');
      response.end();
      return;
    }
    if (requestUrl === '/' || requestUrl.startsWith('/?')) {
      response.statusCode = 302;
      response.setHeader('Location', `${basePath}${requestUrl.slice(1)}`);
      response.end();
      return;
    }
    next();
  };

  return {
    name: 'cybergrid-lan-entry-redirect',
    configureServer(server) {
      server.middlewares.use(redirectRoot);
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirectRoot);
    },
  };
};

export default defineConfig({
  base: basePath,
  // Keep the LAN build parseable on older iPhones as well as current Safari.
  // Runtime collection/image fallbacks are installed before the game module.
  esbuild: {
    target: 'safari12',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'safari12',
    },
  },
  plugins: [
    lanEntryRedirect(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    target: 'safari12',
    cssTarget: 'safari12',
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
