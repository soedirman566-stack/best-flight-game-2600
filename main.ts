// main.ts — Kestrel Ridge's hand-in program. The grader runs this file with
// Node 22; it copies the playable game and its screenshots from the
// repository into the output directory and writes the entry's dossier with
// the kit's own library, so the dossier the scorer rebuilds from those same
// files matches byte for byte.
//
//   node main.ts            (MAKEFUN_OUTPUT_DIR stands in for /output)

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
};

function copyEntry() {
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  for (const part of ['game', 'screenshots']) {
    cpSync(join(repoRoot, part), join(outputDir, part), { recursive: true });
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
