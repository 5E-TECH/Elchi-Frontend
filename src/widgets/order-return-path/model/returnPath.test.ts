import { describe, expect, it } from "vitest";
import type { TrackingEvent } from "../../../entities/order";
import { buildReturnPath } from "./returnPath";

/**
 * «QAYTARISH YO'LI» — backend `GET orders/:id/tracking` shaklidagi hodisalardan (holat + custody; backend
 * `getTrackingByOrderId`), maket `manager-orders-detail-cancelled`: filial → HQ zanjiri 6 qadam.
 */

let seq = 0;
const ev = (at: string, fields: Partial<TrackingEvent> & Record<string, unknown>): TrackingEvent =>
  ({
    id: `e${++seq}`,
    order_id: "10305",
    action: "status_change",
    old_value: null,
    new_value: null,
    changed_by: "1",
    changed_by_role: "system",
    created_at: at,
    ...fields,
  }) as TrackingEvent;

const status = (from: string, to: string) => ({
  from_status: from,
  to_status: to,
  old_value: { status: from },
  new_value: { status: to },
});

const custody = (at: string, from: Record<string, unknown>, to: Record<string, unknown>) =>
  ev(at, { event_type: "custody", action: "custody_changed", old_value: from, new_value: to });

const courier = { name: "Jasur Tursunov", role: "courier" };
const manager = { name: "Ravshan Ortiqov", role: "manager" };
const registrator = { name: "Bobur Xolmatov", role: "registrator" };

/** Kuryer bekor qildi → Urgut filialiga → filial qabul qildi → HQ'ga → HQ qabul qildi. */
const BRANCH_TO_HQ: TrackingEvent[] = [
  ev("2026-10-05T14:20:00+05:00", {
    ...status("waiting", "cancelled"),
    actor: courier,
    changed_by_role: "courier",
  }),
  ev("2026-10-05T18:05:00+05:00", {
    ...status("cancelled", "cancelled (sent)"),
    actor: courier,
    changed_by_role: "courier",
    note: "Canceled post created",
  }),
  custody(
    "2026-10-05T18:05:01+05:00",
    { holder_type: "COURIER", holder_courier: "Jasur Tursunov, role: courier, ID: 5" },
    { holder_type: "BRANCH", holder_branch: "Urgut filiali (UR, ID: 12)" },
  ),
  ev("2026-10-05T19:30:00+05:00", {
    ...status("cancelled (sent)", "cancelled"),
    action: "cancelled_post_received",
    actor: manager,
    metadata: {
      canceled_post_id: "2107",
      destination_branch: "Urgut filiali (UR, ID: 12)",
      received_by_hq: false,
    },
  }),
  ev("2026-10-05T20:10:00+05:00", {
    ...status("cancelled", "cancelled (sent)"),
    actor: manager,
    note: "Branch canceled post sent to HQ",
  }),
  custody(
    "2026-10-05T20:10:00+05:00",
    { holder_type: "BRANCH", holder_branch: "Urgut filiali (UR, ID: 12)" },
    { holder_type: "HQ", holder_branch: null },
  ),
  ev("2026-10-05T23:40:00+05:00", {
    ...status("cancelled (sent)", "cancelled"),
    action: "cancelled_post_received",
    actor: registrator,
    note: "Canceled order received by HQ and held for market handover",
    metadata: { canceled_post_id: "2115", destination_branch: null, received_by_hq: true },
  }),
];

const HQ_ORDER = {
  id: "10305",
  status: "cancelled",
  holder_type: "HQ",
  post_id: "78",
  branch: { id: "1", name: "Toshkent HQ" },
  market: { name: "Nur Elektronika" },
  district: { name: "Urgut tumani" },
  return_reason: "CUSTOMER_REFUSED",
  last_handover_at: "2026-10-05T20:10:00+05:00",
};

