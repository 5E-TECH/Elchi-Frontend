import { describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import type { TrackingEvent } from "../../../entities/order";
import { describeTrackingEvent } from "./describeTrackingEvent";

/** Tarix yozuvi → jumla («Rol **aktyor** …»), holat o'tishi va bog'liq ma'lumotlar. */
const t = i18n.getFixedT("uz", "orders");
const base = {
  id: "e1",
  order_id: "95",
  changed_by: "7",
  changed_by_role: "registrator",
  actor: { name: "Bobur Xolmatov", role: "registrator" },
  created_at: "2026-10-09T08:00:00.000Z",
};
const view = (event: Partial<TrackingEvent>, context?: Parameters<typeof describeTrackingEvent>[3]) =>
  describeTrackingEvent({ ...base, ...event } as TrackingEvent, t as never, null, context);
const sentence = (v: ReturnType<typeof view>) =>
  `${v.sentence.before}${v.roleLabel} ${v.actor}${v.sentence.after}`;

describe("describeTrackingEvent", () => {
  it("⭐ new → received: «Ro'yxatchi Bobur Xolmatov buyurtmani HQ'da qabul qildi» (maket)", () => {
    const v = view({ action: "status_change", old_value: { status: "new" }, new_value: { status: "received" } });
    expect(sentence(v)).toBe("Ro'yxatchi Bobur Xolmatov buyurtmani HQ'da qabul qildi");
    expect(v.oldStatus).toBe("new");
    expect(v.newStatus).toBe("received");
  });

  it("yaratildi — market o'zi: «Market Chilonzor Market buyurtmani yaratdi», tizim izohi takrorlanmaydi", () => {
    const v = view({
      action: "created",
      changed_by_role: "market",
      actor: { name: "Chilonzor Market", role: "market" },
      old_value: null,
      new_value: { status: "new" },
      description: "Buyurtma yaratildi",
    });
    expect(sentence(v)).toBe("Market Chilonzor Market buyurtmani yaratdi");
    expect(v.note).toBe("");
  });

  it("pochta jo'natildi — pochta va filial nomlari jumlada, qo'shimcha qatorda takrorlanmaydi", () => {
    const v = view({
      action: "status_change",
      old_value: { status: "received" },
      new_value: { status: "on the road", branch_name: "Urgut", post_name: "Pochta №2041" },
    });
    expect(sentence(v)).toBe("Ro'yxatchi Bobur Xolmatov Pochta №2041ni HQ'dan Urgut filialiga jo'natdi");
    expect(v.details.map((detail) => detail.value)).not.toContain("Urgut");
  });

  it("⭐ D-05: pochta nomi yo'q — gap o'rtasida kichik harf, filial nomi buyurtmadan (maket `manager-orders-detail`)", () => {
    const v = view(
      { action: "status_change", old_value: { status: "received" }, new_value: { status: "on the road" } },
      { branchName: "Urgut" },
    );
    expect(sentence(v)).toBe("Ro'yxatchi Bobur Xolmatov pochtani HQ'dan Urgut filialiga jo'natdi");
  });

  it("⭐ D-04: tizim hodisasi — «Tizim» (inglizcha «System» yoki boshqa odam emas)", () => {
    const v = view({
      action: "status_change",
      changed_by: "0",
      changed_by_role: "system",
      actor: { name: "system", role: "system" },
      old_value: { status: "new" },
      new_value: { status: "received" },
    });
    expect(v.actor).toBe("Tizim");
    expect(v.roleLabel).toBe("Tizim");
    expect(`${v.sentence.before}${v.actor}${v.sentence.after}`).toBe("Tizim buyurtmani HQ'da qabul qildi");
  });

  it("D-04: kuryer qaytargan tizim hodisasi joriy foydalanuvchiga (menejer) yozilmaydi", () => {
    const manager = { id: "77", name: "Ravshan Ortiqov", role: "manager", phone_number: "+998901234567" };
    const event = {
      ...base,
      action: "status_change",
      changed_by: "0",
      changed_by_role: "system",
      actor: { name: "system", role: "system" },
      old_value: { status: "on the road" },
      new_value: { status: "waiting" },
    } as TrackingEvent;
    const v = describeTrackingEvent(event, t as never, manager as never);
    expect(v.actor).toBe("Tizim");
    expect(v.details.map((detail) => detail.value)).not.toContain("+998901234567");

    // Hodisaning o'zida kuryer nomi bo'lsa — o'sha (ma'lumot API'dan).
    const withCourier = describeTrackingEvent(
      { ...event, new_value: { status: "waiting", courier_name: "Jasur Tursunov" } } as TrackingEvent,
      t as never,
      manager as never,
    );
    expect(withCourier.actor).toBe("Jasur Tursunov");
    expect(withCourier.roleLabel).toBe("Kuryer");
  });

  it("ismsiz aktyor — rol nomi o'zbekcha («Menejer»), inglizcha «Manager» emas", () => {
    const v = view({ actor: undefined, changed_by_role: "manager", action: "status_change", new_value: { status: "sold" }, old_value: { status: "waiting" } });
    expect(v.actor).toBe("Menejer");
  });

  it("shablonsiz izoh — «Izoh» blokida, jumla faqat aktyor; kuryer telefoni bog'liq ma'lumotda", () => {
    const v = view({
      action: "note",
      changed_by_role: "courier",
      actor: { name: "Jasur", role: "courier", phone_number: "+998901112233" },
      old_value: { status: "waiting" },
      new_value: { status: "waiting" },
      note: "Mijoz telefonni ko'tarmadi",
    });
    expect(sentence(v)).toBe("Kuryer Jasur");
    expect(v.note).toBe("Mijoz telefonni ko'tarmadi");
    expect(v.details).toEqual([{ label: "Telefon", value: "+998901112233", kind: "phone" }]);
  });
});
