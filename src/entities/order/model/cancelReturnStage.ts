import {
  Building2,
  CircleX,
  PackageCheck,
  RotateCcw,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "../../../shared/ui/primitives/tone";
import { normalizeOrderStatus } from "./statusRegistry";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  BEKOR BOSQICHI — bekor qilingan posilka QAYERDA (ega qarori 2026-10-19)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Buyurtma holati o'zgarmaydi (backend enum va holat mashinasi o'z holicha). Bekor
 *  qilingan buyurtmaga JOY BOSQICHI qo'shiladi va u holat + `transport_status` +
 *  `holder_*` + `canceled_post_id` dan hisoblanadi (BeePost `return_stage` ga o'xshash;
 *  backend `cancel_return.stage` bersa — BG1 — keyin shu o'qiladi, bu hisob zaxira):
 *
 *    1 `courier`    «Bekor · kuryerda»   status=cancelled, holder COURIER
 *    2 `in_transit` «Bekor · yo'lda»     cancelled (sent) — detalda status, ro'yxatda `transport_status`
 *    3 `branch`     «Bekor · filialda»   status=cancelled, holder BRANCH, `canceled_post_id` yo'q
 *    4 `hq`         «Bekor · HQ'da»      status=cancelled, holder HQ
 *    5 `market`     «Marketga topshirildi» status=returned_to_market yoki holder MARKET
 *
 *  Ton (DESIGN_SYSTEM §8): 1–4 — danger (zanjir yopilmagan), ikonka va matn bilan
 *  ajraladi; «yo'lda» chegarali (`Bekor — jo'natilgan` kabi); 5 — neytral (kulrang,
 *  «Yopilgan» kabi). Yangi rang yoki ton yo'q. Maket: `tizim-states-data` §09.
 *  Bosqich belgisi nuqtasiz, ikonkali (`el-badge` + svg).
 */

export type CancelReturnStage = "courier" | "in_transit" | "branch" | "hq" | "market";

export interface CancelReturnStageMeta {
  stage: CancelReturnStage;
  tone: Tone;
  variant: "soft" | "outline";
  icon: LucideIcon;
  /** `status` nomlar fazosidagi kalit. */
  labelKey: `cancelStage.${CancelReturnStage}`;
}

const stageMeta = (
  stage: CancelReturnStage,
  tone: Tone,
  icon: LucideIcon,
  variant: CancelReturnStageMeta["variant"] = "soft",
): CancelReturnStageMeta => ({ stage, tone, icon, variant, labelKey: `cancelStage.${stage}` });

export const CANCEL_RETURN_STAGES: Readonly<Record<CancelReturnStage, CancelReturnStageMeta>> = {
  courier: stageMeta("courier", "danger", CircleX),
  in_transit: stageMeta("in_transit", "danger", RotateCcw, "outline"),
  branch: stageMeta("branch", "danger", Building2),
  hq: stageMeta("hq", "danger", Warehouse),
  market: stageMeta("market", "neutral", PackageCheck),
};

/** Maketdagi tartib (`tizim-states-data` §09). */
export const CANCEL_RETURN_STAGE_ORDER: readonly CancelReturnStage[] = [
  "courier",
  "in_transit",
  "branch",
  "hq",
  "market",
];

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};

const text = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

/** `'0'` — tayinlanmagan pochta sentineli (backend `normalizeCourierId`), kuryer emas. */
const courierId = (value: unknown): string => {
  const id = text(value);
  return id === "0" ? "" : id;
};

const holderTypeOf = (order: Raw) => text(order.holder_type ?? order.holderType).toUpperCase();

/**
 * Buyurtmaning bekor bosqichi yoki `null` (bekor emas / bosqichni aniqlab bo'lmaydi).
 *
 * Faqat holatning o'zi berilsa ham ishlaydi: `returned_to_market` → `market`,
 * `cancelled (sent)` → `in_transit`. `cancelled` uchun `holder_type` kerak — u
 * bo'lmasa `null` (oddiy «Bekor qilingan» belgisi qoladi, taxmin qilinmaydi).
 */
export const resolveCancelReturnStage = (order: unknown): CancelReturnStage | null => {
  const record = asRecord(order);
  const status = normalizeOrderStatus(record.status);
  const transport = normalizeOrderStatus(record.transport_status ?? record.transportStatus);
  const holder = holderTypeOf(record);

  if (status === "returned_to_market") return "market";
  if (status !== "cancelled" && status !== "cancelled (sent)") return null;
  if (holder === "MARKET") return "market";
  if (status === "cancelled (sent)" || transport === "cancelled (sent)") return "in_transit";

  switch (holder) {
    case "HQ":
      return "hq";
    case "BRANCH":
      return text(record.canceled_post_id ?? record.cancelled_post_id) ? null : "branch";
    case "COURIER":
      return "courier";
    default:
      // Eski yozuvlar: `holder_type` bo'sh, lekin kuryer id'si bor — posilka kuryerda.
      return courierId(record.holder_courier_id ?? record.holderCourierId) ? "courier" : null;
  }
};

/** «Bekor · …» bosqichlari (1–4) — zanjir hali yopilmagan. */
export const isOpenCancelReturnStage = (stage: CancelReturnStage | null): boolean =>
  stage !== null && stage !== "market";

const DAY_MS = 86_400_000;

const toTime = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const raw = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value;
  const time = new Date(raw as string | number).getTime();
  return Number.isFinite(time) ? time : null;
};

/**
 * Backend filial yorlig'i `Urgut filiali (UR, ID: 12)` / `branch ID: 12` ko'rinishida keladi
 * (`resolveBranchTrackingLabel`) — ko'rsatish uchun faqat nom; id'li yorliq — `null`.
 */
export const cleanBranchLabel = (value: unknown): string | null => {
  const raw = text(value);
  if (!raw || /^branch\s+id\b/i.test(raw) || /^branch$/i.test(raw)) return null;
  const name = raw.replace(/\s*\((?:[^()]*,\s*)?ID:\s*[^()]*\)\s*$/i, "").trim();
  return name || null;
};

export interface CancelReturnPlace {
  /** Joy nomi: «Toshkent HQ», «Urgut filiali», kuryer ismi. `null` — ma'lumot yo'q. */
  name: string | null;
  /** «Yo'lda» — nom maqsad bo'lib, «→ Toshkent HQ» shaklida. */
  arrow: boolean;
  /** Joyda necha kun (`last_handover_at` dan, butun kun; < 1 kun — `null`). */
  days: number | null;
  /** «Marketga topshirildi» — topshirilgan vaqt (`last_handover_at`). */
  at: number | null;
}

/**
 * Bosqich ostidagi joy qatori uchun ma'lumot — FAQAT javobda bor maydonlardan (1-bosqich,
 * backendsiz): joy nomi `branch.name` (bekor oqimida `branch_id` har jo'natish va qabulda
 * maqsad/joriy filialga almashadi; HQ ham filial — `findHqBranchId`), kuryer —
 * `courier.name`; muddat — `last_handover_at`. Nom yo'q bo'lsa `name: null` (taxmin yo'q).
 */
export const resolveCancelReturnPlace = (
  order: unknown,
  stage: CancelReturnStage | null = resolveCancelReturnStage(order),
  now: number = Date.now(),
): CancelReturnPlace | null => {
  if (!stage) return null;
  const record = asRecord(order);
  const branch = asRecord(record.branch);
  const branchId = text(branch.id);
  const branchName = text(branch.name) || null;
  const holderBranchId = text(record.holder_branch_id ?? record.holderBranchId);
  const handoverAt = toTime(record.last_handover_at ?? record.lastHandoverAt);
  const elapsed = handoverAt !== null ? Math.floor((now - handoverAt) / DAY_MS) : null;
  const days = elapsed !== null && elapsed >= 1 ? elapsed : null;

  switch (stage) {
    case "courier": {
      const courier = asRecord(record.courier);
      const holderCourier = courierId(record.holder_courier_id ?? record.holderCourierId);
      const sameCourier = !holderCourier || !text(courier.id) || text(courier.id) === holderCourier;
      return {
        name: sameCourier ? text(courier.name) || null : null,
        arrow: false,
        days,
        at: null,
      };
    }
    case "in_transit":
      return { name: branchName, arrow: true, days: null, at: null };
    case "branch":
      // Ro'yxatda faqat `branch` bor — u custody filiali bo'lsagina nom ko'rsatiladi.
      return {
        name: !holderBranchId || !branchId || holderBranchId === branchId ? branchName : null,
        arrow: false,
        days,
        at: null,
      };
    case "hq":
      return { name: branchName, arrow: false, days, at: null };
    case "market":
      return { name: branchName, arrow: false, days: null, at: handoverAt };
    default:
      return null;
  }
};

/** Topshirish usuli (tarixdan; ro'yxatda — BG2 dan keyin). `pin` — BG6 dan keyin. */
export type CancelHandoverMethod = "qr" | "manual" | "no_qr" | "pin";

/**
 * Qo'lda tasdiq sabablari — backend `CancelledManualOverrideReasonDto` enum qiymati (o'zbekcha matn)
 * → `status:cancelReturn.manualReason.*` kaliti (ru/en interfeysda ham tarjima chiqsin).
 */
export const CANCEL_HANDOVER_MANUAL_REASON_KEYS: Readonly<Record<string, string>> = {
  "QR yirtilgan": "cancelReturn.manualReason.torn",
  "QR o'qilmayapti": "cancelReturn.manualReason.unreadable",
  "Label yo'qolgan": "cancelReturn.manualReason.missing",
  "QR namlangan yoki xiralashgan": "cancelReturn.manualReason.wet",
};

export interface CancelHandoverInfo {
  method: CancelHandoverMethod;
  /** Qo'lda tasdiq sababi (backend enum matni, masalan «QR yirtilgan»). */
  reason: string | null;
}

const MANUAL_NOTE = /qo['ʻ‘’`]?lda\s+tasdiqlanib/i;
const NO_QR_NOTE = /QR\s+talab\s+qilinmasdan/i;