describe("buildReturnPath", () => {
  it("filial → HQ zanjiri: 5 qadam + «Marketga topshirish» kutilmoqda (maket manager-orders-detail-cancelled)", () => {
    const path = buildReturnPath([...BRANCH_TO_HQ].reverse(), HQ_ORDER, {
      hqName: "Toshkent HQ",
      now: Date.parse("2026-10-08T21:00:00+05:00"),
    });
    expect(path).not.toBeNull();
    expect(path!.stage).toBe("hq");
    expect(path!.closed).toBe(false);
    expect(path!.market).toBe("Nur Elektronika");
    expect(path!.steps.map((step) => step.kind)).toEqual([
      "cancelled",
      "sent",
      "received",
      "sent",
      "received",
    ]);

    const [cancelled, sentToBranch, receivedAtBranch, sentToHq, receivedAtHq] = path!.steps;
    expect(cancelled).toMatchObject({
      actor: "Jasur Tursunov",
      role: "courier",
      place: "Urgut tumani",
      reason: "CUSTOMER_REFUSED",
    });
    // Kuryer jo'natishida «qayerdan» yozilmaydi — «Kuryer Jasur Tursunov → Urgut filiali».
    expect(sentToBranch).toMatchObject({
      actor: "Jasur Tursunov",
      place: null,
      to: "Urgut filiali",
      postId: "2107",
    });
    expect(receivedAtBranch).toMatchObject({
      place: "Urgut filiali",
      actor: "Ravshan Ortiqov",
      role: "manager",
    });
    expect(sentToHq).toMatchObject({
      place: "Urgut filiali",
      to: "Toshkent HQ",
      postId: "2115",
      role: "manager",
    });
    expect(receivedAtHq).toMatchObject({
      place: "Toshkent HQ",
      actor: "Bobur Xolmatov",
      role: "registrator",
    });
    expect(path!.pending).toEqual({
      kind: "handover",
      place: "Toshkent HQ",
      days: 3,
      atBranch: false,
    });
    expect(path!.currentPlace).toBe("Toshkent HQ");
  });

  it("topshirilgan: «Marketga topshirildi» — joy (oxirgi qabul), market, usul; kutilayotgan qadam yo'q", () => {
    const events = [
      ...BRANCH_TO_HQ,
      ev("2026-10-19T11:20:00+05:00", {
        ...status("cancelled", "returned_to_market"),
        action: "cancelled_market_handover_manual",
        actor: registrator,
        note: "Bekor qilingan order market 7ga QR buzilgani sabab qo'lda tasdiqlanib topshirildi: QR yirtilgan",
        metadata: { manual_override: true, manual_reason: "QR yirtilgan", market_id: "7" },
      }),
    ];
    const path = buildReturnPath(
      events,
      { ...HQ_ORDER, status: "returned_to_market", holder_type: "MARKET" },
      { hqName: null },
    );
    expect(path!.stage).toBe("market");
    expect(path!.closed).toBe(true);
    expect(path!.pending).toBeNull();
    const handed = path!.steps.at(-1)!;
    expect(handed).toMatchObject({
      kind: "handed",
      // `hqName` berilmagan — HQ'dan topshirilgan buyurtmaning `branch` i (HQ filiali) nomi.
      place: "Toshkent HQ",
      market: "Nur Elektronika",
      handover: { method: "manual", reason: "QR yirtilgan" },
    });
  });

  it("zanjir oxirgi bekor qilishdan boshlanadi (qayta tiklanib, yana bekor qilingan)", () => {
    const events = [
      ev("2026-10-01T10:00:00+05:00", { ...status("waiting", "cancelled"), actor: courier }),
      ev("2026-10-01T11:00:00+05:00", { ...status("cancelled", "waiting"), actor: courier }),
      ev("2026-10-02T10:00:00+05:00", { ...status("waiting", "cancelled"), actor: courier }),
    ];
    const path = buildReturnPath(events, { id: "1", status: "cancelled", holder_type: "COURIER" });
    expect(path!.steps).toHaveLength(1);
    expect(path!.steps[0].at).toBe("2026-10-02T10:00:00+05:00");
    expect(path!.pending?.kind).toBe("send");
  });

  it("yo'lda: «Qabul qilish» kutilmoqda — maqsad `branch` dan, pochta № buyurtmadan", () => {
    const events = BRANCH_TO_HQ.slice(0, 3);
    const path = buildReturnPath(events, {
      id: "1",
      status: "cancelled (sent)",
      holder_type: "BRANCH",
      canceled_post_id: "2107",
      branch: { id: "12", name: "Urgut filiali" },
    });
    expect(path!.stage).toBe("in_transit");
    expect(path!.steps[1]).toMatchObject({ kind: "sent", postId: "2107" });
    expect(path!.pending).toMatchObject({ kind: "receive", place: "Urgut filiali" });
  });

  it("tarix bo'sh bo'lsa ham bosqich va kutilayotgan qadam buyurtmadan", () => {
    const path = buildReturnPath([], {
      id: "1",
      status: "cancelled",
      holder_type: "BRANCH",
      post_id: "78",
      branch: { name: "Samarqand filiali" },
    });
    expect(path!.steps).toEqual([]);
    expect(path!.pending).toMatchObject({
      kind: "handover",
      place: "Samarqand filiali",
      atBranch: true,
    });
  });

  it("bekor bo'lmagan buyurtma — `null`", () => {
    expect(buildReturnPath(BRANCH_TO_HQ, { id: "1", status: "sold" })).toBeNull();
  });
});

