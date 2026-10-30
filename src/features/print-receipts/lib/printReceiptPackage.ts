import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  MM_PER_PT,
  normalizeReceiptText,
  type ReceiptMeasure,
  type ReceiptWeight,
} from "./printReceiptFonts";
import {
  ellipsizeReceiptChars,
  receiptBaseline,
  receiptBaselineAtCenter,
  roundReceiptMm as round3,
  withReceiptKerning,
  type ReceiptLabel,
  type ReceiptOp,
} from "./printReceiptLayout";
import { formatReceiptDate, RECEIPT_TEXT } from "./printReceiptModel";
import { encodeReceiptQr, receiptQrModule, type ReceiptQrSymbol } from "./printReceiptQr";
import { cleanReceiptValue, formatReceiptPhone } from "./receiptContact";

/**
 * PAKET VA POCHTA CHEKI (HJ5sLHiz, maket `tizim-receipts` 02, TZ F8): qop yoki paket ustiga yopishtiriladi. Termal
 * 100×60 (1 mm = 5 px) va ofis printeri uchun A5 (chekka 10 mm, 1 mm = 3 px) — maydonlar va tartib bir xil:
 * qora yorliq (turi) + vaqt, raqam, «Qayerdan» / «Qayerga», «Buyurtmalar» va «Jami summa», haydovchi (avtomobil) yoki
 * kuryer, QR (faqat token) va «Qabul qilishda skanerlang», pastda «Qabul qildi / Imzo».
 *
 * Bo'sh maydon chiqmaydi: «Qayerdan» (pochtada BE-2 — `post.branch`), haydovchi, avtomobil, kuryer, jami summa.
 */

export interface ReceiptPersonSource {
  name?: string | null;
  phone_number?: string | null;
}

/** Kirish turi — sahifalar o'z ma'lumotini shu shaklga keltiradi (`pages/*` dan import yo'q). */
export interface ReceiptPackageSource {
  /** `batch` — filial paketi (`BTB-…` / `BTR-…`), `post` — pochta (`POST-…`). */
  kind: "batch" | "post";
  id: string | number;
  /** Filial paketi yo'nalishi: `return` — «Qaytarish paketi». */
  direction?: string | null;
  /** QR mazmuni (faqat token). Yo'q — «QR yo'q» ramkasi. */
  token?: string | null;
  createdAt?: string | null;
  /** «Qayerdan»: filial nomi. */
  from?: string | null;
  /** «Qayerga»: qabul qiluvchi filial yoki pochta viloyati. */
  to?: string | null;
  ordersCount?: number | string | null;
  /** Kelmasa «Jami summa» chiqmaydi. */
  totalPrice?: number | string | null;
  driver?: ReceiptPersonSource | null;
  vehiclePlate?: string | null;
  /** Pochta kuryeri. */
  courier?: ReceiptPersonSource | null;
}

export interface ReceiptPackagePerson {
  /** «Haydovchi» / «Kuryer». */
  role: string;
  name: string;
  phone: string;
}

export interface ReceiptPackageModel {
  id: string;
  /** Qora yorliq: «FILIAL PAKETI», «QAYTARISH PAKETI», «POCHTA». */
  badge: string;
  /** «B-172» yoki «№2493». */
  ref: string;
  /** «23.10.2026, 14:15» (Toshkent vaqti). */
  date: string;
  from: string;
  to: string;
  /** «48 ta». */
  orders: string;
  /** «8 640 000 so'm»; kelmasa — `null`. */
  total: string | null;
  person: ReceiptPackagePerson | null;
  vehicle: string;
  qrToken: string | null;
}

export const RECEIPT_PACKAGE_TEXT = Object.freeze({
  batch: "Filial paketi",
  returnBatch: "Qaytarish paketi",
  post: "Pochta",
  from: "Qayerdan",
  to: "Qayerga",
  orders: "Buyurtmalar",
  total: "Jami summa",
  driver: "Haydovchi",
  vehicle: "Avtomobil",
  courier: "Kuryer",
  scan: ["Qabul qilishda", "skanerlang"] as const,
  received: "Qabul qildi:",
  signature: "Imzo:",
});

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
};

/** Matn; bo'sh joy tutuvchi («-», «—», «null» — `cleanReceiptValue`) — `""` (qator chiqmaydi). */
const textOf = (value: unknown) => cleanReceiptValue(normalizeReceiptText(value));

