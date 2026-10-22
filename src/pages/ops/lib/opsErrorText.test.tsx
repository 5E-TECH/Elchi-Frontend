import { renderHook } from "@testing-library/react";
import i18n from "../../../i18n";
import { mockRejection } from "../../../test/mockEnvelope";
import { useOpsErrorText } from "./opsErrorText";

/** OPS rad etilgan so'rov matni (LJt0G1y1): har holatda o'z i18n matnimiz, backend xabari emas. */
describe("useOpsErrorText", () => {
  const errorText = () => renderHook(() => useOpsErrorText()).result.current;

  afterEach(async () => {
    await i18n.changeLanguage("uz");
  });

  it("amal 403 — amalga mos matn (ro'yxat blokining «sahifaning qolgan qismi…» matni emas)", () => {
    const text = errorText()(mockRejection(403), { action: true });
    expect(text).toBe("Bu amal sizning rolingiz uchun ochilmagan (403).");
    expect(text).not.toContain("Sahifaning qolgan qismidan");
    expect(text).not.toContain("RAW_BACKEND_TEXT");
  });

  it("amal 400 / 404 / 409 — o'z matnlari; ro'yxatda 403 — umumiy «forbidden» holati", () => {
    const text = errorText();
    expect(text(mockRejection(400), { action: true })).toBe(
      "Ma'lumot qabul qilinmadi (400). Kiritilganini tekshirib, qayta urinib ko'ring.",
    );
    expect(text(mockRejection(404), { action: true })).toBe("Topilmadi (404). ID to'g'riligini tekshiring.");
    expect(text(mockRejection(409), { action: true })).toBe(
      "Holat allaqachon o'zgargan (409). Ro'yxatni yangilab, qayta urinib ko'ring.",
    );
    expect(text(mockRejection(403))).not.toBe("Bu amal sizning rolingiz uchun ochilmagan (403).");
    expect(text(mockRejection(403))).not.toContain("RAW_BACKEND_TEXT");
  });

  it.each([
    ["ru", "Это действие недоступно для вашей роли (403)."],
    ["en", "This action isn't available for your role (403)."],
  ])("amal 403 — %s", async (lng, expected) => {
    await i18n.changeLanguage(lng);
    expect(errorText()(mockRejection(403), { action: true })).toBe(expected);
  });
});
