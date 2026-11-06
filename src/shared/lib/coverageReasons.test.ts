import { describe, expect, it } from "vitest";
import i18n from "../../i18n";
import { readBackendRejection } from "./backendReason";
import { COVERAGE_REASONS, coverageRejectionText, formatCoverageIds, isCoverageReason } from "./coverageReasons";

const t = i18n.getFixedT("uz");

const reject = (status: number, reason: string | null, details: Record<string, unknown> = {}, message = "Backend matni") =>
  readBackendRejection({ response: { status, data: { statusCode: status, message, data: reason ? { reason, details } : undefined } } });

describe("coverageRejectionText", () => {
  it("isCoverageReason — faqat 11 ta kod", () => {
    expect(COVERAGE_REASONS).toHaveLength(11);
    expect(isCoverageReason("order_not_in_your_branch")).toBe(true);
    expect(isCoverageReason("market_cancelled_pin_invalid")).toBe(false);
    expect(isCoverageReason(null)).toBe(false);
  });

  it("begona QR — sarlavha «Bu buyurtma sizning filialingizda emas», izohsiz", () => {
    const text = coverageRejectionText(t, reject(403, "order_not_in_your_branch"), { context: "qr", fallbackTitle: "x" });
    expect(text).toEqual({ reason: "order_not_in_your_branch", title: "Bu buyurtma sizning filialingizda emas", description: "" });
  });

  it("biriktirishda boshqa viloyat — id'lar №, backend matni emas", () => {
    const text = coverageRejectionText(t, reject(403, "district_not_served_by_branch", { order_ids: [12, 13] }), {
      context: "assign",
      fallbackTitle: "x",
    });
    expect(text.title).toBe("Boshqa viloyat buyurtmasi");
    expect(text.description).toBe("Bu buyurtma boshqa viloyatga tegishli — kuryerga berilmaydi: №12, №13");
    expect(text.description).not.toContain("Backend matni");
  });

  it("jo'natishda boshqa viloyat — «tanlovdan olib tashlang» matni, 10 tadan ortig'i «va yana N ta»", () => {
    const ids = Array.from({ length: 13 }, (_, index) => index + 1);
    const text = coverageRejectionText(t, reject(409, "district_not_served_by_branch", { order_ids: ids }), {
      context: "dispatch",
      fallbackTitle: "x",
    });
    expect(text.description).toBe(
      "Bu buyurtmalar boshqa viloyatga tegishli — bu filialga jo'natilmaydi: №1, №2, №3, №4, №5, №6, №7, №8, №9, №10 va yana 3 ta. Ularni tanlovdan olib tashlang.",
    );
  });

  it("id bo'lmasa — osilib qolgan «:» yo'q", () => {
    const assign = coverageRejectionText(t, reject(409, "order_in_outgoing_batch", {}, "Matn"), { context: "assign", fallbackTitle: "x" });
    expect(assign.description).toBe("Avval partiyadan chiqaring — kuryerga berilmaydi");
    const dispatch = coverageRejectionText(t, reject(409, "district_not_served_by_branch", {}, "Matn"), {
      context: "dispatch",
      fallbackTitle: "x",
    });
    expect(dispatch.description).toBe("Bu buyurtmalar boshqa viloyatga tegishli — bu filialga jo'natilmaydi. Ularni tanlovdan olib tashlang.");
  });

  it("viloyat belgilanmagan — biriktirishda HQ, jo'natishda details.missing bo'yicha", () => {
    expect(
      coverageRejectionText(t, reject(400, "branch_region_missing", { branch_id: 1 }), { context: "assign", fallbackTitle: "x" }).description,
    ).toBe("HQ filialiga viloyat biriktirilmagan — administrator belgilashi kerak.");
    expect(
      coverageRejectionText(t, reject(400, "branch_region_missing", { missing: ["destination_branch_region", "post_region"] }), {
        context: "dispatch",
        fallbackTitle: "x",
      }).description,
    ).toBe("Manzil filialga viloyat biriktirilmagan. Pochtaning viloyati belgilanmagan.");
    expect(
      coverageRejectionText(t, reject(400, "branch_region_missing", { missing: ["post_region"] }), { context: "reassign", fallbackTitle: "x" })
        .description,
    ).toBe("Pochtaning viloyati belgilanmagan.");
  });

  it("qabul qilish, kuryer pochtasi, «Yangi pochtalar» — lokal matnlar", () => {
    expect(coverageRejectionText(t, reject(403, "post_receive_manager_only", { post_id: 1 }), { context: "receive", fallbackTitle: "x" })).toEqual({
      reason: "post_receive_manager_only",
      title: "Pochta qabul qilinmadi",
      description: "Bu pochtani faqat manzil filial menejeri qabul qila oladi.",
    });
    expect(coverageRejectionText(t, reject(403, "post_not_visible_to_courier"), { context: "post", fallbackTitle: "x" }).title).toBe(
      "Pochta hali filialga qabul qilinmagan",
    );
    expect(coverageRejectionText(t, reject(403, "new_posts_hq_only"), { context: "newPosts", fallbackTitle: "x" }).title).toBe(
      "Yangi pochtalar faqat HQ xodimlari uchun",
    );
  });

  it("noma'lum sabab — backend matni; matn ham yo'q — zaxira", () => {
    expect(coverageRejectionText(t, reject(403, "something_else"), { context: "qr", fallbackTitle: "Xatolik" })).toEqual({
      reason: null,
      title: "Xatolik",
      description: "Backend matni",
    });
    expect(
      coverageRejectionText(t, readBackendRejection(new Error("boom")), { context: "qr", fallbackTitle: "Xatolik", fallbackDescription: "Zaxira" }),
    ).toEqual({ reason: null, title: "Xatolik", description: "Zaxira" });
  });

  it("formatCoverageIds — 10 tagacha to'liq", () => {
    expect(formatCoverageIds(t, ["1", "2"])).toBe("№1, №2");
    expect(formatCoverageIds(t, [])).toBe("");
  });
});
