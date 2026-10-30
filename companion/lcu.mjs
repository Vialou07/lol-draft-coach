// Connection to the League client's local API (LCU).
// Read-only by design: this module only issues GET requests and subscribes to events.

import { readFileSync, existsSync } from 'node:fs';
import https from 'node:https';
import WebSocket from 'ws';

const DEFAULT_LOCKFILE = 'C:/Riot Games/League of Legends/lockfile';
const PRODUCT_SETTINGS = 'C:/ProgramData/Riot Games/Metadata/league_of_legends.live/league_of_legends.live.product_settings.yaml';

// The Riot Client records where League is installed; no need to look at the running process.
function installedLockfile() {
  try {
    const path = readFileSync(PRODUCT_SETTINGS, 'utf8').match(/product_install_full_path:\s*"?([^"\r\n]+)"?/)?.[1];
    return path ? `${path.replace(/[\\/]+$/, '')}/lockfile` : null;
  } catch {
    return null;
  }
}

// The LCU serves a self-signed Riot certificate, and we only ever talk to 127.0.0.1.
const tls = { rejectUnauthorized: false };

export function findClient(lockfile) {
  const candidates = lockfile ? [lockfile] : process.env.LCU_LOCKFILE ? [process.env.LCU_LOCKFILE] : [DEFAULT_LOCKFILE, installedLockfile()];
  for (const file of candidates) {
    if (!file || !existsSync(file)) continue;
    try {
      const [, , port, password] = readFileSync(file, 'utf8').split(':');
      if (port && password) return { port, password };
    } catch {
      // the client may be rewriting it
    }
  }
  return null;
}

export function get(client, path) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      { host: '127.0.0.1', port: client.port, path, auth: `riot:${client.password}`, timeout: 5000, ...tls },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`${res.statusCode} ${path}`));
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error(`timeout ${path}`)));
    req.on('error', reject);
  });
}

export function getBinary(client, path) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      { host: '127.0.0.1', port: client.port, path, auth: `riot:${client.password}`, timeout: 5000, ...tls },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => (res.statusCode === 200 ? resolve(Buffer.concat(chunks)) : reject(new Error(`${res.statusCode} ${path}`))));
      },
    );
    req.on('timeout', () => req.destroy(new Error(`timeout ${path}`)));
    req.on('error', reject);
  });
}

// Optional data: a missing endpoint must never stop the app.
export const tryGet = (client, path) => get(client, path).catch(() => null);

// WAMP 1.0 over websocket: [5, topic] subscribes, the client pushes [8, topic, {eventType, data, uri}].
export function subscribe(client, topics, onEvent) {
  const auth = Buffer.from(`riot:${client.password}`).toString('base64');
  const ws = new WebSocket(`wss://127.0.0.1:${client.port}/`, { headers: { Authorization: `Basic ${auth}` }, ...tls });
  ws.on('open', () => topics.forEach((t) => ws.send(JSON.stringify([5, t]))));
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (Array.isArray(msg) && msg[0] === 8 && topics.includes(msg[1])) onEvent(msg[1], msg[2]);
  });
  return ws;
}

export const TOPICS = {
  session: 'OnJsonApiEvent_lol-champ-select_v1_session',
  gameflow: 'OnJsonApiEvent_lol-gameflow_v1_gameflow-phase',
};
