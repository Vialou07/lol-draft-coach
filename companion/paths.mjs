// Where the companion keeps its local files (caches, group, settings, log).
// From the repository: data/local. As a single .exe: %LOCALAPPDATA%\LolDraftCoach.
// LDC_DATA_DIR overrides both (tests use a temporary folder).

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSea } from 'node:sea';

export const isPackaged = () => isSea();

export function dataDir() {
  if (process.env.LDC_DATA_DIR) return process.env.LDC_DATA_DIR;
  if (isPackaged()) return join(process.env.LOCALAPPDATA ?? process.env.HOME ?? '.', 'LolDraftCoach');
  return fileURLToPath(new URL('../data/local/', import.meta.url));
}

export const dataFile = (...parts) => join(dataDir(), ...parts);
