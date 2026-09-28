// Tiny local preview server for dist/. Usage: npm run dev  (or npm run preview:sample)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/bets.mjs';
import { build } from './build.mjs';

const sample = process.argv.includes('--sample');
const draft = process.argv.includes('--draft');
const port = Number(process.env.PORT) || 4321;
const dist = path.join(ROOT, 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.csv': 'text/csv; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

build({ sample, draft });

http
  .createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/' || p === '/index.html') build({ sample, draft }); // rebuild on each page load so edits show up
    let file = path.join(dist, p);
    if (!file.startsWith(dist)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
    if (!fs.existsSync(file)) return res.writeHead(404).end('Not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Preview running at http://localhost:${port}${sample ? '  (SAMPLE DATA)' : draft ? '  (IMPORT DRAFT)' : ''}  — press Ctrl+C to stop`));
