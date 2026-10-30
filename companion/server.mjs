// Local web server: serves the live page and pushes every state change over a websocket,
// to the PC browser and to a phone on the same Wi-Fi.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const WEB_DIR = fileURLToPath(new URL('../web/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };

export function lanUrls(port) {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${port}`);
}

export function startServer({ port, host = '0.0.0.0', snapshot, icon = async () => null }) {
  const server = http.createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/state') {
      res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(snapshot()));
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
    server.listen(port, host, () => resolve({ broadcast, port: server.address().port, close: () => new Promise((r) => { wss.close(); server.close(r); }) }));
  });
}
