// The official Live Client Data API, served by the game itself on 127.0.0.1:2999 while a game
// runs (documented by Riot for third-party apps). Read-only GET; it exposes your own gold and
// the items, levels and scores everyone can see on the scoreboard.

import https from 'node:https';

export const LIVE_PORT = Number(process.env.LIVE_PORT ?? 2999);

export function readLiveGame(port = LIVE_PORT) {
  return new Promise((resolve) => {
    const req = https.get(
      // The game's certificate is self-signed (and its root expired in 2026): localhost only.
      { host: '127.0.0.1', port, path: '/liveclientdata/allgamedata', timeout: 2500, rejectUnauthorized: false },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(res.statusCode === 200 ? JSON.parse(body) : null);
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}
