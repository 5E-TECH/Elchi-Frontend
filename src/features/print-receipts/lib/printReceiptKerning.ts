/**
 * CHEK SHRIFTI KERNINGI (HJ5sLHiz, maket `tizim-receipts`). Maket brauzerda Manrope kerningi bilan chizilgan (Chrome
 * sukuti), jsPDF esa kerning qo'llamaydi. Shuning uchun kerning juftliklari shu TTF ning o'zidan (GPOS `kern` —
 * PairPos 1- va 2-format, Extension orqali ham) o'qiladi va o'lchashga ham, ikkala rendererga ham bitta manbadan
 * beriladi: PDF matnni juftlik joyidan bo'lib chizadi, HTML o'sha joyga `margin-right` qo'yadi (brauzerning o'z
 * kerningi o'chiq — `font-kerning: none`). Natija — PDF va brauzer bir xil, maket bilan ham bir xil.
 *
 * Qoida HarfBuzz bilan bir xil: har lookup (indeks tartibida) uchun birinchi mos subtable — 1-format: juftlik topilsa;
 * 2-format: birinchi glif qamrovda bo'lsa (klass juftligi, 0 ham). Faqat birinchi glifning `XAdvance` i (Manrope'da
 * `ValueFormat2 = 0`). Belgilarni o'tkazib yuborish (`IgnoreMarks`) kerak emas: chek matnida diakritik belgi yo'q
 * (`normalizeReceiptText`).
 */

/** Juftlik tuzatishi, em (1 pt shriftda — pt). Glif yo'q yoki juftlik yo'q — 0. */
export type ReceiptPairKerning = (left: string, right: string) => number;

const NO_KERNING: ReceiptPairKerning = () => 0;

/** Ikkilik satr (`\x00\x01…`, har belgi — bayt) ustida o'quvchi. */
class FontReader {
  private readonly data: string;

  constructor(data: string) {
    this.data = data;
  }

  u8(at: number) {
    return this.data.charCodeAt(at) & 0xff;
  }

  u16(at: number) {
    return (this.u8(at) << 8) | this.u8(at + 1);
  }

  i16(at: number) {
    const value = this.u16(at);
    return value & 0x8000 ? value - 0x10000 : value;
  }

  u32(at: number) {
    return this.u16(at) * 0x10000 + this.u16(at + 2);
  }

  tag(at: number) {
    return this.data.slice(at, at + 4);
  }

  get length() {
    return this.data.length;
  }
}

const tableOffsets = (font: FontReader) => {
  const tables = new Map<string, number>();
  const count = font.u16(4);
  for (let index = 0; index < count; index += 1) {
    const record = 12 + index * 16;
    tables.set(font.tag(record), font.u32(record + 8));
  }
  return tables;
};

/** cmap: belgi → glif (3/10 yoki 0/4 — 12-format, aks holda 3/1 yoki 0/3 — 4-format). */
const createCmap = (font: FontReader, cmap: number): ((code: number) => number) => {
  const count = font.u16(cmap + 2);
  let format4 = -1;
  let format12 = -1;
  for (let index = 0; index < count; index += 1) {
    const record = cmap + 4 + index * 8;
    const platform = font.u16(record);
    const encoding = font.u16(record + 2);
    const subtable = cmap + font.u32(record + 4);
    const format = font.u16(subtable);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    if (format === 12 && format12 < 0) format12 = subtable;
    if (format === 4 && format4 < 0) format4 = subtable;
  }
  if (format12 >= 0) {
    const groups = font.u32(format12 + 12);
    return (code) => {
      let low = 0;
      let high = groups - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const group = format12 + 16 + mid * 12;
        if (code < font.u32(group)) high = mid - 1;
        else if (code > font.u32(group + 4)) low = mid + 1;
        else return font.u32(group + 8) + code - font.u32(group);
      }
      return 0;
    };
  }
  if (format4 >= 0) {
    const segments = font.u16(format4 + 6) / 2;
    const ends = format4 + 14;
    const starts = ends + segments * 2 + 2;
    const deltas = starts + segments * 2;
    const ranges = deltas + segments * 2;
    return (code) => {
      if (code > 0xffff) return 0;
      for (let index = 0; index < segments; index += 1) {
        if (font.u16(ends + index * 2) < code) continue;
        const start = font.u16(starts + index * 2);
        if (start > code) return 0;
        const delta = font.u16(deltas + index * 2);
        const rangeAt = ranges + index * 2;
        const range = font.u16(rangeAt);
        if (range === 0) return (code + delta) & 0xffff;
        const glyph = font.u16(rangeAt + range + (code - start) * 2);
        return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
      }
      return 0;
    };
  }
  return () => 0;
};

/** Coverage → indeks (yo'q — −1). */
const coverageIndex = (font: FontReader, coverage: number, glyph: number) => {
  const format = font.u16(coverage);
  const count = font.u16(coverage + 2);
  let low = 0;
  let high = count - 1;
  if (format === 1) {
    while (low <= high) {
      const mid = (low + high) >> 1;
      const value = font.u16(coverage + 4 + mid * 2);
      if (glyph < value) high = mid - 1;
      else if (glyph > value) low = mid + 1;
      else return mid;
    }
    return -1;
  }
  if (format === 2) {
    while (low <= high) {
      const mid = (low + high) >> 1;
      const record = coverage + 4 + mid * 6;
      if (glyph < font.u16(record)) high = mid - 1;
      else if (glyph > font.u16(record + 2)) low = mid + 1;
      else return font.u16(record + 4) + glyph - font.u16(record);
    }
  }
  return -1;
};

