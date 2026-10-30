// Demo without League: replays a real recorded champ select into the companion.
// Usage: npm run demo -- [fixture file] [--hold=N] [--speed=S] [--port=P] [--exit-after=SECONDS]
//   --hold=N  stop the replay at event N and keep the page on that moment (for screenshots)

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFakeClient, loadFixture } from './fake-client.mjs';
import { startCompanion } from '../companion/app.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const file = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'q420-2026-10-24-01.json';
const hold = arg('hold', null);
const speed = Number(arg('speed', 3));
const port = Number(arg('port', 4318));
const exitAfter = arg('exit-after', null);
if (exitAfter) setTimeout(() => process.exit(0), Number(exitAfter) * 1000);

const lockfile = join(tmpdir(), `lol-draft-coach-demo-${port}.lockfile`);
const full = loadFixture(file);
const fixture = hold == null ? full : { ...full, events: full.events.slice(0, Number(hold) + 1) };
const fake = await startFakeClient({ fixture, lockfile, speed, holdAtEnd: hold != null });
const app = await startCompanion({ port, lockfile });
console.log(`Démo sur http://localhost:${app.port} (${file}, ${fixture.events.length}/${full.events.length} événements)`);

while (fake.subscribers() === 0) await new Promise((r) => setTimeout(r, 50));
do {
  await fake.play();
  await new Promise((r) => setTimeout(r, 3000));
} while (hold == null);
