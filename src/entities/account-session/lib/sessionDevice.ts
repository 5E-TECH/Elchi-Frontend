import type { AccountSession, SessionDeviceKind } from "../model/types";

/** Server yorlig'ining birinchi bo'lagi (`describeUserAgent`, api-gateway) → tur. */
const KIND_BY_WORD: Record<string, SessionDeviceKind> = {
  telefon: "phone",
  planshet: "tablet",
  kompyuter: "desktop",
};

/** Yorliq bo'laklari ajratkichi — serverdagidek « · ». */
const SEPARATOR = " · ";
/** Qisqa User-Agent uzunligi (to'liq satr — `title` da). */
const SHORT_UA_MAX = 40;

export type SessionDevice = {
  /** Tanilgan tur — UI uni o'z tilida yozadi («Telefon» / «Телефон» / «Phone»). */
  kind: SessionDeviceKind | null;
  /** Turdan keyingi qism («Android · Chrome») yoki tanilmagan yorliq / qisqa User-Agent. */
  detail: string | null;
};

/**
 * Server nomi bo'lmasa (User-Agent tanilmagan — skript, ilova): umumiy `Mozilla/5.0` bo'lagisiz birinchi
 * `SHORT_UA_MAX` belgi, so'z chegarasida kesilib «…» bilan («curl/8.4.0», «PostmanRuntime/7.39.0»).
 */
export const shortUserAgent = (userAgent: string | null | undefined): string | null => {
  const value = (userAgent ?? "").replace(/^Mozilla\/\d+(\.\d+)?\s*/i, "").replace(/\s+/g, " ").trim();
  if (!value) return null;
  if (value.length <= SHORT_UA_MAX) return value;
  const cut = value.slice(0, SHORT_UA_MAX);
  const space = cut.lastIndexOf(" ");
  return `${(space > SHORT_UA_MAX / 2 ? cut.slice(0, space) : cut).replace(/[\s;,(]+$/, "")}…`;
};

/**
 * Sessiya qurilmasi: server yorlig'i «Telefon · Android · Chrome» → `{ kind: "phone", detail: "Android · Chrome" }`;
 * turi tanilmagan yorliq (mijoz `X-Device-Name` yuborgan) — o'zi `detail` da; yorliq yo'q — qisqa User-Agent;
 * hech narsa yo'q — `{ kind: null, detail: null }` (UI «Noma'lum qurilma» yozadi).
 */
export const describeSessionDevice = (
  session: Pick<AccountSession, "device_name" | "user_agent">,
): SessionDevice => {
  const name = session.device_name?.trim();
  if (name) {
    const parts = name.split("·").map((part) => part.trim()).filter(Boolean);
    const kind = KIND_BY_WORD[(parts[0] ?? "").toLowerCase()] ?? null;
    if (kind) return { kind, detail: parts.slice(1).join(SEPARATOR) || null };
    return { kind: null, detail: parts.join(SEPARATOR) || name };
  }
  return { kind: null, detail: shortUserAgent(session.user_agent) };
};

/** «Shu qurilma» tepada, qolgani server tartibida (oxirgi faollik bo'yicha yangisi tepada). */
export const currentSessionFirst = (sessions: readonly AccountSession[]): AccountSession[] => [
  ...sessions.filter((session) => session.current),
  ...sessions.filter((session) => !session.current),
];
