import { isCancel, type AxiosError } from "axios";
import type { TFunction } from "i18next";
import type {
  AiConfirmFailureCode,
  AiConfirmResult,
  AiParseFailureReason,
} from "../../../../../entities/ai-order";
import { getBackendErrorMessage } from "../../../../../shared/lib/backendError";

type Translate = TFunction<"orders">;

/**
 * Server tanasidagi izoh (massiv bo'lsa vergul bilan). ⚠️ Faqat `response`
 * o'qiladi — axios'ning "Request failed with status code 400" matni chiqmaydi.
 */
const serverDetail = (error: unknown): string | undefined =>
  getBackendErrorMessage({ response: (error as AxiosError | undefined)?.response });

/**
 * AI BUYURTMA XATOLARI → OPERATOR MATNI (6LSlbHoi).
 *
 * Har xato `{ title, description, action }` — operator NIMA bo'lganini va
 * NIMA qilishini biladi. Bu yerda faqat i18n KALITLARI: tarjima UI qatlamida.
 *
 * ⚠️ "Qayta urinish" faqat aloqa/server javob bermagan holatda (`retry`)
 * taklif qilinadi — boshqa xatolarda bir xil so'rovni qayta yuborish yana
 * o'sha natijani beradi va har tahlil pul sarflaydi.
 */

export type AiErrorAction = "manual" | "retry" | "editText" | "selectMarket";

export type AiErrorView = {
  /** `block` — AI ni hozir ishlatib bo'lmaydi (sariq); `error` — shu urinish yiqildi (qizil). */
  tone: "block" | "error";
  title: string;
  description: string;
  action: AiErrorAction;
  actionLabel: string;
  /** Serverning tarjima qilinmagan izohi (masalan 400 xabari) — tavsif ostida. */
  detail?: string;
};

const manual = (title: string, description: string, actionLabel = "aiCreateManually"): AiErrorView => ({
  tone: "block",
  title,
  description,
  action: "manual",
  actionLabel,
});

const editText = (title: string, description: string): AiErrorView => ({
  tone: "error",
  title,
  description,
  action: "editText",
  actionLabel: "aiEditInput",
});

const retry = (title: string, description: string): AiErrorView => ({
  tone: "error",
  title,
  description,
  action: "retry",
  actionLabel: "aiRetryAgain",
});

const PARSE_ERRORS: Record<AiParseFailureReason, AiErrorView> = {
  disabled: manual("aiDisabledTitle", "aiDisabledDescription"),
  ai_off: manual("aiDisabledTitle", "aiDisabledDescription"),
  insufficient: manual("aiInsufficientTitle", "aiInsufficientDescription"),
  // ⚠️ "AI o'chirilgan" EMAS: AI ishlaydi, faqat bugungi xarajat limiti tugagan.
  cap_exceeded: manual("aiCapTitle", "aiCapDescription", "aiEnterManually"),
  refused: manual("aiRefusedTitle", "aiRefusedDescription", "aiEnterManually"),
  no_market: {
    tone: "error",
    title: "aiNoMarketTitle",
    description: "aiNoMarketDescription",
    action: "selectMarket",
    actionLabel: "aiSelectMarket",
  },
  truncated: editText("aiTruncatedTitle", "aiReasonTruncated"),
  network: retry("aiNetworkTitle", "aiReasonNetwork"),
  ai_error: editText("aiNotFoundTitle", "aiNotFoundDescription"),
};

const UNKNOWN_PARSE_ERROR = editText("aiParseFailedTitle", "aiParseFailed");

/**
 * `ok:false` javobidagi sabab. `canSelectMarket` — admin/registrator market
 * tanlay oladimi; market rolida `no_market` faqat administrator hal qiladi.
 */
export const parseFailureView = (
  reason: AiParseFailureReason | undefined,
  { canSelectMarket }: { canSelectMarket: boolean },
): AiErrorView => {
  const view = (reason && PARSE_ERRORS[reason]) || UNKNOWN_PARSE_ERROR;
  if (view.action === "selectMarket" && !canSelectMarket) {
    return manual(view.title, "aiReasonNoMarket");
  }
  return view;
};

