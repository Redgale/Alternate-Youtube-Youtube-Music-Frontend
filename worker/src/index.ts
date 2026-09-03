import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { search } from './routes/search.js';
import { info } from './routes/info.js';
import { stream } from './routes/stream.js';
import { dash } from './routes/dash.js';

const PORT = Number(process.env.PORT ?? 8787);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// This worker shares one domain with other future workers, each living
// under its own path prefix (routed via the tunnel's Public Hostname path
// match). Everything this service exposes lives under PATH_PREFIX so it
// never collides with siblings on the same hostname.
const PATH_PREFIX = (process.env.PATH_PREFIX ?? '/ytdash').replace(/\/$/, '');

const app = new Hono();

app.use(
  `${PATH_PREFIX}/api/*`,
  cors({
    origin: ALLOWED_ORIGINS,
    allowMethods: ['GET'],
  }),
);

app.get('/health', (c) => c.json({ ok: true }));
app.get(`${PATH_PREFIX}/health`, (c) => c.json({ ok: true }));

app.route(`${PATH_PREFIX}/api/search`, search);
app.route(`${PATH_PREFIX}/api/info`, info);
app.route(`${PATH_PREFIX}/api/stream`, stream);
app.route(`${PATH_PREFIX}/api/dash`, dash);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`media-dashboard-worker listening on http://localhost:${info.port}${PATH_PREFIX}`);
  console.log(`allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
