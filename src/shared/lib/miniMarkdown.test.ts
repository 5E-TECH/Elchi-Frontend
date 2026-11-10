import { describe, expect, it } from "vitest";
import { inlineText, parseInline, parseMarkdown } from "./miniMarkdown";

describe("parseInline", () => {
  it("**qalin**, *kursiv*, _kursiv_, `kod`", () => {
    expect(parseInline("Jami **286,4 mln so'm** va *taxminan* _(Javob qisqartirildi.)_ `kod`")).toEqual([
      { type: "text", text: "Jami " },
      { type: "strong", children: [{ type: "text", text: "286,4 mln so'm" }] },
      { type: "text", text: " va " },
      { type: "em", children: [{ type: "text", text: "taxminan" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "(Javob qisqartirildi.)" }] },
      { type: "text", text: " " },
      { type: "code", text: "kod" },
    ]);
  });

  it("so'z ichidagi `_` kursiv emas (get_cash_position), yopilmagan belgi — matn", () => {
    expect(parseInline("tool get_cash_position va get_order_flow")).toEqual([
      { type: "text", text: "tool get_cash_position va get_order_flow" },
    ]);
    expect(parseInline("2 * 3 = 6 va **ochiq")).toEqual([{ type: "text", text: "2 * 3 = 6 va **ochiq" }]);
  });

  it("havola — faqat matni, rasm — alt; HTML — oddiy matn", () => {
    expect(inlineText(parseInline("[To'lovlar](https://evil.example/x) ![grafik](x.png) <script>alert(1)</script>"))).toBe(
      "To'lovlar grafik <script>alert(1)</script>",
    );
  });

  it("qochirilgan belgi", () => {
    expect(parseInline("\\*yulduz\\*")).toEqual([{ type: "text", text: "*yulduz*" }]);
  });
});

describe("parseMarkdown", () => {
  it("paragraf (qator ko'chishi saqlanadi), sarlavha, ro'yxatlar, chiziq", () => {
    const blocks = parseMarkdown("Birinchi qator\nikkinchi qator\n\n### Eng ko'p qarz\n\n- bir\n- **ikki**\n\n2. ikkinchi\n3. uchinchi\n\n---");
    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "heading", "list", "list", "rule"]);
    expect(blocks[0]).toEqual({
      type: "paragraph",
      children: [{ type: "text", text: "Birinchi qator" }, { type: "break" }, { type: "text", text: "ikkinchi qator" }],
    });
    expect(blocks[1]).toMatchObject({ type: "heading", level: 3 });
    expect(blocks[2]).toMatchObject({ type: "list", ordered: false, items: [[{ type: "text", text: "bir" }], [{ type: "strong" }]] });
    expect(blocks[3]).toMatchObject({ type: "list", ordered: true, start: 2 });
  });

  it("GFM jadval: tekislash ajratuvchidan, raqamli ustun — o'ngga; qatordagi yetishmagan hujayra to'ldiriladi", () => {
    const [table] = parseMarkdown(
      "| Kuryer | Filial | Qarz |\n|---|:---:|---|\n| Jasur Tursunov | Toshkent HQ | 2 840 000 so'm |\n| Aziz | Farg'ona |",
    );
    expect(table).toMatchObject({ type: "table", align: ["start", "center", "end"] });
    if (table.type !== "table") throw new Error("jadval kutilgan");
    expect(table.header.map(inlineText)).toEqual(["Kuryer", "Filial", "Qarz"]);
    expect(table.rows.map((row) => row.map(inlineText))).toEqual([
      ["Jasur Tursunov", "Toshkent HQ", "2 840 000 so'm"],
      ["Aziz", "Farg'ona", ""],
    ]);
  });

  it("jadvaldan keyingi matn — alohida paragraf; `|` li oddiy qator jadval emas", () => {
    const blocks = parseMarkdown("| A | B |\n|---|---|\n| 1 | 2 |\n\nXulosa: a | b");
    expect(blocks.map((block) => block.type)).toEqual(["table", "paragraph"]);
  });

  it("``` blok — matn sifatida; CRLF qabul qilinadi", () => {
    expect(parseMarkdown("```\nSELECT 1;\n```\r\nOxiri")).toEqual([
      { type: "code", text: "SELECT 1;" },
      { type: "paragraph", children: [{ type: "text", text: "Oxiri" }] },
    ]);
  });

  it("javob qo'shimchasi `_(6 qadam chegarasiga yetildi — savolni aniqroq bering.)_` — kursiv paragraf", () => {
    const [, suffix] = parseMarkdown("Javob.\n\n_(6 qadam chegarasiga yetildi — savolni aniqroq bering.)_");
    expect(suffix).toEqual({
      type: "paragraph",
      children: [{ type: "em", children: [{ type: "text", text: "(6 qadam chegarasiga yetildi — savolni aniqroq bering.)" }] }],
    });
  });
});