/**
 * Marketga topshirish hodisasidan (`GET orders/:id/tracking`) usul:
 *  - `cancelled_market_handover_manual` yoki `metadata.manual_reason` — «qo'lda tasdiq: sabab»
 *    (backend izohi «… qo'lda tasdiqlanib topshirildi: <sabab>»);
 *  - izoh «QR talab qilinmasdan» — «QR'siz (market sozlamasi)»;
 *  - qolgani (QR sessiyasi, `mark-returned-to-market` + MHA) — «QR orqali».
 * Hodisa topshirish bo'lmasa — `null`. BG2 dan keyin `metadata.method` o'qiladi.
 */
export const readCancelHandoverInfo = (event: unknown): CancelHandoverInfo | null => {
  const record = asRecord(event);
  const metadata = asRecord(record.metadata);
  const newValue = asRecord(record.new_value);
  const toStatus = normalizeOrderStatus(newValue.status ?? record.to_status);
  const action = text(record.action).toLowerCase();
  const isManualAction = action === "cancelled_market_handover_manual";
  if (toStatus !== "returned_to_market" && !isManualAction) return null;

  const declared = text(metadata.method).toLowerCase();
  const note = text(record.note ?? record.description);
  const manualReason = text(metadata.manual_reason) || null;

  if (declared === "pin") return { method: "pin", reason: null };
  if (declared === "no_qr") return { method: "no_qr", reason: null };
  if (declared === "manual" || isManualAction || manualReason || MANUAL_NOTE.test(note)) {
    const fromNote = MANUAL_NOTE.test(note) ? note.split(":").slice(1).join(":").trim() : "";
    return { method: "manual", reason: manualReason ?? (fromNote || null) };
  }
  if (NO_QR_NOTE.test(note)) return { method: "no_qr", reason: null };
  return { method: "qr", reason: null };
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Usul matni (`status:cancelReturn.method.*`): «QR orqali», «Qo'lda tasdiq — QR yirtilgan»,
 * «QR'siz (market sozlamasi)». `t` istalgan nomlar fazosidan — kalit `ns: "status"` bilan so'raladi.
 */
export const formatCancelHandoverMethod = (
  t: Translate,
  info: CancelHandoverInfo | null,
): string | null => {
  if (!info) return null;
  const ns = { ns: "status" };
  if (info.method !== "manual") return t(`cancelReturn.method.${info.method}`, ns);
  if (!info.reason) return t("cancelReturn.method.manualNoReason", ns);
  const key = CANCEL_HANDOVER_MANUAL_REASON_KEYS[info.reason];
  return t("cancelReturn.method.manual", { ...ns, reason: key ? t(key, ns) : info.reason });
};
