import { describe, expect, it } from "vitest";

/**
 * SKANERLAB QABUL QILISH JAVOBINI OCHISH.
 *
 * Server `{ received, unmatched[] }` qaytaradi, lekin gateway qobig'i
 * marshrutga qarab bir yoki ikki qatlam bo'lishi mumkin
 * (`{data:{...}}` / `{data:{data:{...}}}`).
 *
 * ⚠️ NEGA TEST KERAK. Qobiq noto'g'ri ochilsa `received` 0 va `unmatched`
 * bo'sh bo'lib chiqadi — ekran "0 qabul qilindi" deb SABABSIZ ko'rsatadi va
 * operator nima bo'lganini bilmaydi. Ya'ni xato JIM buziladi.
 *
 * Ochish mantig'i hook ichida — uni bu yerda AYNAN takrorlaymiz, chunki
 * hook `api` va react-query'ga bog'langan.
 */
const unwrap = (raw: unknown) => {
  const outer = raw as { data?: unknown };
  const inner = (outer?.data as { data?: unknown })?.data ?? outer?.data;
  const page = inner as
    | { received?: unknown; unmatched?: unknown }
    | undefined;
  return {
    received: Number(page?.received ?? 0),
    unmatched: Array.isArray(page?.unmatched)
      ? (page!.unmatched as Array<{ token: string; reason: string }>)
      : [],
  };
};

const body = { received: 3, unmatched: [{ token: "t1", reason: "topilmadi" }] };

describe("receiveByScan javob qobig'i", () => {
  it("bir qatlam: {data:{...}}", () => {
    expect(unwrap({ data: body })).toEqual(body);
  });

  it("ikki qatlam: {data:{data:{...}}}", () => {
    expect(unwrap({ data: { data: body } })).toEqual(body);
  });

  it("⭐ `unmatched` bo'sh bo'lmagan holat saqlanadi", () => {
    /**
     * Eng muhim maydon: qabul qilinmagan posilkalar. Ular yo'qolsa
     * operator "hammasi qabul qilindi" deb o'ylaydi.
     */
    const out = unwrap({ data: { data: body } });
    expect(out.unmatched).toHaveLength(1);
    expect(out.unmatched[0].reason).toBe("topilmadi");
  });

  it("⭐ 0 qabul qilingan holat ham TO'G'RI o'qiladi", () => {
    const out = unwrap({
      data: { received: 0, unmatched: [{ token: "x", reason: "tashqi posilka emas" }] },
    });
    expect(out.received).toBe(0);
    expect(out.unmatched).toHaveLength(1);
  });

  it("kutilmagan shakl — yiqilmaydi, bo'sh natija", () => {
    expect(unwrap(null)).toEqual({ received: 0, unmatched: [] });
    expect(unwrap({ foo: 1 })).toEqual({ received: 0, unmatched: [] });
  });

  it("`unmatched` massiv bo'lmasa bo'sh massivga tushadi", () => {
    // Backend shaklini o'zgartirsa ekran yiqilmasligi kerak.
    const out = unwrap({ data: { received: 2, unmatched: "salom" } });
    expect(out.received).toBe(2);
    expect(out.unmatched).toEqual([]);
  });
});