const packageRef = (source: ReceiptPackageSource) => {
  const id = textOf(source.id);
  if (source.kind === "post") return `№${id}`;
  return id.startsWith("B-") ? id : `B-${id}`;
};

const personOf = (
  role: string,
  source?: ReceiptPersonSource | null,
): ReceiptPackagePerson | null => {
  const name = textOf(source?.name);
  const phone = formatReceiptPhone(source?.phone_number);
  return name || phone ? { role, name, phone } : null;
};

/** Manba → paket cheki maydonlari (TZ F8). */
export const toReceiptPackageModel = (source: ReceiptPackageSource): ReceiptPackageModel => {
  const isPost = source.kind === "post";
  const badge = isPost
    ? RECEIPT_PACKAGE_TEXT.post
    : String(source.direction ?? "").toLowerCase() === "return"
      ? RECEIPT_PACKAGE_TEXT.returnBatch
      : RECEIPT_PACKAGE_TEXT.batch;
  const count = Math.max(0, Math.round(toNumber(source.ordersCount) ?? 0));
  const total = toNumber(source.totalPrice);
  const token = typeof source.token === "string" ? source.token.trim() : "";
  return {
    id: String(source.id),
    badge: badge.toLocaleUpperCase("en-US"),
    ref: packageRef(source),
    date: formatReceiptDate(source.createdAt, true),
    from: textOf(source.from),
    to: textOf(source.to),
    orders: `${formatNumberLocalized(count, { language: "uz" })} ta`,
    total: total === null ? null : formatMoneyLocalized(Math.max(0, total), { language: "uz" }),
    person: isPost
      ? personOf(RECEIPT_PACKAGE_TEXT.courier, source.courier)
      : personOf(RECEIPT_PACKAGE_TEXT.driver, source.driver),
    vehicle: isPost ? "" : textOf(source.vehiclePlate),
    qrToken: token || null,
  };
};

/* ───────────────────────────── Joylash ───────────────────────────── */

export type ReceiptPackageSheet = "thermal" | "a5";

interface PackageSpec {
  sheet: ReceiptPackageSheet;
  width: number;
  height: number;
  /** Chap chekka va matn ustuni eni (termal: QR ustunidan oldin; A5: butun en). */
  x: number;
  width1: number;
  badge: { y: number; h: number; padX: number; radius: number; pt: number; tracking: number };
  datePt: number;
  number: { top: number; lineHeight: number; pts: readonly number[] };
  rule: { gap: number; h: number };
  route: {
    gap: number;
    labelWidth: number;
    labelGap: number;
    labelPt: number;
    labelLineHeight: number;
    fromPt: number;
    toPt: number;
    /** Qiymat qator balandligi, mm; `null` — CSS `line-height: 1.15` (termal maket). */
    fromLineHeight: number | null;
    toLineHeight: number | null;
    /** Termal — bitta qator «…» bilan; A5 — so'zlab o'raladi. */
    wrap: boolean;
    /**
     * A5: blok joyiga sig'masa (imzo qatoriga yetsa) navbatdagi pog'ona — qator balandligi shrift bilan mutanosib
     * kichrayadi; eng kichigida ham sig'masa, qatorlar «…» bilan qisqaradi. Yo'q — faqat `fromPt` / `toPt`.
     */
    steps?: ReadonlyArray<{ readonly toPt: number; readonly fromPt: number }>;
  };
  label: { pt: number; lineHeight: number };
  sign: {
    bottom: number;
    right: number;
    pt: number;
    lineHeight: number;
    gap: number;
    signGap: number;
    signLine: number;
    rule: number;
    ruleBottom: number;
  };
  qrDots: readonly number[];
  missingStroke: number;
  missingPt: number;
}

