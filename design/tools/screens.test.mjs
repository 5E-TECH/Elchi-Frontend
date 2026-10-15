// EKRANLAR XARITASI — CI darvozasi (`npm test` ichida yuradi).
// `npm run design:screens -- --check` bilan aynan bir xil: routes.tsx dagi har route design/kit/route-map.json da
// bor, har maket biror route'ga bog'langan, fayllar mavjud, menyu bandlari (menuConfig.tsx) maketdagi menyu
// (design/kit/roles.json) bilan bir xil va design/SCREENS.md yangi. Yiqilsa: xabardagi ro'yxatni tuzating,
// `npm run design:screens` ni yuring va SCREENS.md ni commit qiling. Testni o'chirish yoki yumshatish taqiqlanadi (AGENTS.md).
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'screens.mjs');

describe('design/SCREENS.md — route ↔ maket xaritasi', () => {
  it('xarita to\'liq va SCREENS.md yangi (npm run design:screens -- --check)', () => {
    const res = spawnSync(process.execPath, [SCRIPT, '--check'], { encoding: 'utf8' });
    expect(res.status, `${res.stdout}\n${res.stderr}`).toBe(0);
  });
});
