import { describe, expect, it } from "vitest";
import i18n from "../../../../../i18n";
import uz from "../../../../../locales/uz/orders.json";
import ru from "../../../../../locales/ru/orders.json";
import en from "../../../../../locales/en/orders.json";
import type { AiConfirmFailureCode, AiParseFailureReason } from "../../../../../entities/ai-order";
import { confirmFailureText, parseFailureView } from "./aiErrorText";

/**
 * AI XATO MATNLARI (6LSlbHoi): har sabab o'z matni va harakati bilan,
 * kalitlar uch tilda ham bor (yo'q bo'lsa i18next kalit NOMINI chiqaradi).
 */

const PARSE_REASONS: AiParseFailureReason[] = [
  "disabled",
  "ai_off",
  "refused",
  "truncated",
  "network",
  "insufficient",
  "no_market",
  "ai_error",
  "cap_exceeded",
];

const CONFIRM_CODES: AiConfirmFailureCode[] = [
  "district_not_found",
  "district_mismatch",
  "product_not_found",
  "product_foreign",
  "duplicate_in_batch",
  "duplicate_recent",
  "duplicate_in_progress",
  "validation_unavailable",
  "create_failed",
  "timeout_unknown",
  "not_started",
];

const t = i18n.getFixedT("uz", "orders");

describe("aiErrorText", () => {
  it("har parse sababining sarlavha/tavsif/tugma kalitlari uz, ru, en da bor", () => {
    for (const reason of PARSE_REASONS) {
      for (const canSelectMarket of [true, false]) {
        const view = parseFailureView(reason, { canSelectMarket });
        for (const key of [view.title, view.description, view.actionLabel]) {
          for (const [lang, dict] of Object.entries({ uz, ru, en })) {
            expect(dict, `${lang}: ${reason} → ${key}`).toHaveProperty(key);
          }
        }
      }
    }
  });

  it("qayta urinish FAQAT aloqa uzilganda taklif qilinadi", () => {
    const retrying = PARSE_REASONS.filter(
      (reason) => parseFailureView(reason, { canSelectMarket: true }).action === "retry",
    );
    expect(retrying).toEqual(["network"]);
  });

  it("market rolida no_market → market tanlash emas, qo'lda yaratish", () => {
    expect(parseFailureView("no_market", { canSelectMarket: true }).action).toBe("selectMarket");
    expect(parseFailureView("no_market", { canSelectMarket: false }).action).toBe("manual");
  });

  it("noma'lum sabab — umumiy matn, xato emas", () => {
    expect(parseFailureView(undefined, { canSelectMarket: true }).description).toBe("aiParseFailed");
  });

  it("ai-confirm: har kod tarjima qilinadi, server matni kodsiz javobda zaxira", () => {
    for (const code of CONFIRM_CODES) {
      const text = confirmFailureText({ index: 0, ok: false, code, reason: "x" }, t);
      expect(text, code).not.toMatch(/^aiConfirm|^aiCreate/);
    }
    expect(confirmFailureText({ index: 0, ok: false, reason: "telefon noto'g'ri" }, t)).toBe("telefon noto'g'ri");
    expect(confirmFailureText({ index: 0, ok: false }, t)).toBe("Buyurtma yaratilmadi.");
  });

  it("create_failed: server aniq sabab bersa sarlavhaga ulanadi, umumiy matn takrorlanmaydi", () => {
    expect(
      confirmFailureText(
        { index: 0, ok: false, code: "create_failed", reason: "Bu telefon raqam boshqa rolda allaqachon mavjud" },
        t,
      ),
    ).toBe("Buyurtma yaratilmadi: Bu telefon raqam boshqa rolda allaqachon mavjud");
    expect(confirmFailureText({ index: 0, ok: false, code: "create_failed", reason: "Buyurtma yaratilmadi" }, t)).toBe(
      "Buyurtma yaratilmadi.",
    );
  });

  it("duplicate_recent: mavjud buyurtma raqami ko'rsatiladi; rus tilida ham tarjima", () => {
    expect(confirmFailureText({ index: 0, ok: false, code: "duplicate_recent", order_id: "512" }, t)).toContain("#512");
    const ruT = i18n.getFixedT("ru", "orders");
    expect(confirmFailureText({ index: 0, ok: false, code: "timeout_unknown", reason: "Natija noma’lum" }, ruT)).toMatch(
      /Результат неизвестен/,
    );
  });
});