/** Termal 100×60 (maket 02 «Yangi — termal»): matn ustuni x 2–67, QR 25,4 mm (7 nuqta, V3) x 70,8 y 4,4. */
const THERMAL_PACKAGE_SPEC = Object.freeze({
  sheet: "thermal",
  width: 100,
  height: 60,
  x: 2,
  width1: 65,
  badge: { y: 2, h: 5.2, padX: 2, radius: 1.2, pt: 8.5, tracking: 0.02 },
  datePt: 8,
  number: { top: 8, lineHeight: 9.2, pts: [24, 20, 16] },
  rule: { gap: 0.8, h: 0.4 },
  route: {
    gap: 0.8,
    labelWidth: 12.4,
    labelGap: 1.2,
    labelPt: 7.5,
    labelLineHeight: 3.2,
    fromPt: 11,
    toPt: 15,
    fromLineHeight: null,
    toLineHeight: null,
    wrap: false,
  },
  label: { pt: 7.5, lineHeight: 3.2 },
  sign: {
    bottom: 58,
    right: 98,
    pt: 8,
    lineHeight: 3.6,
    gap: 1.6,
    signGap: 1.6,
    signLine: 22,
    rule: 0.2,
    ruleBottom: 0.8,
  },
  qrDots: [7, 6, 5],
  missingStroke: 0.25,
  missingPt: 8,
} as const satisfies PackageSpec);

/** A5 148×210 (maket 02 «Yangi — A5 varaq»): chekka 10 mm, raqam 40 pt, QR 60 mm. */
const A5_PACKAGE_SPEC = Object.freeze({
  sheet: "a5",
  width: 148,
  height: 210,
  x: 10,
  width1: 128,
  badge: { y: 10, h: 32 / 3, padX: 4, radius: 2, pt: 14, tracking: 0.02 },
  datePt: 12,
  number: { top: 24, lineHeight: 16, pts: [40, 32, 24] },
  rule: { gap: 8 / 3, h: 1 },
  route: {
    gap: 8 / 3,
    labelWidth: 32,
    labelGap: 4,
    labelPt: 12,
    labelLineHeight: 6,
    fromPt: 18,
    toPt: 28,
    fromLineHeight: 8,
    toLineHeight: 34 / 3,
    wrap: true,
    steps: [
      { toPt: 28, fromPt: 18 },
      { toPt: 24, fromPt: 18 },
      { toPt: 20, fromPt: 18 },
      { toPt: 20, fromPt: 16 },
    ],
  },
  label: { pt: 12, lineHeight: 6 },
  sign: {
    bottom: 200,
    right: 138,
    pt: 12,
    lineHeight: 6,
    gap: 10 / 3,
    signGap: 8 / 3,
    signLine: 30,
    rule: 1 / 3,
    ruleBottom: 4 / 3,
  },
  qrDots: [],
  missingStroke: 0.5,
  missingPt: 14,
} as const satisfies PackageSpec);

export const PACKAGE_RECEIPT_SPECS: Readonly<Record<ReceiptPackageSheet, PackageSpec>> =
  Object.freeze({ thermal: THERMAL_PACKAGE_SPEC, a5: A5_PACKAGE_SPEC });

const EPS = 1e-6;

interface Ctx {
  measure: ReceiptMeasure;
  out: ReceiptOp[];
}

const text = (
  ctx: Ctx,
  value: string,
  x: number,
  baseline: number,
  pt: number,
  weight: ReceiptWeight,
  extra: { paper?: boolean; letterSpacing?: number } = {},
) => {
  if (!value) return;
  ctx.out.push({
    kind: "text",
    x: round3(x),
    baseline: round3(baseline),
    pt,
    weight,
    text: value,
    ...extra,
  });
};

/** CSS `line-height: 1.15` (maket): qator balandligi shrift o'lchamidan. */
const lh115 = (pt: number) => pt * MM_PER_PT * 1.15;

/** Qora yorliq (turi) va o'ngda vaqt — bitta qator, vertikal markazda. */
const headerRow = (model: ReceiptPackageModel, spec: PackageSpec, ctx: Ctx) => {
  const { badge } = spec;
  const spacing = round3(badge.tracking * badge.pt * MM_PER_PT);
  const textWidth =
    ctx.measure(model.badge, badge.pt, 700) + spacing * Array.from(model.badge).length;
  const center = badge.y + badge.h / 2;
  ctx.out.push({
    kind: "rect",
    x: spec.x,
    y: round3(badge.y),
    w: round3(textWidth + 2 * badge.padX),
    h: round3(badge.h),
    radius: badge.radius,
  });
  text(
    ctx,
    model.badge,
    spec.x + badge.padX,
    receiptBaselineAtCenter(center, badge.pt),
    badge.pt,
    700,
    {
      paper: true,
      letterSpacing: spacing,
    },
  );
  if (model.date) {
    const right = spec.x + spec.width1;
    text(
      ctx,
      model.date,
      right - ctx.measure(model.date, spec.datePt, 700),
      receiptBaselineAtCenter(center, spec.datePt),
      spec.datePt,
      700,
    );
  }
};

