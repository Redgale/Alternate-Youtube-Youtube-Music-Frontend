import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { search } from './routes/search.js';
import { info } from './routes/info.js';
import { stream } from './routes/stream.js';
import { dash } from './routes/dash.js';

const PORT = Number(process.env.PORT ?? 8787);

// This worker shares one domain with other future workers, each living
// under its own path prefix (routed via the tunnel's Public Hostname path
// match). Everything this service exposes lives under PATH_PREFIX so it
// never collides with siblings on the same hostname.
const PATH_PREFIX = (process.env.PATH_PREFIX ?? '/ytdash').replace(/\/$/, '');

const app = new Hono();

// Open to any origin: these are read-only GET endpoints with no cookies/auth,
// and callers legitimately show up from unpredictable origins (blob: pages
// hosted by third-party launchers inherit whatever origin created them).
app.use(
  `${PATH_PREFIX}/api/*`,
  cors({
    origin: '*',
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
});
