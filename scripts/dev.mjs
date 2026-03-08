import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '..');
const backendDir = path.resolve(rootDir, '../backend');
const LOCALHOST_ALIASES = new Set(['0.0.0.0', 'localhost', '::1']);
const backendNodemonPath = path.join(
  backendDir,
  'node_modules',
  'nodemon',
  'bin',
  'nodemon.js',
);
const viteBinPath = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');

const readEnvValue = (content, key) => {
  const match = content.match(new RegExp(`(?:^|\\r?\\n)${key}=([^\\r\\n]+)`));
  if (!match?.[1]) {
    return null;
  }
  return match[1].trim();
};

const normalizeTargetUrl = (rawValue) => {
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

const resolveBackendTarget = () => {
  const candidates = [
    path.join(backendDir, '.env'),
    path.join(backendDir, '.env.example'),
  ];

  let host = '127.0.0.1';
  let port = '5001';

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const appApiBaseUrl = readEnvValue(content, 'APP_API_BASE_URL');
    const resolvedHost = readEnvValue(content, 'HOST');
    const resolvedPort = readEnvValue(content, 'PORT');

    if (appApiBaseUrl) {
      const target = normalizeTargetUrl(appApiBaseUrl);
      const targetUrl = new URL(target);
      return {
        host: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? '443' : '80'),
        target,
        healthUrl: `${target}/api/health`,
      };
    }

    if (resolvedHost) {
      host = LOCALHOST_ALIASES.has(resolvedHost) ? '127.0.0.1' : resolvedHost;
    }
    if (resolvedPort) {
      port = resolvedPort;
    }
    break;
  }

  return {
    host,
    port,
    target: `http://${host}:${port}`,
    healthUrl: `http://${host}:${port}/api/health`,
  };
};

const requestHealth = (healthUrl) =>
  new Promise((resolve) => {
    const url = new URL(healthUrl);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      url,
      {
        method: 'GET',
        timeout: 2000,
      },
      (res) => {
        resolve(Boolean(res.statusCode));
        res.resume();
      },
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForBackend = async (healthUrl, timeoutMs = 90000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await requestHealth(healthUrl)) {
      return true;
    }
    await sleep(1500);
  }
  return false;
};

const spawnNodeScript = (cwd, scriptPath, args = [], extraEnv = {}) =>
  spawn(process.execPath, [scriptPath, ...args], {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

const spawnProcess = (cwd, args, extraEnv = {}) => {
  const env = {
    ...process.env,
    ...extraEnv,
  };

  return spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd,
    stdio: 'inherit',
    env,
  });
};

const backend = resolveBackendTarget();
let backendProcess = null;
let viteProcess = null;
let shuttingDown = false;

const shutdown = (exitCode = 0) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  if (viteProcess && !viteProcess.killed) {
    viteProcess.kill('SIGINT');
  }
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGINT');
  }

  setTimeout(() => process.exit(exitCode), 250);
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`[dev] Backend target resolved to ${backend.target}`);

const backendAlreadyRunning = await requestHealth(backend.healthUrl);
if (backendAlreadyRunning) {
  console.log('[dev] Backend is already running. Reusing existing process.');
} else {
  console.log('[dev] Starting backend...');
  backendProcess = fs.existsSync(backendNodemonPath)
    ? spawnNodeScript(backendDir, backendNodemonPath, ['--config', 'nodemon.json'])
    : spawnProcess(backendDir, ['run', 'dev']);

  backendProcess.on('exit', (code) => {
    if (shuttingDown) {
      return;
    }
    console.error(`[dev] Backend exited early with code ${code ?? 1}.`);
    shutdown(code ?? 1);
  });

  const healthy = await waitForBackend(backend.healthUrl);
  if (!healthy) {
    console.error(
      `[dev] Backend did not become healthy at ${backend.healthUrl}.`,
    );
    shutdown(1);
  }
}

console.log('[dev] Starting Vite with local proxy mode...');
viteProcess = fs.existsSync(viteBinPath)
  ? spawnNodeScript(rootDir, viteBinPath, [], {
      VITE_API_URL: '',
      VITE_API_PROXY_TARGET: backend.target,
    })
  : spawnProcess(rootDir, ['run', 'dev:vite'], {
      VITE_API_URL: '',
      VITE_API_PROXY_TARGET: backend.target,
    });

viteProcess.on('exit', (code) => {
  if (shuttingDown) {
    return;
  }
  shutdown(code ?? 0);
});