/** Raqam (paketdagi eng katta matn): sig'masa kichrayadi — kesilmaydi. Pastki chetini qaytaradi. */
const numberRow = (model: ReceiptPackageModel, spec: PackageSpec, ctx: Ctx) => {
  const { number } = spec;
  const pt =
    number.pts.find((size) => ctx.measure(model.ref, size, 700) <= spec.width1 + EPS) ??
    number.pts[number.pts.length - 1];
  text(ctx, model.ref, spec.x, receiptBaseline(number.top, number.lineHeight, pt), pt, 700);
  return number.top + number.lineHeight;
};

/** So'zlab o'rash (A5 «Qayerga» uzun filial nomi); bitta so'z sig'masa — belgilab bo'linadi. */
const wrapWords = (
  value: string,
  width: number,
  pt: number,
  weight: ReceiptWeight,
  measure: ReceiptMeasure,
) => {
  const lines: string[] = [];
  let line = "";
  const push = (word: string) => {
    let rest = word;
    while (measure(rest, pt, weight) > width + EPS) {
      let cut = "";
      for (const char of rest) {
        if (cut && measure(cut + char, pt, weight) > width + EPS) break;
        cut += char;
      }
      lines.push(cut);
      rest = rest.slice(cut.length);
    }
    line = rest;
  };
  for (const word of value.split(" ").filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, pt, weight) <= width + EPS) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    push(word);
  }
  if (line) lines.push(line);
  return lines;
};

/**
 * «Qayerdan» / «Qayerga»: chapda yorliq (qat'iy en), o'ngda qiymat, birinchi qatorning bazaviy chizig'i bo'yicha
 * tekislangan (CSS `align-items: baseline`). Blok `maxHeight` dan oshmaydi (A5: imzo qatoriga yetmasin) — avval
 * `route.steps` pog'onalari, keyin ko'p qatorli qiymat (teng bo'lsa — «Qayerdan») oxirgi qatori «…» bilan qisqaradi.
 * Pastki chetini qaytaradi.
 */
const routeRows = (
  model: ReceiptPackageModel,
  spec: PackageSpec,
  top: number,
  ctx: Ctx,
  maxHeight = Number.POSITIVE_INFINITY,
) => {
  const { route } = spec;
  const valueX = spec.x + route.labelWidth + route.labelGap;
  const valueWidth = spec.width1 - route.labelWidth - route.labelGap;
  const half = (lineHeight: number, pt: number) => receiptBaseline(0, lineHeight, pt);
  const labelAbove = half(route.labelLineHeight, route.labelPt);
  const scaled = (lineHeight: number | null, basePt: number, pt: number) =>
    lineHeight === null ? lh115(pt) : (lineHeight * pt) / basePt;
  const rowsAt = ({ fromPt, toPt }: { fromPt: number; toPt: number }) =>
    [
      {
        label: RECEIPT_PACKAGE_TEXT.from,
        value: model.from,
        pt: fromPt,
        lineHeight: scaled(route.fromLineHeight, route.fromPt, fromPt),
        weight: 600 as const,
      },
      {
        label: RECEIPT_PACKAGE_TEXT.to,
        value: model.to,
        pt: toPt,
        lineHeight: scaled(route.toLineHeight, route.toPt, toPt),
        weight: 700 as const,
      },
    ]
      .filter((row) => row.value)
      .map((row) => {
        const valueAbove = half(row.lineHeight, row.pt);
        return {
          ...row,
          above: Math.max(labelAbove, valueAbove),
          below: Math.max(route.labelLineHeight - labelAbove, row.lineHeight - valueAbove),
          lines: route.wrap
            ? wrapWords(row.value, valueWidth, row.pt, row.weight, ctx.measure)
            : [ellipsizeReceiptChars(row.value, valueWidth, row.pt, row.weight, ctx.measure)],
        };
      });
  type Row = ReturnType<typeof rowsAt>[number];
  const heightOf = (items: Row[]) =>
    items.reduce(
      (sum, row, index) =>
        sum +
        (index > 0 ? route.gap : 0) +
        row.above +
        row.below +
        (row.lines.length - 1) * row.lineHeight,
      0,
    );
  const steps = route.steps ?? [{ fromPt: route.fromPt, toPt: route.toPt }];
  let rows = rowsAt(steps[0]);
  for (const step of steps.slice(1)) {
    if (heightOf(rows) <= maxHeight + EPS) break;
    rows = rowsAt(step);
  }
  while (heightOf(rows) > maxHeight + EPS) {
    const row = rows.reduce((longest, item) =>
      item.lines.length > longest.lines.length ? item : longest,
    );
    if (row.lines.length <= 1) break;
    const keep = row.lines.length - 1;
    const rest = row.lines.slice(keep - 1).join(" ");
    row.lines = [
      ...row.lines.slice(0, keep - 1),
      ellipsizeReceiptChars(rest, valueWidth, row.pt, row.weight, ctx.measure),
    ];
  }
  let y = top;
  rows.forEach((row, index) => {
    if (index > 0) y += route.gap;
    const baseline = y + row.above;
    text(ctx, row.label, spec.x, baseline, route.labelPt, 500);
    row.lines.forEach((line, lineIndex) =>
      text(ctx, line, valueX, baseline + lineIndex * row.lineHeight, row.pt, row.weight),
    );
    y += row.above + row.below + (row.lines.length - 1) * row.lineHeight;
  });
  return y;
};

