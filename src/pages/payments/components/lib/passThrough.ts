import type { PaymentRow } from "../patmentHistoryTable";
import { getPaymentActorName } from "../paymentHistoryActor";
import { compareHistoryIdDesc } from "../../../../entities/payments/paymentCorrection";

/**
 * O'TKAZMA IZI (ega 2026-11-26; backend Elchi-Backend #800).
 *
 * Pul kassaga KIRMAGAN, lekin kassa tarixida bitta to'lov ichida ikki qator turadi: «Kirim +X» va «Chiqim −X» (sof 0).
 * Masalan «Marketga o'tkazma»: kuryer pulni to'g'ridan-to'g'ri marketga o'tkazadi — asosiy (HQ yozgan) yoki filial
 * (menejer yozgan) kassasida iz qoladi; «Filialdan marketga o'tkazma» — asosiy kassada. Backend shunday qatorga
 * `pass_through: true` va `pass_through_pair_id` (shu kassadagi juft qator) qo'yadi.
 *
 * Qoida: iz qatorlari «Kirim» / «Chiqim» jamilariga, «Balans harakati» ga va «Pul qayerdan keldi» bloklariga
 * kirmaydi (qoldiq o'zgarmaydi). Ro'yxatda juft BITTA kulrang qator: «Marketga o'tkazma · Kuryer Ali → Baraka Shop ·
 * 300 000 · Kassaga kirmadi»; tafsilotda ikkala yozuv ham ko'rinadi. Excel ikkala qatorni ham yozadi (backend).
 */

type Translate = (key: string, options?: Record<string, unknown>) => string;

const normalize = (value?: string | null) => (value ?? "").trim().toLowerCase();

/** Qator o'tkazma izimi (`pass_through: true`, backend belgisi). */
export const isPassThroughRow = (row: { pass_through?: unknown } | null | undefined): boolean =>
  row?.pass_through === true;

/**
 * Ro'yxat uchun: iz juftining sahifadagi BIRINCHI qatori qoladi va ikkinchisini `pass_through_partner` da oladi,
 * ikkinchisi ro'yxatdan chiqadi. Jufti sahifada bo'lmagan iz qatori — o'zi qoladi (baribir kulrang). Iz yo'q —
 * aynan o'sha massiv (havola o'zgarmaydi).
 */
export const collapsePassThroughPairs = <T extends PaymentRow>(rows: readonly T[]): T[] => {
  if (!rows.some(isPassThroughRow)) return rows as T[];
  const byId = new Map<string, T>();
  for (const row of rows) byId.set(String(row.id), row);
  const consumed = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = String(row.id);
    if (consumed.has(id)) continue;
    if (!isPassThroughRow(row)) {
      out.push(row);
      continue;
    }
    const pairId = row.pass_through_pair_id == null ? "" : String(row.pass_through_pair_id);
    const partner = pairId && pairId !== id ? byId.get(pairId) : undefined;
    if (partner && isPassThroughRow(partner) && !consumed.has(pairId)) {
      consumed.add(pairId);
      out.push({ ...row, pass_through_partner: partner });
    } else {
      out.push(row);
    }
  }
  return out;
};

export type PassThroughView = {
  /** «Marketga o'tkazma» yoki «Filialdan marketga o'tkazma». */
  title: string;
  /** Pul kimdan (kuryer / filial) — ism bo'lmasa rol nomi. */
  from: string;
  /** Pul kimga (market) — ism bo'lmasa «Market». */
  to: string;
  /** «Kuryer Ali → Baraka Shop». */
  route: string;
  /** Juftdan keyingi qoldiq (keyin yozilgan oyoqniki — juft qoldiqni o'zgartirmaydi); noma'lum — `undefined`. */
  balanceAfter: number | undefined;
  /** Kassadagi yozuvlar: kirim, keyin chiqim (sahifada bo'lganlari). */
  legs: PaymentRow[];
};

/** Iz qatorining ko'rinishi (sarlavha, yo'nalish, qoldiq) — barcha ro'yxatlar va tafsilot uchun bir manba. */
export const passThroughView = (row: PaymentRow, t: Translate): PassThroughView => {
  const legs = [row, row.pass_through_partner].filter((leg): leg is PaymentRow => Boolean(leg));
  const income = legs.find((leg) => normalize(leg.operation_type) === "income");
  const expense = legs.find((leg) => normalize(leg.operation_type) === "expense");
  const isBranch = legs.some((leg) => normalize(leg.source_type) === "branch_to_main");
  const fromName = income ? getPaymentActorName(income.source_user ?? income.sourceUser) : "";
  const toName = expense ? getPaymentActorName(expense.source_user ?? expense.sourceUser) : "";
  const from = fromName || t(isBranch ? "v2Common.passThrough.party.branch" : "v2Common.passThrough.party.courier");
  const to = toName || t("v2Common.passThrough.party.market");
  const later = [...legs].sort((left, right) => compareHistoryIdDesc(left.id, right.id))[0];
  const balance = later?.balance_after;
  return {
    title: t(isBranch ? "v2Common.passThrough.titleBranch" : "v2Common.passThrough.title"),
    from,
    to,
    route: t("v2Common.passThrough.route", { from, to }),
    balanceAfter: typeof balance === "number" && Number.isFinite(balance) ? balance : undefined,
    legs: [income, expense].filter((leg): leg is PaymentRow => Boolean(leg)),
  };
};
