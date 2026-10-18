import { describe, expect, it } from "vitest";
import {
  extractIncomingSources,
  sourceLabel,
  type IncomingSource,
} from "../../entities/incoming-orders";
import {
  donutArcs,
  oldestSource,
  sourceColorIndex,
  sourceSlices,
  WAIT_METER_TARGET_PERCENT,
  waitMeterPercent,
  waitingFor,
} from "./lib";
import { waitingText } from "./ui/sourceFormat";

const src = (over: Partial<IncomingSource> = {}): IncomingSource => ({
  market_id: "5",
  orders_count: 3,
  total_price_sum: 500_000,
  oldest_at: null,
  ...over,
});

describe("extractIncomingSources — javob qobig'i", () => {
  /**
   * Backend bu marshrutda MASSIVNI to'g'ridan-to'g'ri qaytaradi
   * (`enrichMarketRows` natijasi), lekin boshqa marshrutlar `{data}` yoki
   * `{data:{data}}` bilan o'raydi. Qatlam soni o'zgarsa ekran BO'SH ko'rinib
   * qolmasligi kerak — shuning uchun uch shakl ham sinaladi.
   */
  it("to'g'ridan-to'g'ri massiv", () => {
    expect(extractIncomingSources([src()])).toHaveLength(1);
  });

  it("{data: []} qobig'i", () => {
    expect(extractIncomingSources({ data: [src()] })).toHaveLength(1);
  });

  it("{data: {data: []}} qobig'i", () => {
    expect(extractIncomingSources({ data: { data: [src()] } })).toHaveLength(1);
  });

  it("⭐ bo'sh massiv ham TO'G'RI natija — xato emas", () => {
    /**
     * Bo'sh massiv "qabul kutayotgan posilka yo'q" degani va bu haqiqiy
     * javob. Uni "topilmadi" deb ishlash ekranda xato ko'rsatardi.
     */
    expect(extractIncomingSources([])).toEqual([]);
    expect(extractIncomingSources({ data: [] })).toEqual([]);
  });

  it("kutilmagan shakl — bo'sh ro'yxat, yiqilmaydi", () => {
    expect(extractIncomingSources(null)).toEqual([]);
    expect(extractIncomingSources({ foo: 1 })).toEqual([]);
    expect(extractIncomingSources("salom")).toEqual([]);
  });
});

describe("sourceLabel", () => {
  it("nom bor — nom ko'rsatiladi", () => {
    expect(sourceLabel(src({ market: { name: "Beepost" } }))).toBe("Beepost");
  });

  it("⭐ nom yo'q — market raqami ko'rsatiladi, bo'sh EMAS", () => {
    /**
     * Nom identity xizmatidan keladi va u yiqilishi mumkin. Bo'sh sarlavha
     * kartani "anonim" qilardi va operator qaysi manbani bosayotganini
     * bilmasdi.
     */
    expect(sourceLabel(src({ market: null }))).toBe("Market #5");
    expect(sourceLabel(src({ market: { name: "   " } }))).toBe("Market #5");
    expect(sourceLabel(src())).toBe("Market #5");
  });
});

describe("waitingFor — unutilgan manbani ko'rsatish", () => {
  const now = new Date("2026-09-12T12:00:00Z").getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;

  it("sana yo'q — \"—\" (birlik `none`)", () => {
    expect(waitingFor(null, now)).toEqual({ unit: "none", count: 0, hours: 0, stale: false });
    expect(waitingFor(undefined, now)).toEqual({ unit: "none", count: 0, hours: 0, stale: false });
  });

  it("yaroqsiz sana — `none`, yiqilmaydi", () => {
    expect(waitingFor("salom", now).unit).toBe("none");
  });

  it("bir soatdan kam — \"bugun\"", () => {
    expect(waitingFor(ago(30 * 60_000), now)).toMatchObject({ unit: "today", hours: 0, stale: false });
  });

  it("soatlar bilan ko'rsatiladi", () => {
    expect(waitingFor(ago(5 * HOUR), now)).toMatchObject({ unit: "hours", count: 5, hours: 5 });
  });

  it("⭐ ikki kun — hali `stale` EMAS", () => {
    // Posilka yo'lda bo'lishi mumkin; erta ogohlantirish shovqin bo'lardi.
    expect(waitingFor(ago(2 * DAY), now)).toEqual({ unit: "days", count: 2, hours: 48, stale: false });
  });

  it("⭐ uch kun — `stale`, e'tibor kerak", () => {
    expect(waitingFor(ago(3 * DAY), now)).toEqual({ unit: "days", count: 3, hours: 72, stale: true });
  });

  it("⭐ kelajakdagi sana — \"hozir\", manfiy son EMAS", () => {
    /**
     * Server va mijoz vaqti farq qilishi mumkin. "minus 2 soat kutmoqda"
     * degan yozuv ishonchni yo'qotardi.
     */
    expect(waitingFor(new Date(now + 2 * HOUR).toISOString(), now)).toEqual({
      unit: "now",
      count: 0,
      hours: 0,
      stale: false,
    });
  });

  it("matn uch tilda (`waitingText`)", async () => {
    const i18n = (await import("../../i18n")).default;
    // ru/en — dangasa yuklanadi (faqat uz bundle ichida).
    await i18n.loadLanguages(["ru", "en"]);
    const t = i18n.getFixedT("uz", "common");
    expect(waitingText(t, waitingFor(ago(5 * HOUR), now))).toBe("5 soat");
    expect(waitingText(t, waitingFor(ago(4 * DAY), now))).toBe("4 kun");
    expect(waitingText(t, waitingFor(ago(10 * 60_000), now))).toBe("bugun");
    expect(waitingText(t, waitingFor(new Date(now + HOUR).toISOString(), now))).toBe("hozir");
    expect(waitingText(t, waitingFor(null, now))).toBe("—");
    expect(waitingText(i18n.getFixedT("ru", "common"), waitingFor(ago(4 * DAY), now))).toBe("4 дн.");
    expect(waitingText(i18n.getFixedT("en", "common"), waitingFor(ago(DAY), now))).toBe("1 day");
    expect(waitingText(i18n.getFixedT("en", "common"), waitingFor(ago(4 * DAY), now))).toBe("4 days");
  });
});

