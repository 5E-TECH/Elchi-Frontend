// design/ papkasini statik serverda beradi (maket ichidagi /_blob/ logotiplar → design/assets/_blob).
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DESIGN = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css' };

export const startServer = (port = 0) => new Promise((resolve) => {
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/.build/index.html';
    const file = path.startsWith('/_blob/') ? join(DESIGN, 'assets', path) : join(DESIGN, path);
    if (!file.startsWith(DESIGN) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': path.startsWith('/_blob/') ? 'image/png' : TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  server.listen(port, '127.0.0.1', () => resolve(server));
});
