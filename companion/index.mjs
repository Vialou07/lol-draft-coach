// Entry point: `npm start`. Opens the live page in the browser and prints the phone address.

import { exec } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { startCompanion } from './app.mjs';
import { lanUrls } from './server.mjs';

// Windows can reserve or block a port: try a few before giving up.
const PORTS = process.env.PORT ? [Number(process.env.PORT)] : [4317, 4327, 4337, 4347, 4357];
const time = () => new Date().toLocaleTimeString('fr-FR');
const LOG_DIR = new URL('../data/local/', import.meta.url);
mkdirSync(LOG_DIR, { recursive: true });
const log = (m) => {
  console.log(`[${time()}] ${m}`);
  try {
    appendFileSync(new URL('companion.log', LOG_DIR), `${new Date().toISOString()} ${m}\n`);
  } catch {
    // logging must never stop the app
  }
};
const open = (url) => process.argv.includes('--no-open') || process.platform !== 'win32' || exec(`start "" "${url}"`);

async function alreadyRunning(port) {
  try {
    const res = await fetch(`http://localhost:${port}/state`, { signal: AbortSignal.timeout(1500) });
    return 'status' in (await res.json());
  } catch {
    return false;
  }
}

let app;
for (const port of PORTS) {
  try {
    app = await startCompanion({ port, onLog: log });
    break;
  } catch (e) {
    if (e.code === 'EADDRINUSE' && (await alreadyRunning(port))) {
      console.log(`LoL Draft Coach tourne déjà : http://localhost:${port}`);
      open(`http://localhost:${port}`);
      process.exit(0);
    }
    if (e.code !== 'EADDRINUSE' && e.code !== 'EACCES') throw e;
    log(`Port ${port} indisponible (${e.code}), essai suivant.`);
  }
}
if (!app) {
  console.log('Aucun port disponible pour la page locale. Ferme les autres applis et relance.');
  process.exit(1);
}

const local = `http://localhost:${app.port}`;
console.log(`\nLoL Draft Coach est lancé.`);
console.log(`  Sur ce PC      : ${local}`);
const phone = lanUrls(app.port)[0];
if (phone) console.log(`  Sur ton tél.   : ${phone}  (même Wi-Fi, ou scanne le QR code sur la page)`);
console.log(`\nLance LoL quand tu veux, la page se met à jour toute seule. Ctrl+C pour quitter.\n`);

open(local);
