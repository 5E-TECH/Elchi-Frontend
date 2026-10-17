/**
 * HUDUDLAR KARTOGRAMMASI JOYLASHUVI (maket `superadmin--dashboard-main.html` → `.el-tilemap`, 7 ustun × 3 qator).
 *
 * Viloyat ↔ katak bog'lanishi NOM bo'yicha (backend `region/stats/all` id'lari muhitga qarab farq qiladi).
 * Nomni moslashtirish `pages/region/ui/UzbekistanRegionMap.tsx` dagi qoidani takrorlaydi (o'sha fayl
 * import QILINMAYDI — u Highcharts chunk'iga tortadi): kichik harf, apostroflar olib tashlanadi,
 * «Toshkent shahri» / «Toshkent viloyati» alohida, qolganida «viloyati / respublikasi» qo'shimchalari tushadi.
 */
export interface RegionTile {
  key: string;
  /** Katak va jadvaldagi nom (maket): «Toshkent sh.». */
  label: string;
  /** Telefondagi qisqa nom: «TSh». */
  short: string;
  /** Katakdagi nom (uzun so'zlarda yumshoq tire — maketdagi «Qashqa­daryo»). Berilmasa — `label`. */
  tileLabel?: string;
  row: number;
  col: number;
  span?: number;
}

export const REGION_TILE_COLUMNS = 7;
export const REGION_TILE_ROWS = 3;

export const REGION_TILES: readonly RegionTile[] = [
  { key: "qoraqalpogiston", label: "Qoraqalpog'iston", short: "QQ", row: 1, col: 1, span: 2, tileLabel: "Qoraqalpog'\u00adiston" },
  { key: "navoiy", label: "Navoiy", short: "NV", row: 1, col: 3 },
  { key: "sirdaryo", label: "Sirdaryo", short: "SR", row: 1, col: 4 },
  { key: "toshkentviloyati", label: "Toshkent viloyati", short: "TV", row: 1, col: 5 },
  { key: "namangan", label: "Namangan", short: "NM", row: 1, col: 6 },
  { key: "andijon", label: "Andijon", short: "AN", row: 1, col: 7 },
  { key: "xorazm", label: "Xorazm", short: "XR", row: 2, col: 1 },
  { key: "buxoro", label: "Buxoro", short: "BX", row: 2, col: 2 },
  { key: "samarqand", label: "Samarqand", short: "SM", row: 2, col: 3, tileLabel: "Samar\u00adqand" },
  { key: "jizzax", label: "Jizzax", short: "JZ", row: 2, col: 4 },
  { key: "toshkentshahri", label: "Toshkent sh.", short: "TSh", row: 2, col: 5 },
  { key: "fargona", label: "Farg'ona", short: "FR", row: 2, col: 6 },
  { key: "qashqadaryo", label: "Qashqadaryo", short: "QD", row: 3, col: 3, tileLabel: "Qashqa\u00addaryo" },
  { key: "surxondaryo", label: "Surxondaryo", short: "SX", row: 3, col: 4, tileLabel: "Surxon\u00addaryo" },
];

const ALIASES: Record<string, string> = {
  toshkent: "toshkentviloyati",
  toshkentsh: "toshkentshahri",
  qoraqalpoq: "qoraqalpogiston",
};

/** API nomi → layout kaliti (`"Toshkent shahri"` → `toshkentshahri`, `"Farg'ona viloyati"` → `fargona`). */
export const normalizeRegionName = (value: string): string => {
  const base = value
    .toLocaleLowerCase()
    .replace(/[ʻʼ'‘’`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/toshkent\s*(shahri|shahar|sh\.?)(\s|$)/.test(base)) return "toshkentshahri";
  if (/toshkent\s*(viloyati|vil\.?)(\s|$)/.test(base)) return "toshkentviloyati";
  const key = base.replace(/respublikasi|viloyati|viloyat|shahri|shahar/g, "").replace(/[\s.]+/g, "");
  return ALIASES[key] ?? key;
};

const TILE_BY_KEY = new Map(REGION_TILES.map((tile) => [tile.key, tile]));

/** API nomi bo'yicha katak (topilmasa `undefined` — jadvalda baribir ko'rinadi). */
export const findRegionTile = (name: string): RegionTile | undefined => TILE_BY_KEY.get(normalizeRegionName(name));