const qrBlock = (
  symbol: ReceiptQrSymbol | null,
  x: number,
  y: number,
  box: number,
  spec: PackageSpec,
  ctx: Ctx,
) => {
  if (!symbol) {
    ctx.out.push({
      kind: "frame",
      x: round3(x),
      y: round3(y),
      w: box,
      h: box,
      radius: 0,
      stroke: spec.missingStroke,
    });
    const width = ctx.measure(RECEIPT_TEXT.noQr, spec.missingPt, 700);
    text(
      ctx,
      RECEIPT_TEXT.noQr,
      x + (box - width) / 2,
      receiptBaselineAtCenter(y + box / 2, spec.missingPt),
      spec.missingPt,
      700,
    );
    return;
  }
  const module = receiptQrModule(symbol.count, box, spec.qrDots);
  const offset = (box - module * symbol.count) / 2;
  ctx.out.push({ kind: "qr", x: round3(x + offset), y: round3(y + offset), module, symbol });
};

const centered = (
  ctx: Ctx,
  value: string,
  center: number,
  top: number,
  lineHeight: number,
  pt: number,
  weight: ReceiptWeight,
) =>
  text(
    ctx,
    value,
    center - ctx.measure(value, pt, weight) / 2,
    receiptBaseline(top, lineHeight, pt),
    pt,
    weight,
  );

/** «Qabul qildi: ______ Imzo: ______» — pastki chekkada, chiziqlar matn bazasidan biroz pastda. */
const signRow = (spec: PackageSpec, ctx: Ctx) => {
  const { sign } = spec;
  const top = sign.bottom - sign.lineHeight;
  const baseline = receiptBaseline(top, sign.lineHeight, sign.pt);
  const lineY = round3(sign.bottom - sign.ruleBottom - sign.rule);
  const receivedWidth = ctx.measure(RECEIPT_PACKAGE_TEXT.received, sign.pt, 500);
  const signatureWidth = ctx.measure(RECEIPT_PACKAGE_TEXT.signature, sign.pt, 500);
  const signLineX = sign.right - sign.signLine;
  const signatureX = signLineX - sign.gap - signatureWidth;
  const firstLineX = spec.x + receivedWidth + sign.gap;
  const firstLineEnd = signatureX - sign.signGap - sign.gap;
  text(ctx, RECEIPT_PACKAGE_TEXT.received, spec.x, baseline, sign.pt, 500);
  if (firstLineEnd > firstLineX)
    ctx.out.push({
      kind: "rect",
      x: round3(firstLineX),
      y: lineY,
      w: round3(firstLineEnd - firstLineX),
      h: round3(sign.rule),
    });
  text(ctx, RECEIPT_PACKAGE_TEXT.signature, signatureX, baseline, sign.pt, 500);
  ctx.out.push({
    kind: "rect",
    x: round3(signLineX),
    y: lineY,
    w: round3(sign.signLine),
    h: round3(sign.rule),
  });
};

