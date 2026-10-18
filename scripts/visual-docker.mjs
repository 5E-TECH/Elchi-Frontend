#!/usr/bin/env node
// Vizual snapshotlarni CI bilan BIR XIL Docker obrazida SOLISHTIRISH (docs/DESIGN_SYSTEM.md §12.5). IXTIYORIY:
// faqat Docker o'rnatilgan mashina uchun, shart emas — tekshiruv baribir CI «Visual» workflow'ida.
//
//   npm run visual:docker                        — barcha sahnalar, 4 loyiha
//   npm run visual:docker -- --project phone-dark -g orders
//
// Baseline YANGILAMAYDI: `-u` / `--update-snapshots` rad etiladi — baseline faqat CI'da yaratiladi
// («Actions → Visual → Run workflow», update — branchga o'zi commit qiladi). Hisobot: playwright-report-visual/.
// Host `node_modules` ga tegilmaydi (nomli volume `elchi-visual-nm`). Konteyner root bo'lib yozadi.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.some((arg) => arg === '-u' || arg.startsWith('--update-snapshots'))) {
  console.error("visual:docker: baseline faqat CI'da yangilanadi («Actions → Visual → Run workflow», update). Bu skript faqat solishtiradi.");
  process.exit(1);
}
const { version } = JSON.parse(readFileSync(join(ROOT, 'node_modules', '@playwright', 'test', 'package.json'), 'utf8'));
const image = `mcr.microsoft.com/playwright:v${version}-noble`;
const quoted = args.map((arg) => `'${arg.replaceAll("'", "'\\''")}'`).join(' ');
const docker = spawnSync(
  'docker',
  [
    'run', '--rm', '--ipc=host',
    '-e', 'CI=1',
    '-v', `${ROOT}:/work`,
    '-v', 'elchi-visual-nm:/work/node_modules',
    '-w', '/work',
    image,
    'bash', '-lc', `npm ci && npm run test:visual -- --update-snapshots=none ${quoted}`,
  ],
  { stdio: 'inherit' },
);
if (docker.error) {
  console.error('visual:docker: Docker topilmadi. Bu ixtiyoriy — vizual tekshiruv CI «Visual» workflow\'ida yuradi.');
  process.exit(1);
}
process.exit(docker.status ?? 1);
