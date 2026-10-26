import { describe, expect, it } from "vitest";
import en from "../../../locales/en/status.json";
import ru from "../../../locales/ru/status.json";
import uz from "../../../locales/uz/status.json";
import {
  CANCEL_RETURN_STAGES,
  CANCEL_RETURN_STAGE_ORDER,
  cancelReturnAgeLevel,
  cleanBranchLabel,
  isOpenCancelReturnStage,
  readCancelHandoverFlags,
  resolveCancelReturnPlace,
  resolveCancelReturnStage,
  type CancelReturnStage,
} from "./cancelReturnStage";

/**
 * BEKOR BOSQICHI — taklif §3.2 jadvali (Trello vOczoOUE), ega javoblari §7 (2026-10-19):
 * badge «Bekor · HQ'da», joy nomi ikkinchi qatorda; «Marketga topshirildi» — neytral.
 */

describe("resolveCancelReturnStage — §3.2 jadvali", () => {
  it.each<[string, Record<string, unknown>, CancelReturnStage | null]>([
    [
      "kuryer qo'lida",
      { status: "cancelled", holder_type: "COURIER", holder_courier_id: "7" },
      "courier",
    ],
    [
      "eski yozuv: holder yo'q, kuryer id bor",
      { status: "cancelled", holder_courier_id: "7" },
      "courier",
    ],
    ["'0' kuryer sentineli — kuryer emas", { status: "cancelled", holder_courier_id: "0" }, null],
    ["detal: cancelled (sent)", { status: "cancelled (sent)", holder_type: "HQ" }, "in_transit"],
    [
      "detal: cancelled_sent yozilishi",
      { status: "CANCELLED_SENT", holder_type: "BRANCH" },
      "in_transit",
    ],
    [
      "ro'yxat: cancelled + transport_status",
      { status: "cancelled", transport_status: "cancelled (sent)", holder_type: "BRANCH" },
      "in_transit",
    ],
    [
      "filialda (qabul qilingan, bekor pochtasiz)",
      { status: "cancelled", holder_type: "BRANCH", post_id: "8", canceled_post_id: null },
      "branch",
    ],
    [
      "filialda, lekin pochtaga biriktirilgan — aniqlanmaydi",
      { status: "cancelled", holder_type: "BRANCH", post_id: "8", canceled_post_id: "41" },
      null,
    ],
    ["HQ'da", { status: "cancelled", holder_type: "HQ", post_id: "8" }, "hq"],
    [
      "HQ'da — bekor pochtasi bilan qabul qilingan",
      { status: "cancelled", holder_type: "HQ", post_id: null, canceled_post_id: "41" },
      "hq",
    ],
    ["holder kichik harf bilan", { status: "canceled", holder_type: "hq", post_id: 8 }, "hq"],
    [
      "qabulgacha bekor (cancelPreDeliveryOrder): holder HQ, post_id yo'q — bosqich yo'q",
      { status: "cancelled", holder_type: "HQ", post_id: null },
      null,
    ],
    [
      "qabulgacha bekor: holder BRANCH (filial uchun yaratilgan), post_id yo'q — bosqich yo'q",
      { status: "cancelled", holder_type: "BRANCH", holder_branch_id: "12", post_id: null },
      null,
    ],
    ["topshirilgan", { status: "returned_to_market", holder_type: "MARKET" }, "market"],
    ["topshirilgan (holder yo'q)", { status: "RETURNED_TO_MARKET" }, "market"],
    ["bekor + holder MARKET", { status: "cancelled", holder_type: "MARKET" }, "market"],
    ["bekor, holder noma'lum", { status: "cancelled" }, null],
    ["bekor emas", { status: "waiting", holder_type: "COURIER" }, null],
    ["eski topshirish: closed + holder MARKET (F4 dan oldin)", { status: "closed", holder_type: "MARKET" }, "market"],
    ["yopilgan (holder MARKET emas)", { status: "closed", holder_type: "HQ" }, null],
  ])("%s", (_name, order, expected) => {
    expect(resolveCancelReturnStage(order)).toBe(expected);
  });

  it("buzuq kirish yiqitmaydi", () => {
    for (const value of [null, undefined, 5, "cancelled", [], {}])
      expect(resolveCancelReturnStage(value)).toBeNull();
  });

  it("1–4 ochiq, 5 yopiq", () => {
    expect(CANCEL_RETURN_STAGE_ORDER.filter(isOpenCancelReturnStage)).toEqual([
      "courier",
      "in_transit",
      "branch",
      "hq",
    ]);
    expect(isOpenCancelReturnStage(null)).toBe(false);
  });
});

