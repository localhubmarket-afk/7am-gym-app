import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import geminiHandler from './api/gemini.js';
import stateHandler from './api/state.js';
import biometricsHandler from './api/biometrics.js';
import authLeadHandler from './api/auth-lead.js';
import deleteAccountHandler from './api/delete-account.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));
  app.use(express.text({ type: 'text/plain', limit: '4mb' }));

  // Mount server-side Gemini API endpoints (Plain-Language Coach, Low-Spoons Triage, General)
  app.post('/api/gemini/coach-explain', (req, res) => {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    req.body = { ...body, action: 'coach_explain' };
    return geminiHandler(req, res);
  });

  app.post('/api/gemini/low-spoons-triage', (req, res) => {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    req.body = { ...body, action: 'low_spoons_triage' };
    return geminiHandler(req, res);
  });

  app.all('/api/gemini', (req, res) => geminiHandler(req, res));
  app.all('/api/state', (req, res) => stateHandler(req, res));
  app.all('/api/biometrics', (req, res) => biometricsHandler(req, res));
  app.all('/api/auth-lead', (req, res) => authLeadHandler(req, res));
  app.all('/api/delete-account', (req, res) => deleteAccountHandler(req, res));

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`7AM Budget Gym server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