describe("buildReturnPath — HQ nomi buyurtmadan", () => {
  it("HQ'dan topshirilgan: `branch` — HQ filiali, joy «Toshkent HQ» (qabul ham, topshirish ham)", () => {
    const events = [
      ...BRANCH_TO_HQ,
      ev("2026-10-19T11:20:00+05:00", { ...status("cancelled", "returned_to_market"), actor: registrator }),
    ];
    const path = buildReturnPath(events, { ...HQ_ORDER, status: "returned_to_market", holder_type: "MARKET" });
    const places = path!.steps.filter((step) => step.kind !== "cancelled").map((step) => step.to ?? step.place);
    expect(places).toEqual(["Urgut filiali", "Urgut filiali", "Toshkent HQ", "Toshkent HQ", "Toshkent HQ"]);
    expect(path!.steps.at(-1)).toMatchObject({ kind: "handed", place: "Toshkent HQ", handover: { method: "qr" } });
  });

  it("filialdan topshirilgan: HQ nomi taxmin qilinmaydi", () => {
    const events = [
      ...BRANCH_TO_HQ.slice(0, 4),
      ev("2026-10-06T11:20:00+05:00", { ...status("cancelled", "returned_to_market"), actor: manager }),
    ];
    const path = buildReturnPath(events, {
      ...HQ_ORDER,
      status: "returned_to_market",
      holder_type: "MARKET",
      branch: { id: "12", name: "Urgut filiali" },
    });
    expect(path!.steps.at(-1)).toMatchObject({ kind: "handed", place: "Urgut filiali" });
  });
});

describe("buildReturnPath — review tuzatishlari", () => {
  it("aniqlangan HQ nomi `hqName` da (tarix jumlalari ham shuni aytadi); noma'lum bo'lsa — `null`", () => {
    const handed = [
      ...BRANCH_TO_HQ,
      ev("2026-10-19T11:20:00+05:00", { ...status("cancelled", "returned_to_market"), actor: registrator }),
    ];
    expect(
      buildReturnPath(handed, { ...HQ_ORDER, status: "returned_to_market", holder_type: "MARKET" })!.hqName,
    ).toBe("Toshkent HQ");
    expect(buildReturnPath([], { ...HQ_ORDER, branch: null })!.hqName).toBeNull();
  });

  it("bekor qilinib, tiklangan va keyin `/returns` oqimida topshirilgan — eski bekor zanjiri olinmaydi", () => {
    const events = [
      ...BRANCH_TO_HQ.slice(0, 1),
      ev("2026-10-05T15:00:00+05:00", { ...status("cancelled", "waiting"), actor: manager }),
      ev("2026-10-07T10:00:00+05:00", { ...status("waiting", "returned_to_market"), actor: manager }),
    ];
    const path = buildReturnPath(events, { ...HQ_ORDER, status: "returned_to_market", holder_type: "MARKET" });
    expect(path!.steps.map((step) => step.kind)).toEqual(["handed"]);
  });

  it("tiklanib, yana bekor qilingan — zanjir oxirgi bekor qilishdan", () => {
    const events = [
      ...BRANCH_TO_HQ.slice(0, 1),
      ev("2026-10-05T15:00:00+05:00", { ...status("cancelled", "waiting"), actor: manager }),
      ev("2026-10-06T09:00:00+05:00", { ...status("waiting", "cancelled"), actor: courier }),
    ];
    const path = buildReturnPath(events, {
      ...HQ_ORDER,
      holder_type: "COURIER",
      holder_courier_id: "5",
    });
    expect(path!.steps.map((step) => [step.kind, step.at])).toEqual([["cancelled", "2026-10-06T09:00:00+05:00"]]);
  });

  it("jo'natishga ENG yaqin custody hodisasi olinadi (±60 s ichida bir nechta bo'lsa)", () => {
    const events = [
      BRANCH_TO_HQ[0],
      custody(
        "2026-10-05T18:04:10+05:00",
        { holder_type: "COURIER", holder_courier: "Jasur Tursunov, role: courier, ID: 5" },
        { holder_type: "BRANCH", holder_branch: "Samarqand filiali (SM, ID: 3)" },
      ),
      ev("2026-10-05T18:05:00+05:00", {
        ...status("cancelled", "cancelled (sent)"),
        actor: courier,
        changed_by_role: "courier",
      }),
      custody(
        "2026-10-05T18:05:01+05:00",
        { holder_type: "COURIER", holder_courier: "Jasur Tursunov, role: courier, ID: 5" },
        { holder_type: "BRANCH", holder_branch: "Urgut filiali (UR, ID: 12)" },
      ),
    ];
    const path = buildReturnPath(events, {
      ...HQ_ORDER,
      status: "cancelled (sent)",
      holder_type: "BRANCH",
      canceled_post_id: "2107",
    });
    expect(path!.steps[1]).toMatchObject({ kind: "sent", to: "Urgut filiali" });
  });

  it("kuryerda kutilayotgan qadamda kun yo'q (`last_handover_at` — kuryerga biriktirilgan vaqt)", () => {
    const path = buildReturnPath(BRANCH_TO_HQ.slice(0, 1), {
      ...HQ_ORDER,
      holder_type: "COURIER",
      holder_courier_id: "5",
      last_handover_at: "2026-09-30T09:00:00+05:00",
    });
    expect(path!.pending).toMatchObject({ kind: "send", days: null });
  });
});