describe("CANCEL_RETURN_STAGES — ton va ko'rinish (DESIGN_SYSTEM §8)", () => {
  it("1–4 danger, «yo'lda» chegarali; «Marketga topshirildi» neytral", () => {
    expect(CANCEL_RETURN_STAGE_ORDER.map((stage) => CANCEL_RETURN_STAGES[stage].tone)).toEqual([
      "danger",
      "danger",
      "danger",
      "danger",
      "neutral",
    ]);
    expect(CANCEL_RETURN_STAGES.in_transit.variant).toBe("outline");
    expect(
      CANCEL_RETURN_STAGE_ORDER.filter(
        (stage) => CANCEL_RETURN_STAGES[stage].variant === "outline",
      ),
    ).toEqual(["in_transit"]);
  });

  it("ikonkalar maketdagidek (tizim-states-data §09)", () => {
    const name = (stage: CancelReturnStage) =>
      (CANCEL_RETURN_STAGES[stage].icon as { displayName?: string }).displayName;
    expect(CANCEL_RETURN_STAGE_ORDER.map(name)).toEqual([
      "CircleX",
      "RotateCcw",
      "Building2",
      "Warehouse",
      "PackageCheck",
    ]);
  });

  it.each([
    [
      "uz",
      uz,
      [
        "Bekor · kuryerda",
        "Bekor · yo'lda",
        "Bekor · filialda",
        "Bekor · HQ'da",
        "Marketga topshirildi",
      ],
    ],
    [
      "ru",
      ru,
      [
        "Отменён · у курьера",
        "Отменён · в пути",
        "Отменён · в филиале",
        "Отменён · в HQ",
        "Передан маркету",
      ],
    ],
    [
      "en",
      en,
      [
        "Cancelled · with courier",
        "Cancelled · in transit",
        "Cancelled · at branch",
        "Cancelled · at HQ",
        "Handed to market",
      ],
    ],
  ])("%s yorliqlari — taklif §3.2", (_lang, locale, labels) => {
    expect(CANCEL_RETURN_STAGE_ORDER.map((stage) => locale.cancelStage[stage])).toEqual(labels);
  });
});

