// main.ts — Kestrel Ridge's hand-in program. The grader runs this file with
// Node 22; it copies the playable game and its screenshots from the
// repository into the output directory and writes the entry's dossier with
// the kit's own library, so the dossier the scorer rebuilds from those same
// files matches byte for byte.
//
//   node main.ts            (MAKEFUN_OUTPUT_DIR stands in for /output)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps the bounty's scorer passes to the same library: the text cap
// shapes the dossier's bytes, the rest only refuse what the gate refuses.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// The grader hands us an empty, writable output directory that is not
// ours to remove (it is a mount point on a read-only file system), so we
// only ever create and fill directories inside it, never delete it.
function copyEntry() {
  mkdirSync(outputDir, { recursive: true });
  cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  if (existsSync(join(repoRoot, 'screenshots'))) {
    cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
  }
}

function writeDossier() {
  const dossier = buildDossier(outputDir, DOSSIER_CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  return dossier.length;
}

function main() {
  copyEntry();
  const bytes = writeDossier();
  console.log(`kestrel-ridge: game and screenshots copied to ${outputDir}; dossier.json written (${bytes} bytes)`);
}

main();
