import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT ?? 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };
const server = createServer(async (req, res) => {
  const security = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; media-src https://interactive-examples.mdn.mozilla.net; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" };
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
server.listen(port, '127.0.0.1', () => console.log(`Pentaskill preview: http://127.0.0.1:${port}`));
