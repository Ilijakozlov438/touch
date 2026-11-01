import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteUrl } from './site-config.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const mount = new URL(siteUrl).pathname;
const port = Number(process.env.PORT || 8767);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') { res.writeHead(302, { Location: mount }).end(); return; }
    if (!pathname.startsWith(mount)) { res.writeHead(404).end('Not found'); return; }
    let file = path.resolve(root, '.' + pathname.slice(mount.length - 1));
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) {
      if (!pathname.endsWith('/')) { res.writeHead(301, { Location: pathname + '/' }).end(); return; }
      file = path.join(file, 'index.html');
    }
    const body = await readFile(file);
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
    // Preview-only switch for verifying real no-JavaScript rendering in a browser.
    if (url.searchParams.has('nojs')) headers['Content-Security-Policy'] = "script-src 'none'";
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(await readFile(path.join(root, '404.html')).catch(() => 'Not found'));
  }
}).listen(port, '127.0.0.1', () => console.log(`TOUCH preview: http://127.0.0.1:${port}${mount}`));
