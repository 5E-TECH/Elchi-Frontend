/**
 * CHEK ORQA FONIDAGI XIRA ELCHI BELGISI (ega so'rovi 2026-11-09: «chekning o'rtasida, orqa fonda logo xira turishi
 * kerak, matn joylashuvi o'zgarmasin»).
 *
 * Termal printer kulrangni chiqara olmaydi (drayver uni yo nuqtalarga, yo butunlay oq / qoraga aylantiradi), chek esa
 * faqat qora va oq (TZ qabul 5). Shuning uchun «xira» — belgi shakli ichidagi siyrak qora nuqtalar to'ri: nuqta
 * 0,25 mm (203 dpi da 2 nuqta), qadam 0,75 mm (6 nuqta), qatorlar yarim qadamga surilgan — qog'ozning ~11 % i. Har
 * printer va drayverda bir xil chiqadi, ustidagi matn o'qiladi.
 *
 * Belgi — `shared/assets/logo qora.png` (Elchi belgisi, «ELCHI POCHTA» yozuvisiz) chegarasidan olingan ko'pburchaklar
 * (asl rasm bilan 99 % mos), birlik — belgi balandligining 1/1000 qismi, chap-yuqori burchakdan.
 */

/** Belgi qutisi (birlik): eni va balandligi. */
export const ELCHI_MARK_WIDTH = 1101;
export const ELCHI_MARK_HEIGHT = 1000;

/** Belgi qismlari (bosh, ikki qanot, ikki yon barg): `[x0, y0, x1, y1, …]` — yopiq ko'pburchak. */
export const ELCHI_MARK_POLYGONS: ReadonlyArray<ReadonlyArray<number>> = [
  [
    944, 155, 962, 155, 991, 161, 1087, 210, 1094, 217, 1100, 230, 1101, 243, 1099, 253, 1095, 261,
    1086, 270, 1079, 273, 1071, 281, 1065, 283, 1034, 308, 1027, 310, 1010, 325, 1004, 327, 973,
    352, 966, 355, 935, 379, 929, 382, 897, 406, 862, 430, 835, 455, 835, 457, 819, 474, 806, 495,
    795, 521, 783, 568, 783, 771, 778, 800, 768, 830, 745, 868, 726, 890, 723, 890, 708, 905, 671,
    930, 588, 994, 578, 999, 578, 492, 583, 456, 594, 426, 605, 404, 619, 384, 664, 343, 686, 329,
    714, 305, 745, 284, 892, 174, 919, 160,
  ],
  [
    139, 155, 173, 157, 201, 169, 352, 282, 358, 284, 382, 304, 388, 306, 412, 326, 418, 329, 438,
    345, 440, 345, 479, 382, 495, 403, 509, 430, 518, 457, 522, 479, 522, 999, 381, 895, 355, 866,
    335, 834, 322, 796, 317, 757, 319, 631, 319, 584, 317, 561, 303, 512, 281, 473, 261, 452, 261,
    449, 240, 431, 191, 397, 145, 362, 139, 360, 108, 335, 101, 332, 70, 308, 64, 305, 27, 277, 21,
    274, 6, 261, 3, 255, 0, 245, 1, 229, 6, 218, 14, 210, 104, 164,
  ],
  [
    535, 0, 566, 0, 599, 6, 631, 21, 648, 32, 671, 55, 691, 83, 703, 112, 708, 136, 709, 164, 704,
    199, 696, 221, 675, 256, 658, 274, 632, 294, 605, 306, 574, 314, 540, 316, 509, 310, 471, 295,
    451, 281, 429, 258, 410, 231, 400, 206, 394, 175, 394, 139, 399, 113, 413, 79, 432, 52, 452, 34,
    475, 18, 508, 5,
  ],
  [
    1039, 360, 1040, 529, 1032, 569, 1016, 606, 1000, 629, 964, 664, 931, 686, 897, 713, 891, 716,
    847, 751, 835, 757, 836, 582, 845, 543, 857, 517, 875, 490, 899, 465,
  ],
  [
    61, 360, 183, 452, 195, 458, 217, 479, 242, 513, 257, 548, 265, 586, 265, 757, 131, 658, 108,
    636, 83, 603, 68, 566, 61, 532,
  ],
];

/** Nuqtalar to'ri, mm. */
export const RECEIPT_WATERMARK_DOT = 0.25;
export const RECEIPT_WATERMARK_PITCH = 0.75;

/** Nuqta qatori: `[qator markazi y, birinchi nuqta markazi x, nuqtalar soni]` — belgi qutisining chap-yuqorisidan, mm. */
export type ReceiptWatermarkRun = readonly [y: number, x: number, count: number];

/** Nuqta belgi ichidami (juft-toq qoida — barcha qismlar bo'yicha). */
export const insideElchiMark = (x: number, y: number): boolean => {
  let inside = false;
  for (const polygon of ELCHI_MARK_POLYGONS) {
    const count = polygon.length / 2;
    for (let i = 0, j = count - 1; i < count; j = i, i += 1) {
      const xi = polygon[i * 2];
      const yi = polygon[i * 2 + 1];
      const xj = polygon[j * 2];
      const yj = polygon[j * 2 + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
};

const round3 = (value: number) => Math.round(value * 1000) / 1000;

const runsCache = new Map<number, ReadonlyArray<ReceiptWatermarkRun>>();

/**
 * Balandligi `height` mm bo'lgan belgining nuqta qatorlari (eni — belgi nisbatida). Nuqta markazi belgi ichida bo'lsa
 * chiziladi; ketma-ket nuqtalar bitta qatorga (renderer uni punktir bilan chizadi). Har o'lcham bir marta hisoblanadi.
 */
export const receiptWatermarkRuns = (height: number): ReadonlyArray<ReceiptWatermarkRun> => {
  const cached = runsCache.get(height);
  if (cached) return cached;
  const pitch = RECEIPT_WATERMARK_PITCH;
  const unit = ELCHI_MARK_HEIGHT / height;
  const width = (ELCHI_MARK_WIDTH / ELCHI_MARK_HEIGHT) * height;
  const runs: ReceiptWatermarkRun[] = [];
  for (let row = 0; (row + 0.5) * pitch < height; row += 1) {
    const y = (row + 0.5) * pitch;
    const shift = row % 2 ? pitch / 2 : 0;
    let first: number | null = null;
    let count = 0;
    const flush = () => {
      if (first !== null) runs.push([round3(y), round3(first), count]);
      first = null;
      count = 0;
    };
    for (let column = 0; (column + 0.5) * pitch + shift < width; column += 1) {
      const x = (column + 0.5) * pitch + shift;
      if (insideElchiMark(x * unit, y * unit)) {
        first ??= x;
        count += 1;
      } else flush();
    }
    flush();
  }
  const frozen = Object.freeze(runs);
  runsCache.set(height, frozen);
  return frozen;
};

/** Belgi eni, mm (balandligi `height` bo'lganda). */
export const receiptWatermarkWidth = (height: number) =>
  round3((ELCHI_MARK_WIDTH / ELCHI_MARK_HEIGHT) * height);