const classOf = (font: FontReader, classDef: number, glyph: number) => {
  const format = font.u16(classDef);
  if (format === 1) {
    const start = font.u16(classDef + 2);
    const count = font.u16(classDef + 4);
    return glyph >= start && glyph < start + count
      ? font.u16(classDef + 6 + (glyph - start) * 2)
      : 0;
  }
  if (format === 2) {
    let low = 0;
    let high = font.u16(classDef + 2) - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const record = classDef + 4 + mid * 6;
      if (glyph < font.u16(record)) high = mid - 1;
      else if (glyph > font.u16(record + 2)) low = mid + 1;
      else return font.u16(record + 4);
    }
  }
  return 0;
};

const bitCount = (value: number) => {
  let count = 0;
  for (let bits = value; bits; bits &= bits - 1) count += 1;
  return count;
};

/** ValueRecord ichidagi `XAdvance` (0x0004) joyi, bayt; yo'q — −1. */
const xAdvanceAt = (valueFormat: number) =>
  valueFormat & 0x0004 ? bitCount(valueFormat & 0x0003) * 2 : -1;

/** Bitta PairPos subtable: `null` — qo'llanmadi (keyingi subtable), son — tuzatish (font birligida). */
type PairSubtable = (left: number, right: number) => number | null;

const pairSubtable = (font: FontReader, subtable: number): PairSubtable | null => {
  const format = font.u16(subtable);
  const coverage = subtable + font.u16(subtable + 2);
  const format1 = font.u16(subtable + 4);
  const format2 = font.u16(subtable + 6);
  const size1 = bitCount(format1) * 2;
  const recordSize = size1 + bitCount(format2) * 2;
  const advance = xAdvanceAt(format1);
  const read = (record: number) => (advance < 0 ? 0 : font.i16(record + advance));
  if (format === 1) {
    return (left, right) => {
      const index = coverageIndex(font, coverage, left);
      if (index < 0) return null;
      const set = subtable + font.u16(subtable + 10 + index * 2);
      let low = 0;
      let high = font.u16(set) - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const record = set + 2 + mid * (2 + recordSize);
        const second = font.u16(record);
        if (right < second) high = mid - 1;
        else if (right > second) low = mid + 1;
        else return read(record + 2);
      }
      return null;
    };
  }
  if (format === 2) {
    const classDef1 = subtable + font.u16(subtable + 8);
    const classDef2 = subtable + font.u16(subtable + 10);
    const class1Count = font.u16(subtable + 12);
    const class2Count = font.u16(subtable + 14);
    return (left, right) => {
      if (coverageIndex(font, coverage, left) < 0) return null;
      const class1 = classOf(font, classDef1, left);
      const class2 = classOf(font, classDef2, right);
      if (class1 >= class1Count || class2 >= class2Count) return null;
      return read(subtable + 16 + (class1 * class2Count + class2) * recordSize);
    };
  }
  return null;
};

/** GPOS `kern` lookup'lari (indeks tartibida), har biri — PairPos subtable'lar ro'yxati. */
const kernLookups = (font: FontReader, gpos: number): PairSubtable[][] => {
  const featureList = gpos + font.u16(gpos + 6);
  const lookupList = gpos + font.u16(gpos + 8);
  const indices = new Set<number>();
  const features = font.u16(featureList);
  for (let index = 0; index < features; index += 1) {
    const record = featureList + 2 + index * 6;
    if (font.tag(record) !== "kern") continue;
    const feature = featureList + font.u16(record + 4);
    const count = font.u16(feature + 2);
    for (let item = 0; item < count; item += 1) indices.add(font.u16(feature + 4 + item * 2));
  }
  return [...indices]
    .sort((a, b) => a - b)
    .map((index) => {
      const lookup = lookupList + font.u16(lookupList + 2 + index * 2);
      const type = font.u16(lookup);
      const count = font.u16(lookup + 4);
      const subtables: PairSubtable[] = [];
      for (let item = 0; item < count; item += 1) {
        let subtable = lookup + font.u16(lookup + 6 + item * 2);
        let subtableType = type;
        if (type === 9) {
          subtableType = font.u16(subtable + 2);
          subtable += font.u32(subtable + 4);
        }
        if (subtableType !== 2) continue;
        const parsed = pairSubtable(font, subtable);
        if (parsed) subtables.push(parsed);
      }
      return subtables;
    });
};

/**
 * TTF (jsPDF VFS uchun ikkilik satr) → juftlik kerningi, em. GPOS yo'q (Noto bo'lagi) yoki o'qib bo'lmasa — 0.
 * Natijalar keshlanadi.
 */
export const createPairKerning = (data: string): ReceiptPairKerning => {
  try {
    const font = new FontReader(data);
    const tables = tableOffsets(font);
    const head = tables.get("head");
    const cmap = tables.get("cmap");
    const gpos = tables.get("GPOS");
    if (head === undefined || cmap === undefined || gpos === undefined) return NO_KERNING;
    const unitsPerEm = font.u16(head + 18) || 1000;
    const glyphOf = createCmap(font, cmap);
    const lookups = kernLookups(font, gpos);
    if (!lookups.length) return NO_KERNING;
    const cache = new Map<string, number>();
    return (left, right) => {
      const key = left + right;
      let value = cache.get(key);
      if (value === undefined) {
        const first = glyphOf(left.codePointAt(0) ?? 0);
        const second = glyphOf(right.codePointAt(0) ?? 0);
        let units = 0;
        if (first && second) {
          for (const subtables of lookups) {
            for (const subtable of subtables) {
              const adjustment = subtable(first, second);
              if (adjustment !== null) {
                units += adjustment;
                break;
              }
            }
          }
        }
        value = units / unitsPerEm;
        cache.set(key, value);
      }
      return value;
    };
  } catch {
    return NO_KERNING;
  }
};
