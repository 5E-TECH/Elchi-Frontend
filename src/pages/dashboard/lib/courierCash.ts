/**
 * KURYER «KASSA» KARTASI hisobi (`GET finance/cashbox/my-cashbox?fromDate=<bugun>&toDate=<bugun>`).
 *
 * Backend (origin/main `finance-service` `myCashbox` → `getCashboxByUserId`) sana oralig'idagi BARCHA
 * tarixni sahifalamasdan qaytaradi + `income` / `outcome` yig'indilari. Shuning uchun bugungi sharshara
 * aniq: kun boshi = joriy balans − bugungi kirim + bugungi chiqim. Sotuvlar (`sell` kirimi) va filialga
 * topshirilgan (`courier_payment` chiqimi) alohida, qolgan harakatlar bo'lsa — «Boshqa» ustuni (yig'indi
 * baribir joriy balansga teng bo'ladi). Javob shakli boshqacha bo'lsa — sharshara chizilmaydi (ega savoli 5).
 */
export interface CourierCashModel {
  balance: number;
  /** `null` — tarix to'liq emas, faqat balans ko'rsatiladi. */
  flow: { start: number; sales: number; handedOver: number; other: number } | null;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const num = (value: unknown): number | null => {
  const parsed = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(parsed) ? null : parsed;
};

export const toCourierCash = (response: unknown): CourierCashModel | null => {
  const data = asRecord(asRecord(response)?.data);
  const cashbox = asRecord(data?.cashbox ?? data?.myCashbox);
  const balance = num(cashbox?.balance);
  if (balance === null) return null;

  const history = data?.cashboxHistory;
  const income = num(data?.income);
  const outcome = num(data?.outcome);
  if (!Array.isArray(history) || income === null || outcome === null) return { balance, flow: null };

  let sales = 0;
  let handedOver = 0;
  for (const raw of history) {
    const entry = asRecord(raw);
    const amount = num(entry?.amount) ?? 0;
    const isIncome = String(entry?.operation_type ?? "").toLowerCase() === "income";
    const source = String(entry?.source_type ?? "").toLowerCase();
    if (isIncome && source === "sell") sales += amount;
    if (!isIncome && source === "courier_payment") handedOver += amount;
  }
  const start = balance - income + outcome;
  const other = income - sales - (outcome - handedOver);
  return { balance, flow: { start, sales, handedOver, other } };
};