describe("kutish o'lchagichi — 4 kunlik shkala, chegara 3 kun", () => {
  const now = new Date("2026-09-12T12:00:00Z").getTime();
  const HOUR = 3_600_000;

  it("chegara chizig'i shkalaning 75% ida", () => {
    expect(WAIT_METER_TARGET_PERCENT).toBe(75);
  });

  it("to'lish soatlarga mutanosib, 4 kundan keyin — to'liq (100% dan oshmaydi)", () => {
    expect(waitMeterPercent(waitingFor(new Date(now - 24 * HOUR).toISOString(), now))).toBe(25);
    expect(waitMeterPercent(waitingFor(new Date(now - 30 * 24 * HOUR).toISOString(), now))).toBe(100);
    expect(waitMeterPercent(waitingFor(null, now))).toBe(0);
  });
});

describe("oldestSource — eng uzoq kutayotgan manba", () => {
  it("eng eski `oldest_at`; sanasizlar hisobga olinmaydi", () => {
    const a = src({ market_id: "1", oldest_at: "2026-09-10T10:00:00Z" });
    const b = src({ market_id: "2", oldest_at: "2026-09-08T10:00:00Z" });
    const c = src({ market_id: "3", oldest_at: null });
    expect(oldestSource([a, b, c])?.market_id).toBe("2");
  });

  it("hech birida sana yo'q — `null` (blok chizilmaydi)", () => {
    expect(oldestSource([src(), src({ market_id: "6" })])).toBeNull();
    expect(oldestSource([])).toBeNull();
  });
});

describe("sourceSlices / donutArcs — taqsimot grafigi", () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => src({ market_id: String(i + 1), orders_count: n - i }));

  it("6 tagacha manba — har biri o'z rangida, tartib o'zgarmaydi", () => {
    const slices = sourceSlices(many(6));
    expect(slices.map((slice) => slice.colorIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(slices.every((slice) => slice.source)).toBe(true);
  });

  it("⭐ 6 tadan ko'p — birinchi 5 tasi + «Boshqa» (qolganlar yig'indisi, kulrang)", () => {
    const slices = sourceSlices(many(8)); // sonlar: 8,7,6,5,4,3,2,1
    expect(slices).toHaveLength(6);
    expect(slices[5]).toMatchObject({ source: null, colorIndex: null, value: 3 + 2 + 1 });
    expect(sourceColorIndex(many(8), 4)).toBe(4);
    expect(sourceColorIndex(many(8), 5)).toBeNull();
  });

  it("halqa bo'laklari maketdagidek: 7 · 3 · 2, oraliq 2 px", () => {
    const circumference = 2 * Math.PI * 52;
    const arcs = donutArcs(
      sourceSlices([
        src({ market_id: "a", orders_count: 7 }),
        src({ market_id: "b", orders_count: 3 }),
        src({ market_id: "c", orders_count: 2 }),
      ]),
      circumference,
    );
    // Maket `superadmin-neworders-incoming-sources`: 187.09 · 80.18 · 53.45; siljish 0 · 189.09 · 271.27.
    expect(arcs.map((arc) => arc.length.toFixed(2))).toEqual(["187.09", "80.18", "53.45"]);
    expect(arcs.map((arc) => arc.offset.toFixed(2))).toEqual(["0.00", "189.09", "271.27"]);
  });

  it("bitta manba — oraliqsiz to'liq halqa; nol qiymat chizilmaydi", () => {
    const arcs = donutArcs(sourceSlices([src({ orders_count: 4 }), src({ market_id: "z", orders_count: 0 })]), 100);
    expect(arcs).toHaveLength(1);
    expect(arcs[0].length).toBe(100);
  });
});
