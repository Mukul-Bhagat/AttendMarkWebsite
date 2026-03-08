import fs from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const LOCALHOST_ALIASES = new Set(['0.0.0.0', 'localhost', '::1']);

const readEnvValue = (content: string, key: string): string | null => {
  const match = content.match(new RegExp(`(?:^|\\r?\\n)${key}=([^\\r\\n]+)`));
  if (!match?.[1]) {
    return null;
  }

  return match[1].trim();
};

const normalizeTargetUrl = (rawValue: string): string => {
  const parsed = new URL(rawValue);
  const normalizedHost = LOCALHOST_ALIASES.has(parsed.hostname)
    ? '127.0.0.1'
    : parsed.hostname;
  const pathname =
    parsed.pathname === '/api'
      ? ''
      : parsed.pathname.replace(/\/+$/, '');

  return `${parsed.protocol}//${normalizedHost}${parsed.port ? `:${parsed.port}` : ''}${pathname}`;
};

const resolveProxyTarget = (mode: string): string => {
  const env = loadEnv(mode, process.cwd(), '');
  const explicitTarget = env.VITE_API_PROXY_TARGET?.trim();
  if (explicitTarget) {
    return normalizeTargetUrl(explicitTarget);
  }

  const backendEnvCandidates = [
    path.resolve(process.cwd(), '../backend/.env'),
    path.resolve(process.cwd(), '../backend/.env.example'),
  ];

  let host = '127.0.0.1';
  let port = '5001';

  for (const filePath of backendEnvCandidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const appApiBaseUrl = readEnvValue(content, 'APP_API_BASE_URL');
    const resolvedHost = readEnvValue(content, 'HOST');
    const resolvedPort = readEnvValue(content, 'PORT');

    if (appApiBaseUrl) {
      return normalizeTargetUrl(appApiBaseUrl);
    }

    if (resolvedHost) {
      host = LOCALHOST_ALIASES.has(resolvedHost) ? '127.0.0.1' : resolvedHost;
    }

    if (resolvedPort) {
      port = resolvedPort;
    }

    break;
  }

  return `http://${host}:${port}`;
};

export default defineConfig(({ mode }) => {
  const proxyTarget = resolveProxyTarget(mode);
  console.log('[VITE PROXY TARGET]', proxyTarget);

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              proxyReq.setHeader(
                'Cache-Control',
                'no-store, no-cache, must-revalidate',
              );
              proxyReq.setHeader('Pragma', 'no-cache');
              proxyReq.setHeader('Expires', '0');
              console.log('[VITE PROXY]', req.method, req.url);
            });

            proxy.on('proxyRes', (proxyRes, req) => {
              proxyRes.headers['cache-control'] =
                'no-store, no-cache, must-revalidate, proxy-revalidate';
              proxyRes.headers['pragma'] = 'no-cache';
              proxyRes.headers['expires'] = '0';
              console.log(
                '[VITE PROXY OK]',
                req.method,
                req.url,
                '->',
                proxyRes.statusCode,
              );
            });

            proxy.on('error', (error, req) => {
              console.error(
                '[VITE PROXY ERROR]',
                req.method,
                req.url,
                '->',
                error.message,
              );
            });
          },
        },
      },
    },
  };
});