/** «Haydovchi: Ism · telefon» — joy yetmasa ism «…» bilan qisqaradi, telefon to'liq qoladi. */
const personLine = (
  label: string,
  person: { name: string; phone: string },
  width: number,
  pt: number,
  measure: ReceiptMeasure,
) => {
  const labelWidth = measure(`${label} `, pt, 500);
  const phone = person.phone ? (person.name ? ` · ${person.phone}` : person.phone) : "";
  const room = width - labelWidth - measure(phone, pt, 700);
  const name = person.name ? ellipsizeReceiptChars(person.name, room, pt, 700, measure) : "";
  return `${name}${phone}`;
};

/** Termal 100×60: matn ustuni chapda, QR o'ngda. */
const layoutThermal = (
  model: ReceiptPackageModel,
  spec: PackageSpec,
  symbol: ReceiptQrSymbol | null,
  ctx: Ctx,
) => {
  headerRow(model, spec, ctx);
  const numberBottom = numberRow(model, spec, ctx);
  const ruleY = numberBottom + spec.rule.gap;
  ctx.out.push({ kind: "rect", x: spec.x, y: round3(ruleY), w: spec.width1, h: spec.rule.h });
  routeRows(model, spec, ruleY + spec.rule.h + 1.2, ctx);

  // «Buyurtmalar» va «Jami summa» — ikki ustun, pastki chetlari bir qatorda (maket: y 32,4).
  const statsTop = 32.4;
  const valueLine = 5.6;
  const { label } = spec;
  const columns = [
    { title: RECEIPT_PACKAGE_TEXT.orders, value: model.orders, pt: 14 },
    ...(model.total ? [{ title: RECEIPT_PACKAGE_TEXT.total, value: model.total, pt: 11 }] : []),
  ];
  let x = spec.x;
  for (const column of columns) {
    text(
      ctx,
      column.title,
      x,
      receiptBaseline(statsTop, label.lineHeight, label.pt),
      label.pt,
      500,
    );
    text(
      ctx,
      column.value,
      x,
      receiptBaseline(statsTop + label.lineHeight, valueLine, column.pt),
      column.pt,
      700,
    );
    x +=
      Math.max(
        ctx.measure(column.title, label.pt, 500),
        ctx.measure(column.value, column.pt, 700),
      ) + 4;
  }

  // Haydovchi (avtomobil) yoki kuryer: 8 pt, 3,6 mm qator (maket: y 42,4).
  const peopleTop = 42.4;
  const peopleLine = 3.6;
  const peoplePt = 8;
  const rows: Array<{ label: string; value: string }> = [];
  if (model.person) {
    const rowLabel = `${model.person.role}:`;
    rows.push({
      label: rowLabel,
      value: personLine(rowLabel, model.person, spec.width1, peoplePt, ctx.measure),
    });
  }
  if (model.vehicle) {
    const rowLabel = `${RECEIPT_PACKAGE_TEXT.vehicle}:`;
    const room = spec.width1 - ctx.measure(`${rowLabel} `, peoplePt, 500);
    rows.push({
      label: rowLabel,
      value: ellipsizeReceiptChars(model.vehicle, room, peoplePt, 700, ctx.measure),
    });
  }
  rows.forEach((row, index) => {
    const baseline = receiptBaseline(peopleTop + index * peopleLine, peopleLine, peoplePt);
    text(ctx, row.label, spec.x, baseline, peoplePt, 500);
    text(
      ctx,
      row.value,
      spec.x + ctx.measure(`${row.label} `, peoplePt, 500),
      baseline,
      peoplePt,
      700,
    );
  });

  // QR (maket: x 70,8 y 4,4, 25,4 mm) va ostida «Qabul qilishda / skanerlang» (7,5 pt 600, markaz x 83,4).
  qrBlock(symbol, 70.8, 4.4, 25.4, spec, ctx);
  RECEIPT_PACKAGE_TEXT.scan.forEach((line, index) =>
    centered(ctx, line, 83.4, 33.6 + index * 3, 3, 7.5, 600),
  );
  signRow(spec, ctx);
};

