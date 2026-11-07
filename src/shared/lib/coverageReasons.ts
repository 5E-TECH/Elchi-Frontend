import type { TFunction } from "i18next";
import { readBackendRejection, type BackendRejection } from "./backendReason";

/**
 * FILIAL QAMROVI RAD SABABLARI (Elchi-Backend #620/#621, Trello anKpzwxk, PlIPwpQY).
 *
 * Backend `data.reason` kodini beradi; foydalanuvchiga uning `message` i emas, shu yerdagi uz/ru/en matn
 * chiqadi (backend matni faqat o'zbekcha, ba'zan texnik: «POST /district/:id/…», «hudud #3»). Noma'lum sabab —
 * backend `message` i yoki chaqiruvchining zaxira matni.
 *
 * Kalitlar: `common:coverage.<reason>.*`.
 */
export const COVERAGE_REASONS = [
  "district_not_served_by_branch",
  "order_in_outgoing_batch",
  "hq_courier_region_only",
  "branch_region_missing",
  "region_mismatch",
  "post_receive_manager_only",
  "post_not_visible_to_courier",
  "new_posts_hq_only",
  "order_not_in_your_branch",
  "branch_not_assigned",
  "branch_scope_unavailable",
] as const;

export type CoverageReason = (typeof COVERAGE_REASONS)[number];

const REASON_SET: ReadonlySet<string> = new Set(COVERAGE_REASONS);

export const isCoverageReason = (value: unknown): value is CoverageReason =>
  typeof value === "string" && REASON_SET.has(value);

/**
 * QR / pochta ko'rish doirasi rad etgan sabablar (#620 «begona QR»): javobda ma'lumot YO'Q — buyurtma yoki pochta
 * kartasi ochilmaydi. `branch_scope_unavailable` (503) — qayta urinish mumkin, qolganlari — yo'q.
 */
export const QR_SCOPE_REASONS = [
  "order_not_in_your_branch",
  "branch_not_assigned",
  "post_not_visible_to_courier",
  "branch_scope_unavailable",
] as const satisfies readonly CoverageReason[];

export type QrScopeReason = (typeof QR_SCOPE_REASONS)[number];

const QR_SCOPE_SET: ReadonlySet<string> = new Set(QR_SCOPE_REASONS);

export const isQrScopeReason = (value: unknown): value is QrScopeReason =>
  typeof value === "string" && QR_SCOPE_SET.has(value);

/**
 * Qayerda ko'rsatiladi: kuryerga biriktirish (`assign`), kuryer skaneri (`scan`), HQ → filial jo'natish
 * (`dispatch`), filialga o'tkazish (`reassign`), buyurtma QR'i (`qr`), pochta (`post`), pochtani qabul qilish
 * (`receive`), «Yangi pochtalar» (`newPosts`).
 */
export type CoverageContext = "assign" | "scan" | "dispatch" | "reassign" | "qr" | "post" | "receive" | "newPosts";

/** Matnda ko'rsatiladigan id'lar soni; qolgani «va yana N ta». */
export const COVERAGE_IDS_SHOWN = 10;

/** `№12, №13 … va yana N ta` (ko'pi bilan {@link COVERAGE_IDS_SHOWN} ta raqam). */
export const formatCoverageIds = (t: TFunction, ids: readonly string[]): string => {
  const shown = ids.slice(0, COVERAGE_IDS_SHOWN).map((id) => `№${id}`).join(", ");
  const rest = ids.length - COVERAGE_IDS_SHOWN;
  return rest > 0 ? t("common:coverage.idsMore", { ids: shown, count: rest }) : shown;
};

/**
 * `{{ids}}` bo'sh bo'lsa (backend id bermagan) — «…berilmaydi: .» kabi osilib qolgan ikki nuqta olib tashlanadi
 * (uchala tilda shablon «…: {{ids}}» ko'rinishida).
 */
const dropEmptyIds = (text: string) => text.replace(/:\s*(?=[.;]|$)/g, "").trim();

const withIds = (t: TFunction, key: string, ids: readonly string[]) =>
  dropEmptyIds(t(key, { ids: formatCoverageIds(t, ids) }));

export type CoverageText = {
  /** Tanilgan sabab (`null` — noma'lum: matn backend `message` i yoki zaxira). */
  reason: CoverageReason | null;
  title: string;
  description: string;
};