describe("resolveCancelReturnPlace — joy qatori (faqat bor ma'lumotdan)", () => {
  const now = Date.parse("2026-10-19T12:00:00+05:00");
  const twoDaysAgo = "2026-10-17T09:00:00+05:00";

  it("HQ'da: filial (HQ) nomi + kun", () => {
    expect(
      resolveCancelReturnPlace(
        {
          status: "cancelled",
          holder_type: "HQ",
          post_id: "8",
          branch: { id: "1", name: "Toshkent HQ" },
          last_handover_at: twoDaysAgo,
        },
        undefined,
        { now },
      ),
    ).toEqual({ name: "Toshkent HQ", arrow: false, days: 2, at: null, method: null });
  });

  it("yo'lda: maqsad nomi strelka bilan, kunsiz", () => {
    expect(
      resolveCancelReturnPlace(
        {
          status: "cancelled (sent)",
          holder_type: "HQ",
          branch: { id: "1", name: "Toshkent HQ" },
          last_handover_at: twoDaysAgo,
        },
        undefined,
        { now },
      ),
    ).toEqual({ name: "Toshkent HQ", arrow: true, days: null, at: null, method: null });
  });

  it("filialda: `branch` custody filiali bo'lsagina nom", () => {
    const base = {
      status: "cancelled",
      holder_type: "BRANCH",
      post_id: "8",
      branch: { id: "12", name: "Urgut filiali" },
    };
    expect(
      resolveCancelReturnPlace({ ...base, holder_branch_id: "12" }, undefined, { now })?.name,
    ).toBe("Urgut filiali");
    expect(
      resolveCancelReturnPlace({ ...base, holder_branch_id: "99" }, undefined, { now })?.name,
    ).toBeNull();
  });

  it("kuryerda: kun yo'q — `last_handover_at` kuryerga biriktirilgan vaqt, bekor qilingan vaqt emas", () => {
    expect(
      resolveCancelReturnPlace(
        {
          status: "cancelled",
          holder_type: "COURIER",
          holder_courier_id: "7",
          courier: { id: "7", name: "Ali" },
          last_handover_at: "2026-10-10T09:00:00+05:00",
        },
        undefined,
        { now },
      ),
    ).toEqual({ name: "Ali", arrow: false, days: null, at: null, method: null });
  });

  it("kuryerda: kuryer ismi (boshqa kuryer bo'lsa — yo'q)", () => {
    const base = {
      status: "cancelled",
      holder_type: "COURIER",
      courier: { id: "7", name: "Jasur Tursunov" },
    };
    expect(
      resolveCancelReturnPlace({ ...base, holder_courier_id: "7" }, undefined, { now })?.name,
    ).toBe("Jasur Tursunov");
    expect(
      resolveCancelReturnPlace({ ...base, holder_courier_id: "8" }, undefined, { now })?.name,
    ).toBeNull();
  });

  it("topshirilgan (ro'yxat): joy, vaqtsiz — `mark-returned-to-market` `last_handover_at` ni yangilamaydi", () => {
    const place = resolveCancelReturnPlace(
      {
        status: "returned_to_market",
        branch: { id: "1", name: "Toshkent HQ" },
        last_handover_at: "1760845200000",
      },
      undefined,
      { now },
    );
    expect(place).toEqual({ name: "Toshkent HQ", arrow: false, days: null, at: null, method: null });
  });

  it("topshirilgan: vaqt faqat tarixdan berilsa (`handoverAt`), `last_handover_at` emas", () => {
    const order = {
      status: "returned_to_market",
      branch: { id: "1", name: "Toshkent HQ" },
      last_handover_at: "1760845200000",
    };
    expect(
      resolveCancelReturnPlace(order, undefined, { now, handoverAt: "2026-10-19T11:20:00+05:00" })?.at,
    ).toBe(Date.parse("2026-10-19T11:20:00+05:00"));
    expect(resolveCancelReturnPlace(order, undefined, { now, handoverAt: null })?.at).toBeNull();
  });

  it("bir kundan kam — kun yozilmaydi; sana yo'q yoki buzuq — kun yo'q", () => {
    const base = { status: "cancelled", holder_type: "HQ", post_id: "8", branch: { name: "Toshkent HQ" } };
    expect(
      resolveCancelReturnPlace(
        { ...base, last_handover_at: "2026-10-19T08:00:00+05:00" },
        undefined,
        { now },
      )?.days,
    ).toBeNull();
    expect(
      resolveCancelReturnPlace({ ...base, last_handover_at: "falonchi" }, undefined, { now })?.days,
    ).toBeNull();
    expect(resolveCancelReturnPlace(base, undefined, { now })?.days).toBeNull();
  });

  it("bekor emas — `null`", () => {
    expect(resolveCancelReturnPlace({ status: "sold" })).toBeNull();
  });
});

describe("cleanBranchLabel — backend tracking yorlig'i", () => {
  it.each([
    ["Urgut filiali (UR, ID: 12)", "Urgut filiali"],
    ["Toshkent HQ (ID: 1)", "Toshkent HQ"],
    ["Samarqand filiali", "Samarqand filiali"],
    ["branch ID: 12", null],
    ["branch", null],
    ["", null],
    [null, null],
  ])("%j → %j", (raw, expected) => {
    expect(cleanBranchLabel(raw)).toBe(expected);
  });
});