/**
 * Tahlil so'rovining HTTP xatosi. `null` — xato ko'rsatilmaydi (operator
 * o'zi bekor qildi); 429 chaqiruvchida (tugma bloklanadi).
 * 401 → mavjud interceptor (sessiya yangilanadi / login).
 */
export const parseHttpErrorView = (error: unknown): AiErrorView | null => {
  if (isCancel(error)) return null;
  const status = (error as AxiosError | undefined)?.response?.status;

  if (!status) return retry("aiNetworkTitle", "aiHttpNoResponse");
  if (status === 413) {
    // Rasmlar brauzerda siqiladi — 413 chiqsa server limiti muammosi.
    return editText("aiHttpTooLargeTitle", "aiHttpTooLargeDescription");
  }
  if (status >= 500) return retry("aiHttpServerTitle", "aiHttpServerDescription");
  if (status === 403) {
    return { ...manual("aiHttpForbiddenTitle", "aiHttpForbiddenDescription"), detail: serverDetail(error) };
  }
  if (status === 400 || status === 422) {
    return { ...editText("aiHttpBadRequestTitle", "aiHttpBadRequestDescription"), detail: serverDetail(error) };
  }
  return { ...UNKNOWN_PARSE_ERROR, description: "aiParseRequestFailed", detail: serverDetail(error) };
};

// ───────────────────────── ai-confirm: har buyurtma natijasi ─────────────────

const CONFIRM_REASON_KEYS: Record<AiConfirmFailureCode, string> = {
  district_not_found: "aiConfirmReasonDistrictNotFound",
  district_mismatch: "aiConfirmReasonDistrictMismatch",
  product_not_found: "aiConfirmReasonProductNotFound",
  product_foreign: "aiConfirmReasonProductForeign",
  duplicate_in_batch: "aiConfirmReasonDuplicateInBatch",
  duplicate_recent: "aiConfirmReasonDuplicateRecent",
  duplicate_in_progress: "aiConfirmReasonDuplicateInProgress",
  validation_unavailable: "aiConfirmReasonValidationUnavailable",
  create_failed: "aiCreateFailed",
  timeout_unknown: "aiConfirmReasonTimeoutUnknown",
  not_started: "aiConfirmReasonNotStarted",
};

/** Backend `create_failed` ning umumiy matni — undan farqli bo'lsa bu aniq sabab (400/telefon). */
const BACKEND_CREATE_FAILED_TEXT = "Buyurtma yaratilmadi";

/**
 * Yiqilgan buyurtma kartasidagi qizil matn. Kod bo'yicha tarjima qilinadi;
 * `create_failed` da server aniq sabab bergan bo'lsa (400 / telefon boshqa
 * rolda) u tarjima qilingan sarlavhaga ulanadi. Kodsiz (eski backend) javobda
 * server matni o'zgarmasdan ko'rsatiladi.
 */
export const confirmFailureText = (result: AiConfirmResult, t: Translate): string => {
  const reason = result.reason?.trim() ?? "";
  const key = result.code ? CONFIRM_REASON_KEYS[result.code] : undefined;
  if (!key) return reason || t("aiCreateFailed");

  if (result.code === "create_failed") {
    const detail = reason.replace(/\.$/, "");
    return detail && detail !== BACKEND_CREATE_FAILED_TEXT
      ? t("aiCreateFailedWith", { detail })
      : t("aiCreateFailed");
  }
  if (result.code === "duplicate_recent" && result.order_id) {
    return t("aiConfirmReasonDuplicateRecentId", { id: result.order_id });
  }
  return t(key);
};

/** Butun tasdiqlash so'rovi yiqildi (natijalar kelmadi). */
export const confirmHttpErrorText = (error: unknown, t: Translate): string => {
  const status = (error as AxiosError | undefined)?.response?.status;
  // Javob kelmadi / 5xx — buyurtmalar YARATILGAN bo'lishi mumkin: qayta yuborilmasin.
  if (!status || status >= 500) return t("aiConfirmUnknown");
  if (status === 413) return t("aiHttpTooLargeTitle");
  if (status === 429) return t("aiThrottled");
  const detail = serverDetail(error);
  return detail ? t("aiCreateFailedWith", { detail }) : t("aiCreateFailed");
};
