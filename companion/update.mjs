// Self-update of the .exe: looks at the latest GitHub release, downloads it next to the running
// file and switches to it. Windows lets a running .exe be renamed, not overwritten: the old one
// is renamed aside, the new one takes its name, then it is started and this process exits.

import { writeFile, rename, unlink, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { isNewer } from './version.mjs';

const LATEST = process.env.LDC_UPDATE_URL ?? 'https://api.github.com/repos/Vialou07/lol-draft-coach/releases/latest';
const ASSET = 'LolDraftCoach.exe';

const exeDir = () => dirname(process.execPath);
const sidePath = (suffix) => join(exeDir(), `LolDraftCoach.${suffix}.exe`);

export async function cleanupOldVersion() {
  await unlink(sidePath('old')).catch(() => {});
}

export async function findUpdate(current) {
  try {
    const res = await fetch(LATEST, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const release = await res.json();
    const asset = (release.assets ?? []).find((a) => a.name === ASSET);
    if (!asset || !isNewer(release.tag_name, current)) return null;
    return { version: String(release.tag_name).replace(/^v/, ''), url: asset.browser_download_url, size: asset.size };
  } catch {
    return null;
  }
}

export async function installUpdate(update) {
  const res = await fetch(update.url, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`téléchargement ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length < 10e6 || (update.size && body.length !== update.size)) throw new Error('fichier incomplet');
  const next = sidePath('new');
  await writeFile(next, body);
  await cleanupOldVersion();
  await rename(process.execPath, sidePath('old'));
  try {
    await rename(next, process.execPath);
  } catch (e) {
    await rename(sidePath('old'), process.execPath); // put the running version back
    throw e;
  }
  await stat(process.execPath);
}

// Starts the new version in its own window, then this one leaves.
export function restart() {
  spawn(process.execPath, process.argv.slice(2), { detached: true, stdio: 'ignore', env: process.env }).unref();
  setTimeout(() => process.exit(0), 500);
}
