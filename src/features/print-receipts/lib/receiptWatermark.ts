/**
 * CHEK ORQA FONIDAGI XIRA ELCHI BELGISI (ega so'rovi 2026-11-09: «chekning o'rtasida, orqa fonda logo xira turishi
 * kerak, matn joylashuvi o'zgarmasin»).
 *
 * Termal printer kulrangni chiqara olmaydi (drayver uni yo nuqtalarga, yo butunlay oq / qoraga aylantiradi), chek esa
 * faqat qora va oq (TZ qabul 5). Shuning uchun «xira» — belgi shakli ichidagi siyrak qora nuqtalar to'ri: nuqta
 * 0,25 mm (203 dpi da 2 nuqta), qadam 0,75 mm (6 nuqta), qatorlar yarim qadamga surilgan — qog'ozning ~11 % i. Har
 * printer va drayverda bir xil chiqadi, ustidagi matn o'qiladi.
 *
 * Belgi — `shared/assets/logo qora.png` (Elchi belgisi) chegarasidan olingan ko'pburchaklar (asl rasm bilan 99 % mos),
 * birlik — belgi balandligining 1/1000 qismi, chap-yuqori burchakdan. Belgi ostida «ELCHI» va «POCHTA» yozuvi
 * (2026-11-10, `ELCHI_LOGO_*` quyida) — chekda butun guruh chiziladi.
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

/**
 * Belgi va yozuv guruhi (ega so'rovi 2026-11-10: «logosining pastiga textini ham qo'shib qo'y»): belgi tepada, ostida
 * «ELCHI», uning ostida mayda «POCHTA» — rasmiy logodagi (`shared/assets/logo yozuvlik oq.png`, yozuv o'ngda) harflar va
 * nisbat, faqat belgi ostiga markazlangan. Harflar o'sha rasm chegarasidan olingan ko'pburchaklar (asl rasm bilan
 * «ELCHI» 98,6 %, «POCHTA» 95 % mos). Birlik — belgi birligi (belgi balandligi = 1000), guruh qutisining chap-yuqorisidan.
 */
export const ELCHI_LOGO_WIDTH = 1816;
export const ELCHI_LOGO_HEIGHT = 1808;
/** Belgining guruhdagi chap cheti — guruh markazida. */
export const ELCHI_LOGO_MARK_X = 357;

/** «ELCHI» — belgi ostida, guruh enida (birlik — guruh qutisi). */
export const ELCHI_WORDMARK_POLYGONS: ReadonlyArray<ReadonlyArray<number>> = [
  [
    937, 1097, 887, 1103, 861, 1109, 838, 1117, 814, 1129, 791, 1143, 771, 1159, 756, 1174, 744,
    1188, 726, 1214, 714, 1238, 706, 1258, 700, 1282, 696, 1305, 694, 1328, 694, 1358, 700, 1399,
    706, 1419, 718, 1448, 729, 1469, 743, 1489, 758, 1507, 776, 1525, 797, 1540, 820, 1554, 861,
    1571, 902, 1581, 931, 1584, 963, 1584, 1010, 1578, 1048, 1567, 1069, 1558, 1089, 1546, 1118,
    1525, 1145, 1498, 1161, 1478, 1172, 1460, 1187, 1428, 1197, 1390, 1194, 1388, 1095, 1388, 1078,
    1425, 1057, 1452, 1031, 1473, 1016, 1481, 993, 1490, 975, 1493, 940, 1496, 917, 1493, 887, 1485,
    873, 1478, 855, 1467, 834, 1448, 822, 1434, 813, 1419, 805, 1402, 799, 1384, 794, 1346, 796,
    1308, 802, 1285, 808, 1270, 819, 1250, 828, 1238, 844, 1222, 858, 1210, 873, 1202, 893, 1193,
    914, 1188, 937, 1185, 961, 1185, 978, 1187, 1001, 1193, 1016, 1199, 1034, 1208, 1053, 1223,
    1067, 1238, 1078, 1252, 1087, 1270, 1095, 1291, 1098, 1292, 1194, 1292, 1198, 1290, 1186, 1250,
    1178, 1229, 1166, 1209, 1152, 1188, 1139, 1173, 1113, 1149, 1077, 1127, 1057, 1117, 1034, 1109,
    990, 1100,
  ],
  [
    1, 1110, 0, 1112, 0, 1115, 0, 1568, 1, 1570, 317, 1569, 319, 1565, 318, 1489, 317, 1488, 101,
    1487, 98, 1486, 97, 1483, 97, 1384, 98, 1381, 297, 1380, 299, 1378, 299, 1299, 297, 1296, 98,
    1295, 97, 1293, 97, 1200, 98, 1197, 311, 1195, 312, 1194, 312, 1112, 308, 1110,
  ],
  [
    373, 1111, 372, 1568, 376, 1570, 665, 1570, 666, 1565, 666, 1486, 665, 1483, 475, 1483, 472,
    1482, 471, 1481, 470, 1112, 466, 1110, 376, 1110,
  ],
  [
    1256, 1110, 1255, 1115, 1255, 1565, 1256, 1570, 1349, 1570, 1353, 1568, 1353, 1390, 1354, 1387,
    1358, 1386, 1560, 1386, 1563, 1387, 1563, 1568, 1566, 1570, 1659, 1570, 1661, 1568, 1661, 1115,
    1659, 1110, 1566, 1109, 1563, 1112, 1563, 1296, 1560, 1299, 1355, 1299, 1353, 1296, 1353, 1112,
    1349, 1110,
  ],
  [
    1718, 1110, 1716, 1115, 1716, 1568, 1718, 1570, 1811, 1570, 1815, 1568, 1815, 1565, 1815, 1112,
    1811, 1110,
  ],
];