/** A5 148×210: bitta ustun, pastda chapda raqamlar va odamlar, o'ngda 60 mm QR. */
const layoutA5 = (
  model: ReceiptPackageModel,
  spec: PackageSpec,
  symbol: ReceiptQrSymbol | null,
  ctx: Ctx,
) => {
  headerRow(model, spec, ctx);
  const numberBottom = numberRow(model, spec, ctx);
  const ruleY = numberBottom + spec.rule.gap;
  ctx.out.push({ kind: "rect", x: spec.x, y: round3(ruleY), w: spec.width1, h: spec.rule.h });

  // Bo'lim: ingichka chiziq (margin 16 px, chiziq 1 px), ichki chekka 34 px; ustunlar orasi 34 px.
  const rule = 1 / 3;
  const qrBox = 60;
  const captionLine = 6;
  // Yo'nalish blokining joyi: QR ostidagi yozuv imzo qatoridan kamida 16 px yuqorida tugasin (chap ustun — raqamlar va
  // odamlar — ko'pi bilan ~65 mm, QR + yozuvdan (77,3 mm) qisqa, shuning uchun QR ustuni hal qiladi).
  const routeTop = ruleY + spec.rule.h + 14 / 3;
  const lowerBlock = 16 / 3 + rule + 34 / 3 + qrBox + 34 / 3 + captionLine;
  const signTop = spec.sign.bottom - spec.sign.lineHeight;
  const routeBottom = routeRows(
    model,
    spec,
    routeTop,
    ctx,
    signTop - 16 / 3 - lowerBlock - routeTop,
  );

  const sectionRule = routeBottom + 16 / 3;
  ctx.out.push({
    kind: "rect",
    x: spec.x,
    y: round3(sectionRule),
    w: spec.width1,
    h: round3(rule),
  });
  const top = sectionRule + rule + 34 / 3;
  const qrX = spec.x + spec.width1 - qrBox;
  const columnWidth = qrX - 34 / 3 - spec.x;
  const { label } = spec;
  let y = top;
  const group = (
    title: string,
    values: Array<{ value: string; pt: number; lineHeight: number }>,
  ) => {
    if (y > top) y += 4;
    text(ctx, title, spec.x, receiptBaseline(y, label.lineHeight, label.pt), label.pt, 500);
    y += label.lineHeight;
    for (const item of values) {
      const value = ellipsizeReceiptChars(item.value, columnWidth, item.pt, 700, ctx.measure);
      text(ctx, value, spec.x, receiptBaseline(y, item.lineHeight, item.pt), item.pt, 700);
      y += item.lineHeight;
    }
  };
  group(RECEIPT_PACKAGE_TEXT.orders, [{ value: model.orders, pt: 24, lineHeight: 10 }]);
  if (model.total)
    group(RECEIPT_PACKAGE_TEXT.total, [{ value: model.total, pt: 18, lineHeight: 26 / 3 }]);
  const personLines = [model.person?.name, model.person?.phone, model.vehicle]
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, pt: 14, lineHeight: 20 / 3 }));
  if (personLines.length) {
    group(model.person?.role ?? RECEIPT_PACKAGE_TEXT.vehicle, personLines);
  }

  qrBlock(symbol, qrX, top, qrBox, spec, ctx);
  centered(
    ctx,
    RECEIPT_PACKAGE_TEXT.scan.join(" "),
    qrX + qrBox / 2,
    top + qrBox + 34 / 3,
    captionLine,
    12,
    600,
  );
  signRow(spec, ctx);
};

export interface ReceiptPackageLayoutContext {
  measure: ReceiptMeasure;
  qr?: (token: string | null) => ReceiptQrSymbol | null;
}

/** Paket / pochta cheki → bitta yorliq (termal 100×60 yoki A5 148×210). */
export const layoutPackageReceipt = (
  model: ReceiptPackageModel,
  context: ReceiptPackageLayoutContext,
  sheet: ReceiptPackageSheet = "thermal",
): ReceiptLabel => {
  const spec = PACKAGE_RECEIPT_SPECS[sheet];
  const ctx: Ctx = { measure: context.measure, out: [] };
  const symbol = (context.qr ?? encodeReceiptQr)(model.qrToken);
  if (sheet === "a5") layoutA5(model, spec, symbol, ctx);
  else layoutThermal(model, spec, symbol, ctx);
  return { width: spec.width, height: spec.height, ops: withReceiptKerning(ctx.out, ctx.measure) };
};
