import {
  addAdvisorDays,
  advisorDayOf,
  type AiAdvisorCorrectionKind,
  type AiAdvisorEvidenceCorrections,
  type AiAdvisorEvidenceMarketDebtDays,
  type AiAdvisorEvidenceProfitDays,
} from "../../../../../entities/ai-advisor";

/**
 * Qoida tanalari uchun sof hisob-kitoblar (shartnoma v0.3 maydonlaridan): o'lchagich shkalasi, R4 to'lovlar tarixi,
 * R6 oldingi kun bilan solishtirish, R8 sanalgan tuzatish turlari. React'siz — alohida test qilinadi.
 */

type ProfitDay = AiAdvisorEvidenceProfitDays["rows"][number];

/**
 * Shkala yuqori chegarasi: qiymat yoki chegaraning kattasidan 5 % ortiq, ikki muhim raqamga «chiroyli» yaxlitlangan
 * (2 982 000 → 3 000 000, 1 522 500 → 1 600 000) — to'ldirish oxirgacha yetmaydi, chegara chizig'i ko'rinadi.
 */
export const thresholdMeterMax = (value: number, threshold: number): number => {
  const top = Math.max(value, threshold, 0) * 1.05;
  if (!(top > 0)) return 1;
  const step = 2 * 10 ** Math.max(0, Math.floor(Math.log10(top)) - 1);
  return Math.ceil(top / step) * step;
};

/** To'lov: kun (`YYYY-MM-DD`), aniq vaqt (oxirgi to'lov — `last_payout.at`; qolganlari — faqat kun), summa. */
export type MarketPayout = { key: string; day: string; at: string | null; amount: number };

/**
 * To'lovlar tarixi shartnomadagi maydonlardan (v0.3 da alohida ro'yxat yo'q): kunlik qatorlardagi `paid > 0` +
 * `last_payout` (o'sha kun qatori bilan bitta — summasi teng bo'lsa vaqti qo'shiladi, aks holda kunlik jami qoladi;
 * qatorlarda yo'q bo'lsa — alohida qo'shiladi). Yangisi birinchi.
 */
export const deriveMarketPayouts = (evidence: AiAdvisorEvidenceMarketDebtDays | null): MarketPayout[] => {
  if (!evidence) return [];
  const payouts: MarketPayout[] = evidence.rows
    .filter((row) => row.paid > 0)
    .map((row) => ({ key: row.date, day: row.date, at: null, amount: row.paid }));
  const last = evidence.last_payout;
  const lastDay = last ? advisorDayOf(last.at) : null;
  if (last && lastDay) {
    const same = payouts.find((payout) => payout.day === lastDay);
    if (!same) payouts.push({ key: `last-${last.history_id}`, day: lastDay, at: last.at, amount: last.amount });
    else if (same.amount === last.amount) same.at = last.at;
  }
  return payouts.sort((a, b) => (a.day === b.day ? 0 : a.day < b.day ? 1 : -1));
};

/** Kunlik zararda: zararli kun va undan oldingi kun dalil qatorlarida bo'lsa — ikkalasi; aks holda `null`. */
export const lossComparisonDays = (
  facts: { period: "day" | "week"; from: string },
  evidence: AiAdvisorEvidenceProfitDays | null,
): { prev: ProfitDay; cur: ProfitDay } | null => {
  if (facts.period !== "day" || !evidence) return null;
  const cur = evidence.rows.find((row) => row.date === facts.from) ?? null;
  const prev = cur ? (evidence.rows.find((row) => row.date === addAdvisorDays(cur.date, -1)) ?? null) : null;
  return cur && prev ? { prev, cur } : null;
};

/** Ko'rsatish tartibi (maket: «9 qaytarish, 5 tahrir»; «Qaytarish», «Summani tahrirlash»). */
const KIND_ORDER: readonly AiAdvisorCorrectionKind[] = ["payment_reverse", "payment_edit", "manual_correction", "order_rollback"];

/** Sanalgan (`counted_kinds`) va soni > 0 turlar — maket tartibida. */
export const countedCorrectionKinds = (
  evidence: AiAdvisorEvidenceCorrections | null,
): Array<{ kind: AiAdvisorCorrectionKind; count: number }> =>
  evidence
    ? KIND_ORDER.filter((kind) => evidence.counted_kinds.includes(kind) && (evidence.by_kind[kind] ?? 0) > 0).map((kind) => ({
        kind,
        count: evidence.by_kind[kind],
      }))
    : [];
