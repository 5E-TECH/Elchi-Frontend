/**
 * Sintetik zavod shtrix kodlari (Trello CO66kcoB) — unit testlar (`zxingDecoder.test.ts`) va e2e soxta kamera
 * (`tests/e2e/support/barcodeCamera.ts`) uchun. Kodlash GS1 jadvallari bo'yicha: modullar satri, `"1"` — qora.
 */

const L_CODES = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const R_CODES = L_CODES.map((code) => [...code].map((bit) => (bit === "1" ? "0" : "1")).join(""));
const G_CODES = R_CODES.map((code) => [...code].reverse().join(""));
/** EAN-13 birinchi raqami → chap yarmining L/G tartibi. */
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** EAN-13 (13 raqam, nazorat raqami bilan) → 95 modul. Nazorat raqami TEKSHIRILMAYDI (xato kod testi uchun). */
export const ean13Modules = (digits: string): string => {
  if (!/^\d{13}$/.test(digits)) throw new Error(`EAN-13: 13 raqam kerak, berildi ${digits}`);
  const parity = PARITY[Number(digits[0])];
  let modules = "101";
  for (let index = 1; index <= 6; index += 1) {
    modules += (parity[index - 1] === "L" ? L_CODES : G_CODES)[Number(digits[index])];
  }
  modules += "01010";
  for (let index = 7; index <= 12; index += 1) modules += R_CODES[Number(digits[index])];
  return `${modules}101`;
};

/** UPC-A (12 raqam) — EAN-13 ning `0` bilan boshlanadigani. */
export const upcAModules = (digits: string): string => ean13Modules(`0${digits}`);

/** EAN-8 (8 raqam) → 67 modul. */
export const ean8Modules = (digits: string): string => {
  if (!/^\d{8}$/.test(digits)) throw new Error(`EAN-8: 8 raqam kerak, berildi ${digits}`);
  const left = [...digits.slice(0, 4)].map((digit) => L_CODES[Number(digit)]).join("");
  const right = [...digits.slice(4)].map((digit) => R_CODES[Number(digit)]).join("");
  return `101${left}01010${right}101`;
};

/**
 * Code128 (B to'plami) — chiziq kengliklari jadvali (`patterns`, 107 qator: 6 ta kenglik, STOP — 7) tashqaridan
 * beriladi (testda ZXing `Code128Reader.CODE_PATTERNS`), bu yerda faqat kodlash.
 */
export const code128Modules = (text: string, patterns: readonly ArrayLike<number>[]): string => {
  const START_B = 104;
  const STOP = 106;
  const values = [START_B, ...[...text].map((char) => char.charCodeAt(0) - 32)];
  const checksum = values.reduce((sum, value, index) => sum + value * Math.max(1, index), 0) % 103;
  const widthsToModules = (widths: ArrayLike<number>) =>
    Array.from(widths, (width, index) => (index % 2 === 0 ? "1" : "0").repeat(width)).join("");
  return [...values, checksum, STOP].map((value) => widthsToModules(patterns[value])).join("");
};

/**
 * Modullar → kulrang kadr (`width × height`): fon oq (230), chiziq qora (25); kod markazda, `moduleWidth` piksel
 * (kasr bo'lishi mumkin), bo'yi — kadrning `barHeight` ulushi.
 */
export const renderModules = (
  modules: string,
  { width, height, moduleWidth, barHeight = 0.5 }: { width: number; height: number; moduleWidth: number; barHeight?: number },
): Uint8ClampedArray => {
  const gray = new Uint8ClampedArray(width * height).fill(230);
  const left = (width - modules.length * moduleWidth) / 2;
  const top = Math.round((height * (1 - barHeight)) / 2);
  const bottom = top + Math.round(height * barHeight);
  for (let x = 0; x < width; x += 1) {
    const index = Math.floor((x + 0.5 - left) / moduleWidth);
    if (index < 0 || index >= modules.length || modules[index] !== "1") continue;
    for (let y = top; y < bottom; y += 1) gray[y * width + x] = 25;
  }
  return gray;
};