/** «POCHTA» — «ELCHI» ostida, markazda; P, O, A teshiklari — juft-toq qoida. */
export const ELCHI_CAPTION_POLYGONS: ReadonlyArray<ReadonlyArray<number>> = [
  [
    534, 1631, 513, 1633, 496, 1639, 484, 1645, 469, 1657, 454, 1678, 448, 1692, 445, 1707, 445,
    1724, 448, 1745, 454, 1759, 463, 1774, 475, 1786, 493, 1797, 507, 1803, 525, 1807, 542, 1807,
    563, 1805, 577, 1800, 592, 1792, 607, 1780, 618, 1765, 628, 1745, 631, 1730, 631, 1713, 628,
    1692, 622, 1678, 613, 1664, 600, 1651, 586, 1642, 572, 1636, 551, 1632,
  ],
  [
    806, 1631, 785, 1633, 768, 1639, 756, 1645, 740, 1657, 729, 1672, 720, 1692, 717, 1707, 716,
    1724, 720, 1745, 726, 1759, 735, 1774, 747, 1786, 759, 1795, 776, 1803, 797, 1807, 811, 1808,
    829, 1806, 844, 1802, 867, 1790, 879, 1779, 888, 1768, 897, 1751, 900, 1739, 899, 1736, 896,
    1736, 867, 1736, 863, 1739, 852, 1756, 838, 1768, 829, 1772, 814, 1775, 803, 1775, 788, 1772,
    776, 1765, 768, 1757, 760, 1748, 755, 1736, 753, 1721, 754, 1707, 759, 1692, 764, 1683, 773,
    1674, 791, 1665, 814, 1663, 835, 1668, 849, 1677, 859, 1689, 864, 1701, 896, 1702, 900, 1701,
    901, 1698, 897, 1686, 888, 1669, 882, 1661, 867, 1648, 852, 1639, 838, 1634,
  ],
  [
    235, 1634, 233, 1637, 233, 1800, 235, 1802, 268, 1803, 269, 1800, 270, 1751, 306, 1749, 326,
    1744, 338, 1737, 351, 1724, 357, 1713, 360, 1698, 359, 1680, 356, 1669, 347, 1654, 337, 1645,
    326, 1640, 311, 1635, 297, 1634,
  ],
  [
    987, 1635, 985, 1640, 985, 1800, 987, 1803, 1019, 1803, 1022, 1800, 1022, 1739, 1025, 1736,
    1096, 1736, 1098, 1739, 1098, 1800, 1101, 1803, 1133, 1803, 1135, 1800, 1134, 1640, 1133, 1635,
    1101, 1635, 1099, 1637, 1099, 1701, 1095, 1705, 1023, 1704, 1021, 1701, 1021, 1637, 1019, 1635,
  ],
  [
    1224, 1636, 1220, 1640, 1221, 1666, 1224, 1667, 1268, 1667, 1271, 1669, 1271, 1800, 1272, 1803,
    1306, 1804, 1307, 1800, 1307, 1669, 1311, 1667, 1355, 1667, 1357, 1666, 1356, 1637,
  ],
  [
    1469, 1636, 1405, 1800, 1405, 1803, 1440, 1803, 1458, 1761, 1461, 1758, 1525, 1758, 1528, 1759,
    1545, 1803, 1548, 1804, 1580, 1804, 1582, 1800, 1581, 1797, 1517, 1637, 1513, 1635,
  ],
  [
    531, 1663, 542, 1662, 557, 1665, 575, 1674, 587, 1689, 594, 1710, 593, 1733, 590, 1742, 584,
    1754, 575, 1763, 566, 1769, 545, 1775, 531, 1775, 519, 1772, 510, 1769, 501, 1763, 489, 1748,
    482, 1727, 483, 1704, 487, 1693, 493, 1683, 507, 1670, 519, 1665,
  ],
  [
    269, 1666, 273, 1665, 300, 1665, 311, 1668, 316, 1672, 321, 1680, 323, 1695, 321, 1704, 314,
    1712, 308, 1716, 300, 1718, 270, 1718, 269, 1716,
  ],
  [
    1492, 1672, 1493, 1671, 1494, 1672, 1502, 1692, 1514, 1724, 1513, 1726, 1475, 1726, 1471, 1724,
  ],
];

