// Local web server: serves the live page and pushes every state change over a websocket,
// to the PC browser and to a phone on the same Wi-Fi.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { WebSocketServer } from 'ws';

const qrcode = createRequire(import.meta.url)('qrcode-generator');
const WEB_DIR = fileURLToPath(new URL('../web/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
const VIRTUAL = /vethernet|virtual|vmware|vbox|hyper-v|wsl|docker|bluetooth|loopback|tailscale|zerotier/i;

export function lanUrls(port) {
  return Object.entries(networkInterfaces())
    .flatMap(([name, list]) => (list ?? []).map((i) => ({ name, ...i })))
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => ({ url: `http://${i.address}:${port}`, rank: (VIRTUAL.test(i.name) ? 2 : 0) + (i.address.startsWith('192.168.') ? 0 : 1) }))
    .sort((a, b) => a.rank - b.rank)
    .map((i) => i.url);
}

function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}

export function startServer({ port, host = '0.0.0.0', snapshot, icon = async () => null, actions = {} }) {
  let boundPort = port;
  const server = http.createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/state') {
      res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(snapshot()));
    }
    if (path === '/phone') {
      const url = lanUrls(boundPort)[0] ?? null;
      res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ url, qr: url ? qrSvg(url) : null }));
    }
    if (req.method === 'POST' && actions[path]) {
      const result = await Promise.resolve(actions[path]()).catch((e) => ({ error: e.message }));
      res.writeHead(200, { 'Content-Type': TYPES['.json'] });
      return res.end(JSON.stringify(result ?? {}));
    }
    const iconId = path.match(/^\/icon\/(\d+)$/)?.[1];
    if (iconId) {
      const png = await icon(Number(iconId)).catch(() => null);
      if (!png) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=86400' });
      return res.end(png);
    }
    const file = normalize(join(WEB_DIR, path === '/' ? 'index.html' : path));
    if (!file.startsWith(normalize(WEB_DIR))) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('error', () => {}); // listen errors are reported by the promise below
  wss.on('connection', (ws) => ws.send(JSON.stringify(snapshot())));

  const broadcast = () => {
    const msg = JSON.stringify(snapshot());
    for (const ws of wss.clients) if (ws.readyState === 1) ws.send(msg);
  };

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      boundPort = server.address().port;
      resolve({ broadcast, port: boundPort, close: () => new Promise((r) => { wss.close(); server.close(r); }) });
    });
  });
}
