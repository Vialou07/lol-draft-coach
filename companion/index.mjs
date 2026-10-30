// Entry point: `npm start`. Opens the live page in the browser and prints the phone address.

import { exec } from 'node:child_process';
import { startCompanion } from './app.mjs';
import { lanUrls } from './server.mjs';

const port = Number(process.env.PORT ?? 4317);
const time = () => new Date().toLocaleTimeString('fr-FR');
const local = `http://localhost:${port}`;
const open = () => process.argv.includes('--no-open') || process.platform !== 'win32' || exec(`start "" "${local}"`);

let app;
try {
  app = await startCompanion({ port, onLog: (m) => console.log(`[${time()}] ${m}`) });
} catch (e) {
  if (e.code !== 'EADDRINUSE') throw e;
  console.log(`LoL Draft Coach tourne déjà : ${local}`);
  open();
  process.exit(0);
}

console.log(`\nLoL Draft Coach est lancé.`);
console.log(`  Sur ce PC      : ${local}`);
for (const url of lanUrls(app.port)) console.log(`  Sur ton tél.   : ${url}  (même Wi-Fi)`);
console.log(`\nLance LoL quand tu veux, la page se met à jour toute seule. Ctrl+C pour quitter.\n`);

open();
