import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthStore, authHandler } from '../server/auth.mjs';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT ?? 4173);
const production = process.env.NODE_ENV === 'production';
const origin = process.env.APP_ORIGIN ?? `http://127.0.0.1:${port}`;
if (production && (!process.env.APP_ORIGIN || !origin.startsWith('https://'))) throw new Error('Production requires an explicit HTTPS APP_ORIGIN');
if (new URL(origin).origin !== origin) throw new Error('APP_ORIGIN must contain only scheme and host, without a trailing slash or path');
const store = new AuthStore(process.env.AUTH_DB_PATH ?? resolve(root, '.data', 'pentaskill.sqlite'));
const auth = authHandler(store, { origin, secure: origin.startsWith('https://') });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };
const server = createServer(async (req, res) => {
  const security = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; media-src https://interactive-examples.mdn.mozilla.net; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" };
  const url = new URL(req.url, origin);
  if (url.pathname.startsWith('/api/')) { await auth(req, res, url); return; }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { ...security, Allow: 'GET, HEAD' }); res.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // 只提供前端公開入口；不公開 Git、規格、測試或伺服器程式。
    if (!(pathname === '/' || pathname === '/index.html' || pathname.startsWith('/src/') || pathname.startsWith('/assets/')) || pathname.includes('\\') || pathname.split('/').some(part => part.startsWith('.'))) throw new Error('not public');
    const path = resolve(root, pathname === '/' ? 'index.html' : pathname.slice(1));
    if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) throw new Error('not file');
    const data = await readFile(path);
    res.writeHead(200, { ...security, 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404, { ...security, 'Content-Type': 'text/plain; charset=utf-8' }); res.end('找不到這個頁面'); }
});
server.listen(port, process.env.HOST ?? '127.0.0.1', () => console.log(`PentaSkill: ${origin}`));
let closing = false;
function shutdown() { if (closing) return; closing = true; server.close(() => { store.close(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
