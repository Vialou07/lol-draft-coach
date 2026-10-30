// Shares the live state with the group's phones through a public MQTT broker over websocket.
// Each companion publishes one encrypted, retained message per player; the broker drops it
// when the companion disconnects (last will), so phones never show a stale draft for long.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import mqtt from 'mqtt';
import { dataFile } from './paths.mjs';
import { importKey, encode, toB64url } from '../web/codec.js';

export const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
export const PAGE_URL = 'https://vialou07.github.io/lol-draft-coach/';
const MIN_GAP_MS = 600;
const HEARTBEAT_MS = 15000;

export const topicFor = (group, player) => `ldc1/${group}/p/${player}`;

// The group is created once on this PC; its link is what friends open on their phone.
export async function loadGroup() {
  try {
    return JSON.parse(await readFile(dataFile('group.json'), 'utf8'));
  } catch {
    const group = { id: randomBytes(9).toString('hex'), key: toB64url(randomBytes(32)), createdAt: new Date().toISOString() };
    await saveGroup(group);
    return group;
  }
}

export async function saveGroup(group) {
  await mkdir(dataFile(), { recursive: true });
  await writeFile(dataFile('group.json'), JSON.stringify(group, null, 2));
}

// Joining a friend's group: the link carries the group id and key.
export function parseGroupLink(link) {
  const hash = String(link).split('#')[1] ?? '';
  const params = new URLSearchParams(hash);
  const id = params.get('g');
  const key = params.get('k');
  return id && key && /^[0-9a-f]{8,64}$/.test(id) && /^[A-Za-z0-9_-]{40,}$/.test(key) ? { id, key } : null;
}

export const groupLink = (group) => `${PAGE_URL}#g=${group.id}&k=${group.key}`;
export const playerIdFor = (riotId) => createHash('sha256').update(String(riotId).toLowerCase()).digest('hex').slice(0, 12);

export async function startRelay({ group, onLog = () => {}, brokers = BROKERS }) {
  const key = await importKey(group.key);
  let client = null;
  let brokerIndex = 0;
  let topic = null;
  let lastSent = 0;
  let timer = null;
  let latest = null;
  let stopped = false;

  const connect = () => {
    const url = brokers[brokerIndex % brokers.length];
    const will = topic ? { topic, payload: Buffer.alloc(0), retain: true, qos: 0 } : undefined;
    client = mqtt.connect(url, { connectTimeout: 8000, reconnectPeriod: 5000, will, clientId: `ldc-${randomBytes(6).toString('hex')}` });
    client.on('connect', () => {
      onLog(`Relais du groupe connecté (${new URL(url).hostname}).`);
      if (latest) send();
    });
    client.on('error', () => {});
    client.on('offline', () => {
      // Try the other broker if this one keeps failing.
      if (stopped) return;
      client.end(true);
      brokerIndex++;
      setTimeout(connect, 2000);
    });
  };

  const send = async () => {
    timer = null;
    if (!client?.connected || !latest || !topic) return;
    lastSent = Date.now();
    const message = typeof latest === 'function' ? latest() : latest;
    if (!message) return;
    const payload = await encode({ ...message, sentAt: lastSent }, key);
    client.publish(topic, Buffer.from(payload), { retain: true, qos: 0 });
  };

  const heartbeat = setInterval(() => latest && send(), HEARTBEAT_MS);

  return {
    // Called on every state change; sends at most every MIN_GAP_MS. `message` can be a
    // function, evaluated only when a message actually goes out.
    publish(playerId, message) {
      if (stopped) return;
      if (topic !== topicFor(group.id, playerId)) {
        topic = topicFor(group.id, playerId);
        client?.end(true);
        connect();
      }
      latest = message;
      if (timer) return;
      timer = setTimeout(send, Math.max(0, MIN_GAP_MS - (Date.now() - lastSent)));
    },
    async stop() {
      stopped = true;
      clearInterval(heartbeat);
      clearTimeout(timer);
      if (client?.connected && topic) await new Promise((r) => client.publish(topic, Buffer.alloc(0), { retain: true }, r));
      client?.end(true);
    },
  };
}
