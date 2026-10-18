#!/usr/bin/env node
// Vizual baseline'larni CI artefaktidan olish (docs/DESIGN_SYSTEM.md §12.5). IXTIYORIY yordamchi.
//
// Odatiy yo'l bu skript EMAS: «Actions → Visual → Run workflow» (update) baseline'larni Docker obrazida yaratib,
// shu branchga o'zi commit qiladi — keyin `git pull` yetarli. Bu skript artefaktni qo'lda ko'rib chiqish yoki
// commit'siz olish uchun:
//
//   npm run visual:pull                         — gh CLI kerak: joriy branchning eng so'nggi «visual-baselines»
//                                                  artefakti (yoki `-- --run <id>` — aniq yugurish)
//   npm run visual:pull -- --from <fayl.zip>    — gh'siz: Actions sahifasidan qo'lda yuklangan artefakt (unzip kerak)
//   npm run visual:pull -- --from <papka>       — gh'siz: ochilgan artefakt papkasi
//   … --mirror                                  — artefaktda yo'q eski PNG'larni ham o'chiradi (to'liq artefakt bo'lsa)
//
// Faqat `<loyiha>/<sahna>.png` fayllari `tests/visual/__screenshots__/` ga ko'chiriladi, so'ng `git status`.
// Lokal mashinada baseline YARATILMAYDI — faqat CI natijasi ko'chiriladi.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(ROOT, 'tests', 'visual', '__screenshots__');
const PROJECTS = ['desktop-light', 'desktop-dark', 'phone-light', 'phone-dark'];
const ARTIFACT = 'visual-baselines';
const WORKFLOW = 'visual.yml';
const SCENE_FILE = /^[a-z0-9]+(-[a-z0-9]+)*\.png$/;

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
class PullError extends Error {}
const fail = (message) => {
  throw new PullError(message);
};
const run = (command, commandArgs, options = {}) =>
  spawnSync(command, commandArgs, { cwd: ROOT, encoding: 'utf8', ...options });

const work = mkdtempSync(join(tmpdir(), 'elchi-visual-'));
const cleanup = () => rmSync(work, { recursive: true, force: true });

/** Artefakt manbasi → ochilgan papka. */
const fetchArtifact = () => {
  const from = opt('--from');
  if (from) {
    const source = resolve(process.cwd(), from);
    if (!existsSync(source)) fail(`topilmadi: ${source}`);
    if (statSync(source).isDirectory()) return source;
    const unzip = run('unzip', ['-q', '-o', source, '-d', work]);
    if (unzip.error) fail("`unzip` topilmadi — zip'ni o'zingiz oching va `--from <papka>` bering.");
    if (unzip.status !== 0) fail(`unzip xatosi: ${unzip.stderr || unzip.stdout}`);
    return work;
  }

  const gh = run('gh', ['--version']);
  if (gh.error) {
    fail(
      "gh CLI topilmadi. Variantlar: (1) `git pull` — «Run workflow» (update) baseline'larni branchga o'zi commit qiladi; " +
        `(2) Actions sahifasidan «${ARTIFACT}» artefaktini yuklab, \`npm run visual:pull -- --from <fayl.zip>\`.`,
    );
  }
  const runId = opt('--run');
  const candidates = [];
  if (runId) {
    candidates.push(runId);
  } else {
    const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
    const list = run('gh', ['run', 'list', '--workflow', WORKFLOW, '--branch', branch, '--limit', '20', '--json', 'databaseId']);
    if (list.status !== 0) fail(`gh run list xatosi: ${list.stderr}`);
    for (const item of JSON.parse(list.stdout || '[]')) candidates.push(String(item.databaseId));
    if (!candidates.length) fail(`«${branch}» branchida «Visual» yugurishi yo'q.`);
  }
  for (const id of candidates) {
    const download = run('gh', ['run', 'download', id, '-n', ARTIFACT, '-D', work]);
    if (download.status === 0) {
      console.log(`visual:pull: yugurish ${id} → «${ARTIFACT}»`);
      return work;
    }
  }
  return fail(`«${ARTIFACT}» artefakti topilmadi (muddati o'tgan bo'lishi mumkin — 7 kun). Run workflow (update) ni qayta yuring.`);
};

/** Ichida `desktop-light` / `phone-dark` … papkalari bor katalog (artefakt ildizi). */
const findRoot = (dir, depth = 0) => {
  const entries = readdirSync(dir, { withFileTypes: true });
  if (entries.some((entry) => entry.isDirectory() && PROJECTS.includes(entry.name))) return dir;
  if (depth >= 4) return null;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found = findRoot(join(dir, entry.name), depth + 1);
    if (found) return found;
  }
  return null;
};

try {
  const root = findRoot(fetchArtifact());
  if (!root) fail(`artefaktda ${PROJECTS.join(' / ')} papkalari yo'q.`);
  let copied = 0;
  let removed = 0;
  for (const project of PROJECTS) {
    const source = join(root, project);
    if (!existsSync(source)) continue;
    const files = readdirSync(source).filter((file) => SCENE_FILE.test(file));
    mkdirSync(join(TARGET, project), { recursive: true });
    for (const file of files) {
      cpSync(join(source, file), join(TARGET, project, file));
      copied += 1;
    }
    if (args.includes('--mirror')) {
      for (const file of readdirSync(join(TARGET, project))) {
        if (SCENE_FILE.test(file) && !files.includes(file)) {
          rmSync(join(TARGET, project, file));
          removed += 1;
        }
      }
    }
  }
  console.log(`visual:pull: ${copied} PNG ko'chirildi${removed ? `, ${removed} eskisi o'chirildi` : ''} → tests/visual/__screenshots__/`);
  console.log(run('git', ['status', '--short', '--', 'tests/visual/__screenshots__']).stdout || '(o\'zgarish yo\'q)');
  console.log("PNG farqlarini ko'rib chiqing, keyin commit qiling.");
} catch (error) {
  if (!(error instanceof PullError)) throw error;
  console.error(`visual:pull: ${error.message}`);
  process.exitCode = 1;
} finally {
  cleanup();
}