export type CoverageTextOptions = {
  context: CoverageContext;
  /** Noma'lum sabab uchun sarlavha. */
  fallbackTitle: string;
  /** Noma'lum sabab va backend matni yo'q bo'lsa — izoh. */
  fallbackDescription?: string;
};

const regionMissingText = (t: TFunction, rejection: BackendRejection, context: CoverageContext) => {
  if (context === "assign" || context === "scan") return t("common:coverage.branch_region_missing.hq");
  const parts: string[] = [];
  if (rejection.missing.includes("destination_branch_region")) parts.push(t("common:coverage.branch_region_missing.destination"));
  if (rejection.missing.includes("post_region")) parts.push(t("common:coverage.branch_region_missing.post"));
  return parts.length > 0 ? parts.join(" ") : t("common:coverage.branch_region_missing.destination");
};

const knownText = (t: TFunction, reason: CoverageReason, rejection: BackendRejection, context: CoverageContext): string => {
  const ids = rejection.orderIds;
  switch (reason) {
    case "district_not_served_by_branch":
      return context === "dispatch" || context === "reassign"
        ? withIds(t, "common:coverage.district_not_served_by_branch.dispatch", ids)
        : withIds(t, "common:coverage.district_not_served_by_branch.assign", ids);
    case "order_in_outgoing_batch":
    case "hq_courier_region_only":
      return withIds(t, `common:coverage.${reason}.text`, ids);
    case "branch_region_missing":
      return regionMissingText(t, rejection, context);
    case "order_not_in_your_branch":
      return "";
    default:
      return t(`common:coverage.${reason}.text`);
  }
};

/** Rad javobidan foydalanuvchi matni: tanilgan sabab — lokal uz/ru/en; noma'lum — backend `message` / zaxira. */
export const coverageRejectionText = (
  t: TFunction,
  rejection: BackendRejection,
  { context, fallbackTitle, fallbackDescription = "" }: CoverageTextOptions,
): CoverageText => {
  const { reason } = rejection;
  if (!isCoverageReason(reason)) {
    return { reason: null, title: fallbackTitle, description: rejection.message ?? fallbackDescription };
  }
  return {
    reason,
    title: t(`common:coverage.${reason}.title`),
    description: knownText(t, reason, rejection, context),
  };
};

/** Bir qatorli matn (skaner xabari, ro'yxatdagi «Rad etildi» sababi): «Sarlavha. Izoh» yoki faqat sarlavha. */
export const coverageTextLine = ({ title, description }: Pick<CoverageText, "title" | "description">): string =>
  description ? `${title}. ${description}` : title;

/**
 * Xato tanilgan qamrov sababi bo'lsa — lokal bir qatorli matn ({@link coverageTextLine}), aks holda `null`
 * (chaqiruvchi avvalgidek backend matnini yoki o'z zaxirasini ko'rsatadi). Skaner oqimlari uchun: signal matni,
 * ro'yxatdagi «Rad etildi» sababi.
 */
export const coverageErrorLine = (t: TFunction, error: unknown, context: CoverageContext): string | null => {
  const rejection = readBackendRejection(error);
  if (!isCoverageReason(rejection.reason)) return null;
  return coverageTextLine(coverageRejectionText(t, rejection, { context, fallbackTitle: "" }));
};

export type QrScopeText = CoverageText & {
  reason: QrScopeReason;
  /** 503 `branch_scope_unavailable` — vaqtinchalik, «Qayta urinish» mumkin; qolganlari — ruxsat (qayta so'rov foydasiz). */
  retryable: boolean;
  /** Bir qatorli matn (skaner signali). */
  line: string;
};

/**
 * Begona QR (#620, anKpzwxk): skan so'rovi (`GET orders/qr-code/:token`, `GET post/scan/:token`) rad javobi →
 * lokal sarlavha va izoh. QR ko'rish doirasi sababi bo'lmasa — `null`. Javobda buyurtma / pochta ma'lumoti yo'q —
 * chaqiruvchi hech qanday ma'lumot chizmaydi.
 */
export const readQrScopeText = (t: TFunction, error: unknown): QrScopeText | null => {
  const rejection = readBackendRejection(error);
  if (!isQrScopeReason(rejection.reason)) return null;
  const text = coverageRejectionText(t, rejection, { context: "qr", fallbackTitle: "" });
  return {
    ...text,
    reason: rejection.reason,
    retryable: rejection.reason === "branch_scope_unavailable",
    line: coverageTextLine(text),
  };
};
