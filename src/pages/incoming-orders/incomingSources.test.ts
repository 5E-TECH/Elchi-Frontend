import { describe, expect, it } from "vitest";
import {
  extractIncomingSources,
  sourceLabel,
  type IncomingSource,
} from "../../entities/incoming-orders";
import { waitingFor } from "./lib";

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

  it("sana yo'q — \"—\"", () => {
    expect(waitingFor(null, now)).toEqual({ text: "—", stale: false });
    expect(waitingFor(undefined, now)).toEqual({ text: "—", stale: false });
  });

  it("yaroqsiz sana — \"—\", yiqilmaydi", () => {
    expect(waitingFor("salom", now).text).toBe("—");
  });

  it("bir soatdan kam — \"bugun\"", () => {
    expect(waitingFor(ago(30 * 60_000), now).text).toBe("bugun");
  });

  it("soatlar bilan ko'rsatiladi", () => {
    expect(waitingFor(ago(5 * HOUR), now).text).toBe("5 soat");
  });

  it("⭐ ikki kun — hali `stale` EMAS", () => {
    // Posilka yo'lda bo'lishi mumkin; erta ogohlantirish shovqin bo'lardi.
    const r = waitingFor(ago(2 * DAY), now);
    expect(r.text).toBe("2 kun");
    expect(r.stale).toBe(false);
  });

  it("⭐ uch kun — `stale`, e'tibor kerak", () => {
    const r = waitingFor(ago(3 * DAY), now);
    expect(r.text).toBe("3 kun");
    expect(r.stale).toBe(true);
  });

  it("⭐ kelajakdagi sana — \"hozir\", manfiy son EMAS", () => {
    /**
     * Server va mijoz vaqti farq qilishi mumkin. "minus 2 soat kutmoqda"
     * degan yozuv ishonchni yo'qotardi.
     */
    const r = waitingFor(new Date(now + 2 * HOUR).toISOString(), now);
    expect(r.text).toBe("hozir");
    expect(r.stale).toBe(false);
  });
});
