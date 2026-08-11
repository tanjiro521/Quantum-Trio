import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import analyzeHandler from './api/analyze.js';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLocalPath = path.resolve(__dirname, '.env.local');

dotenv.config({ path: envLocalPath });
dotenv.config();

const anthropicKeyConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
console.log(`[pulse] .env.local present: ${existsSync(envLocalPath)}; ANTHROPIC_API_KEY configured: ${anthropicKeyConfigured}`);

const app = express();
const port = Number(process.env.PORT || 3002);
let initialized = false;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.post('/api/analyze', analyzeHandler);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', anthropicKeyPresent: Boolean(process.env.ANTHROPIC_API_KEY) });
});

export async function startServer(portNumber = port) {
  if (!initialized) {
    if (process.env.NODE_ENV === 'production') {
      app.use(express.static(path.resolve(__dirname, 'dist')));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
      });
    } else {
      const vite = await createViteServer({
        root: __dirname,
        server: {
          middlewareMode: true,
          hmr: { port: portNumber },
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }

    initialized = true;
  }

  return new Promise((resolve, reject) => {
    const tryListen = (attemptedPort) => {
      const server = app.listen(attemptedPort, () => {
        console.log(`[pulse] App available at http://localhost:${attemptedPort}`);
        console.log(`[pulse] Mode: ${process.env.NODE_ENV || 'development'}`);
        resolve(server);
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE' && attemptedPort < 3010) {
          server.close();
          tryListen(attemptedPort + 1);
        } else {
          reject(error);
        }
      });
    };

    tryListen(portNumber);
  });
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  startServer().catch((error) => {
    console.error('[pulse] Failed to start server', error);
    process.exit(1);
  });
}
