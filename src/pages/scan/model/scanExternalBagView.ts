/**
 * Tashqi (BeePost) qop yorlig'i — `GET scan/:token` zaxira javobi (backend `order.find_batch_by_external_token`,
 * CyCV4XHR): `{ external_batch_token, is_external_batch: true, count, members: [{ id, qr_code_token, status,
 * source, external_batch_token }] }`, ko'pi bilan 500 a'zo. Mijoz ma'lumoti (PII) va market YO'Q — shuning
 * uchun «Kiruvchi posilkalarda ochish» manba tanlash sahifasiga (`/new-orders/incoming`) olib boradi.
 */

type AnyRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AnyRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

export interface ExternalBagMember {
  id: string | null;
  token: string | null;
  status: string | null;
}

export interface ExternalBagView {
  token: string | null;
  /** Qopdagi posilkalar soni (`count`, bo'lmasa a'zolar soni). */
  count: number;
  /** Hali qabul qilinmagan (`new`) posilkalar soni. */
  pending: number;
  members: ExternalBagMember[];
}

const unwrap = (response: unknown): AnyRecord | null => {
  let current: unknown = response;
  for (let depth = 0; depth < 4 && isRecord(current); depth += 1) {
    if (current.is_external_batch === true || Array.isArray(current.members)) return current;
    current = current.data;
  }
  return null;
};

export const buildExternalBagView = (response: unknown): ExternalBagView | null => {
  const payload = unwrap(response);
  if (!payload) return null;
  const list = Array.isArray(payload.members) ? payload.members : [];
  const members = list
    .filter(isRecord)
    .map((member) => ({
      id: text(member.id),
      token: text(member.qr_code_token ?? member.token),
      status: text(member.status)?.toLowerCase() ?? null,
    }))
    .filter((member) => member.id || member.token);
  const declared = Number(payload.count);
  return {
    token: text(payload.external_batch_token),
    count: Number.isFinite(declared) && declared > 0 ? declared : members.length,
    pending: members.filter((member) => member.status === "new").length,
    members,
  };
};