describe("vOczoOUE 2-bosqich — backend `return_stage` / `cancel_return` (BG1/BG2) ustun", () => {
  const now = Date.parse("2026-10-26T12:00:00+05:00");

  it("backend bosqichi FE hisobidan ustun (holder ma'lumoti yo'q javobda ham)", () => {
    expect(resolveCancelReturnStage({ status: "cancelled", return_stage: "hq" })).toBe("hq");
    expect(resolveCancelReturnStage({ status: "cancelled", cancel_return: { stage: "branch" } })).toBe("branch");
    // FE hisobi «kuryerda» deydi, backend — «filialda» (masalan qabul allaqachon yozilgan): backend.
    expect(
      resolveCancelReturnStage({ status: "cancelled", holder_type: "COURIER", return_stage: "branch" }),
    ).toBe("branch");
  });

  it("bekor zanjiridan tashqari holatda backend bosqichi e'tiborsiz; noma'lum qiymat — zaxira hisob", () => {
    expect(resolveCancelReturnStage({ status: "sold", return_stage: "hq" })).toBeNull();
    expect(
      resolveCancelReturnStage({ status: "cancelled", holder_type: "COURIER", return_stage: "warehouse" }),
    ).toBe("courier");
    expect(resolveCancelReturnStage({ status: "cancelled", return_stage: null, holder_type: "COURIER" })).toBe(
      "courier",
    );
  });

  it("joy nomi hamma rolda `place_name` dan, «N kun» — `received_at` dan (last_handover_at emas)", () => {
    expect(
      resolveCancelReturnPlace(
        {
          status: "cancelled",
          return_stage: "branch",
          last_handover_at: "2026-10-25T09:00:00+05:00",
          cancel_return: {
            stage: "branch",
            place_type: "BRANCH",
            place_id: 3,
            place_name: "Urgut filiali",
            received_at: "2026-10-22T10:00:00+05:00",
            sent_at: null,
            handed_over_at: null,
            handover_method: null,
          },
        },
        undefined,
        { now },
      ),
    ).toEqual({ name: "Urgut filiali", arrow: false, days: 4, at: null, method: null });
  });

  it("kuryerda — kuryer ismi (kunsiz); yo'lda — maqsad strelka bilan", () => {
    expect(
      resolveCancelReturnPlace(
        { status: "cancelled", cancel_return: { stage: "courier", place_name: "Akmal Rahimov" } },
        undefined,
        { now },
      ),
    ).toEqual({ name: "Akmal Rahimov", arrow: false, days: null, at: null, method: null });
    expect(
      resolveCancelReturnPlace(
        { status: "cancelled (sent)", cancel_return: { stage: "in_transit", place_name: "Toshkent HQ" } },
        undefined,
        { now },
      ),
    ).toEqual({ name: "Toshkent HQ", arrow: true, days: null, at: null, method: null });
  });

  it("«Marketga topshirildi» — ro'yxatda ham vaqt (`handed_over_at`) va usul (`handover_method`)", () => {
    expect(
      resolveCancelReturnPlace(
        {
          status: "returned_to_market",
          cancel_return: {
            stage: "market",
            place_name: "Samarqand filiali",
            handed_over_at: "2026-10-25T17:05:00+05:00",
            handover_method: "pin",
          },
        },
        undefined,
        { now },
      ),
    ).toEqual({
      name: "Samarqand filiali",
      arrow: false,
      days: null,
      at: Date.parse("2026-10-25T17:05:00+05:00"),
      method: "pin",
    });
  });

  it("`cancel_return` yo'q, lekin BG2 maydonlari bor — zaxirada `market_handover_at` / `_method`", () => {
    const place = resolveCancelReturnPlace(
      {
        status: "returned_to_market",
        branch: { id: "1", name: "Toshkent HQ" },
        market_handover_at: "2026-10-25T11:20:00+05:00",
        market_handover_method: "manual",
      },
      undefined,
      { now },
    );
    expect(place).toMatchObject({ name: "Toshkent HQ", at: Date.parse("2026-10-25T11:20:00+05:00"), method: "manual" });
  });

  it("«N kun» darajasi: < 3 — yo'q, 3–6 — `warn`, ≥ 7 — `alert` (ega qarori 3 / 7)", () => {
    expect([null, 1, 2, 3, 6, 7, 30].map(cancelReturnAgeLevel)).toEqual([
      null,
      null,
      null,
      "warn",
      "warn",
      "alert",
      "alert",
    ]);
  });

  it("BG7 belgilari: `handover_notified_at` / `handover_escalated_at`", () => {
    expect(
      readCancelHandoverFlags({
        handover_notified_at: "2026-10-23T10:05:00+05:00",
        handover_escalated_at: null,
      }),
    ).toEqual({ notifiedAt: Date.parse("2026-10-23T10:05:00+05:00"), escalatedAt: null });
    expect(readCancelHandoverFlags({})).toEqual({ notifiedAt: null, escalatedAt: null });
  });
});

