import type { ConnectionHealth } from "../../entities/integrations/metrics";
import type { Tone } from "../../shared/ui/primitives";
import type { Connection } from "./useConnections";

/**
 * Ro'yxat (`ConnectionsPage`) va bitta ulanish sahifasi (`ConnectionPage`) uchun umumiy: bo'lim (scope), manzil,
 * holat va rol yorliqlari, panel tablari.
 */

/** Konsol bo'limlari; `carrier` — alohida konsol (`carrier/CarrierConsole`), ulanish sahifasi yo'q. */
export type Scope = "partner" | "external" | "marketplace" | "carrier";

export const matchScope = (c: Connection, scope: Scope): boolean => scope !== "carrier" && scopeOfConnection(c) === scope;

/** Ulanish qaysi bo'lim ro'yxatida turadi — «← Integratsiyalar» shu bo'limga qaytaradi. */
export const scopeOfConnection = (c: Connection): Exclude<Scope, "carrier"> =>
  c.kind === "partner" ? "partner" : c.category === "marketplace" ? "marketplace" : "external";

export const CONNECTIONS_PATH = "/integrations/connections";

export const scopePath = (scope: Scope): string => `${CONNECTIONS_PATH}?scope=${scope}`;

/** `integration:3` → `/integrations/connections/integration-3`; `tab` — panel tabi (`?t=`). */
export const connectionPath = (uid: string, tab?: string | null): string =>
  `${CONNECTIONS_PATH}/${encodeURIComponent(uid.replace(":", "-"))}${tab ? `?t=${encodeURIComponent(tab)}` : ""}`;

/** Manzildagi `integration-3` → `integration:3`; noma'lum shakl — `null`. */
export const uidFromParam = (param: string | undefined): string | null => {
  const match = /^(partner|integration)-(.+)$/.exec(param ?? "");
  return match ? `${match[1]}:${match[2]}` : null;
};

/**
 * ESKI HAVOLA (2026-11-25 gacha tafsilot ro'yxat sahifasida edi): `?c=integration:3&t=log` → yangi manzil. Carrier
 * akkaunti (`c=carrier:9`) o'z konsolida qoladi — `null`.
 */
export const legacyConnectionPath = (params: URLSearchParams): string | null => {
  const uid = params.get("c") ?? "";
  return /^(partner|integration):.+$/.test(uid) ? connectionPath(uid, params.get("t")) : null;
};

export const HEALTH_TONE: Record<ConnectionHealth, Tone> = { ok: "success", attention: "warning", off: "neutral" };
export const HEALTH_KEY: Record<ConnectionHealth, string> = {
  ok: "healthOk",
  attention: "healthAttention",
  off: "healthOff",
};

/** Rol — birlik shaklida (maket: «Buyurtma manbasi», «Yetkazuvchi»). */
export const ROLE_ONE_KEY: Record<Connection["role"], string> = {
  carrier: "console.roleOneCarrier",
  source: "console.roleOneSource",
  payment: "console.roleOnePayment",
  mirror: "console.roleOneMirror",
};

/** Panel tablari — tartib maketdagidek. */
export const PANEL_TABS = [
  { key: "overview", labelKey: "tabOverview" },
  { key: "settings", labelKey: "tabSettings" },
  { key: "shipments", labelKey: "tabShipments" },
  { key: "log", labelKey: "tabEvents" },
  { key: "settlement", labelKey: "tabSettlement" },
  { key: "control", labelKey: "tabControl" },
  { key: "security", labelKey: "tabSecurity" },
] as const;

export type PanelKey = (typeof PANEL_TABS)[number]["key"];

/**
 * Shu ulanishda ma'nosi yo'q tablar. Buyurtma manbasiga (sayt) biz posilka topshirmaymiz va u bilan COD
 * hisob-kitobi yo'q — «Posilkalar» va «Hisob-kitob» doim bo'sh turardi.
 */
export const hiddenTabsOf = (c: Connection): ReadonlySet<PanelKey> => {
  const hidden = new Set<PanelKey>();
  if (c.role === "payment" || c.role === "mirror" || (c.role === "source" && c.kind === "integration")) {
    hidden.add("shipments");
    hidden.add("settlement");
  }
  return hidden;
};

/** Yakunlangan hodisalar ulushi (Σ yetkazildi / (Σ yetkazildi + Σ yetmadi)), yakunlangan yo'q — `null`. */
export const successOf = (delivered: number, failed: number): number | null =>
  delivered + failed > 0 ? (delivered / (delivered + failed)) * 100 : null;