/** Nuqtalar to'ri, mm. */
export const RECEIPT_WATERMARK_DOT = 0.25;
export const RECEIPT_WATERMARK_PITCH = 0.75;
/**
 * Mayda «POCHTA» uchun zichroq to'r (0,5 mm): 0,75 mm da harf chizig'i bitta nuqta enida qolib o'qilmasdi (203 dpi
 * sinovi). Siyoh ~25 %, faqat shu yozuvda.
 */
export const RECEIPT_WATERMARK_CAPTION_PITCH = 0.5;

/** Nuqta qatori: `[qator markazi y, birinchi nuqta markazi x, nuqtalar soni]` — guruh qutisining chap-yuqorisidan, mm. */
export type ReceiptWatermarkRun = readonly [y: number, x: number, count: number];

/** Juft-toq qoida — berilgan ko'pburchaklar bo'yicha (teshiklar ham). */
const insidePolygons = (
  polygons: ReadonlyArray<ReadonlyArray<number>>,
  x: number,
  y: number,
): boolean => {
  let inside = false;
  for (const polygon of polygons) {
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

/** Nuqta belgi ichidami (belgi qutisi birligida; barcha qismlar bo'yicha). */
export const insideElchiMark = (x: number, y: number): boolean =>
  insidePolygons(ELCHI_MARK_POLYGONS, x, y);

/** Nuqta belgi yoki «ELCHI» ichidami (guruh qutisi birligida) — asosiy to'r. */
export const insideElchiLogo = (x: number, y: number): boolean =>
  insideElchiMark(x - ELCHI_LOGO_MARK_X, y) || insidePolygons(ELCHI_WORDMARK_POLYGONS, x, y);

/** Nuqta «POCHTA» ichidami (guruh qutisi birligida) — zichroq to'r. */
export const insideElchiCaption = (x: number, y: number): boolean =>
  insidePolygons(ELCHI_CAPTION_POLYGONS, x, y);

const round3 = (value: number) => Math.round(value * 1000) / 1000;

const runsCache = new Map<string, ReadonlyArray<ReceiptWatermarkRun>>();

/**
 * Balandligi `height` mm bo'lgan guruhning nuqta qatorlari (eni — guruh nisbatida) `pitch` qadamli to'rda. Nuqta
 * markazi shakl ichida bo'lsa chiziladi; ketma-ket nuqtalar bitta qatorga (renderer uni punktir bilan chizadi).
 * Har o'lcham va qatlam bir marta hisoblanadi.
 */
const dotRuns = (
  height: number,
  pitch: number,
  inside: (x: number, y: number) => boolean,
  key: string,
): ReadonlyArray<ReceiptWatermarkRun> => {
  const cacheKey = `${key}:${height}`;
  const cached = runsCache.get(cacheKey);
  if (cached) return cached;
  const unit = ELCHI_LOGO_HEIGHT / height;
  const width = (ELCHI_LOGO_WIDTH / ELCHI_LOGO_HEIGHT) * height;
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
      if (inside(x * unit, y * unit)) {
        first ??= x;
        count += 1;
      } else flush();
    }
    flush();
  }
  const frozen = Object.freeze(runs);
  runsCache.set(cacheKey, frozen);
  return frozen;
};

/** Belgi va «ELCHI» — asosiy to'r (`RECEIPT_WATERMARK_PITCH`). */
export const receiptWatermarkRuns = (height: number): ReadonlyArray<ReceiptWatermarkRun> =>
  dotRuns(height, RECEIPT_WATERMARK_PITCH, insideElchiLogo, "logo");

/** «POCHTA» — zichroq to'r (`RECEIPT_WATERMARK_CAPTION_PITCH`); o'sha guruh qutisida. */
export const receiptWatermarkCaptionRuns = (height: number): ReadonlyArray<ReceiptWatermarkRun> =>
  dotRuns(height, RECEIPT_WATERMARK_CAPTION_PITCH, insideElchiCaption, "caption");

/** Guruh eni, mm (balandligi `height` bo'lganda). */
export const receiptWatermarkWidth = (height: number) =>
  round3((ELCHI_LOGO_WIDTH / ELCHI_LOGO_HEIGHT) * height);
