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

/**
 * vbu7Wr3o (prod E2E Surxondaryo, 2026-10-26): pochta qabuli yozuvi (`action: "post_received"`), jo'natishda
 * «… filiali filialiga» takrori, metadata kalitlari o'zbekcha (xom «From Holder Type: HQ» emas).
 */
describe("describeTrackingEvent — pochta qabuli va metadata (vbu7Wr3o)", () => {
  const manager = { name: "Ravshan Ortiqov", role: "manager" };

  it("⭐ post_received (filial): «Menejer Ravshan Ortiqov pochtani qabul qildi — <filial>», «kutilmoqda holatiga qaytardi» emas", () => {
    const v = view(
      {
        action: "post_received",
        changed_by: "101",
        changed_by_role: "manager",
        actor: manager,
        from_status: "on the road",
        to_status: "waiting",
        note: "Post received by branch",
        description: "TEST Claude Surxondaryo filiali pochtani qabul qildi",
        metadata: { post_id: "35", branch_name: "TEST Claude Surxondaryo filiali" },
      },
      // Buyurtmaning JORIY filiali (HQ'ga qaytgan) — jumlaga tushmaydi.
      { branchName: "HQ Toshkent" },
    );
    expect(sentence(v)).toBe("Menejer Ravshan Ortiqov pochtani qabul qildi — TEST Claude Surxondaryo filiali");
    expect(sentence(v)).not.toContain("qaytardi");
    expect(v.actionName).toBe("Qabul qilindi");
    expect(v.note).toBe("");
    // Filial nomi jumlada — qo'shimcha qatorda takrorlanmaydi; `post_id` — ichki id, chiqmaydi.
    expect(v.details).toEqual([]);
    expect(v.oldStatus).toBe("on the road");
    expect(v.newStatus).toBe("waiting");
  });

  it("post_received (kuryer): «Kuryer Ali Valiyev pochtani qabul qildi», ism qo'shimcha qatorda takrorlanmaydi", () => {
    const v = view({
      action: "post_received",
      changed_by: "26",
      changed_by_role: "courier",
      actor: { name: "Ali Valiyev", role: "courier" },
      old_value: { status: "on the road" },
      new_value: { status: "waiting" },
      note: "Post received by courier",
      metadata: { post_id: "36", courier_name: "Ali Valiyev" },
    });
    expect(sentence(v)).toBe("Kuryer Ali Valiyev pochtani qabul qildi");
    expect(v.details).toEqual([]);
  });

  it("ru / en: qabul jumlasi tarjimada", async () => {
    await i18n.loadLanguages(["ru", "en"]);
    const event = {
      ...base,
      action: "post_received",
      changed_by_role: "manager",
      actor: manager,
      from_status: "on the road",
      to_status: "waiting",
      metadata: { post_id: "35", branch_name: "Surxondaryo" },
    } as unknown as TrackingEvent;
    const ru = describeTrackingEvent(event, i18n.getFixedT("ru", "orders") as never, null);
    const en = describeTrackingEvent(event, i18n.getFixedT("en", "orders") as never, null);
    expect(`${ru.actor}${ru.sentence.after}`).toBe("Ravshan Ortiqov принял(а) почту — Surxondaryo");
    expect(`${en.actor}${en.sentence.after}`).toBe("Ravshan Ortiqov received the post — Surxondaryo");
  });

  it("eski yozuv (`action: \"waiting\"`, tizim, izohsiz) — avvalgidek «Tizim buyurtmani kutilmoqda holatiga qaytardi»", () => {
    const v = view({
      action: "waiting",
      changed_by: "system",
      changed_by_role: "system",
      actor: { name: "system", role: "system" },
      old_value: { status: "on the road" },
      new_value: { status: "waiting" },
      note: undefined,
    });
    expect(`${v.sentence.before}${v.actor}${v.sentence.after}`).toBe("Tizim buyurtmani kutilmoqda holatiga qaytardi");
  });

  it("⭐ jo'natish: filial nomida «filiali» bor — «… TEST Claude Surxondaryo filialiga jo'natdi» («filiali filialiga» emas)", () => {
    const v = view({
      action: "sent",
      old_value: { status: "received" },
      new_value: { status: "on the road" },
      note: "Post #35 HQ'dan branch #12 ga dispatch qilindi",
      metadata: { post_id: "35", branch_name: "TEST Claude Surxondaryo filiali" },
    });
    expect(sentence(v)).toBe("Ro'yxatchi Bobur Xolmatov pochtani HQ'dan TEST Claude Surxondaryo filialiga jo'natdi");
    expect(sentence(v)).not.toMatch(/filiali filialiga/);
  });

  it("jo'natish: oddiy nom («Urgut») — avvalgidek «Urgut filialiga»; izohdagi «dispatch» yo'li ham takrorlamaydi", () => {
    const plain = view({
      action: "sent",
      old_value: { status: "received" },
      new_value: { status: "on the road" },
      metadata: { post_id: "35", branch_name: "Urgut" },
    });
    expect(sentence(plain)).toBe("Ro'yxatchi Bobur Xolmatov pochtani HQ'dan Urgut filialiga jo'natdi");

    // Holat o'tishisiz, faqat izoh («dispatch qilindi») bilan kelgan yozuv.
    const viaNote = view({
      action: "sent",
      old_value: { status: "on the road" },
      new_value: { status: "on the road" },
      note: "Post #35 HQ'dan branch #12 ga dispatch qilindi",
      metadata: { branch_name: "Qarshi filiali" },
    });
    expect(sentence(viaNote)).toBe("Ro'yxatchi Bobur Xolmatov pochtani HQ'dan Qarshi filialiga jo'natdi");
  });

  it("⭐ metadata kalitlari o'zbekcha, ichki id'lar yashirin (xom «From Holder Type: HQ / Received By: 101 / Source Type: BRANCH» emas)", () => {
    const v = view({
      action: "status_change",
      changed_by_role: "registrator",
      old_value: { status: "cancelled (sent)" },
      new_value: { status: "cancelled (sent)" },
      metadata: {
        from_holder_type: "HQ",
        to_holder_type: "COURIER",
        received_by: "101",
        source_type: "BRANCH",
        source_user_id: "55",
        source_user_role: "manager",
        handover_session_id: "9",
        post_id: "35",
      },
    });
    expect(v.details).toEqual([
      { label: "Kimdan", value: "Bosh ofis (HQ)" },
      { label: "Kimga", value: "Kuryer" },
      { label: "Jo'natuvchi", value: "Filial" },
      { label: "Jo'natuvchi roli", value: "Menejer" },
    ]);
    const text = v.details.map((detail) => `${detail.label}: ${detail.value}`).join(" / ");
    expect(text).not.toMatch(/Holder Type|Received By|Source Type|101|BRANCH/);
  });

  it("⭐ `source_courier_id` + `source_courier_name` — «Jo'natgan kuryer: …» (prod order 132: xom «Source Courier: …» emas), uz/ru/en", async () => {
    await i18n.loadLanguages(["ru", "en"]);
    // Backend (bekor pochtani qabul qilish yozuvi) metadata'si aynan shu shaklda: id + ism, manba / manzil filiali.
    const event = {
      ...base,
      action: "status_change",
      changed_by_role: "manager",
      actor: manager,
      old_value: { status: "cancelled" },
      new_value: { status: "cancelled (sent)", holder_type: "BRANCH", holder_courier_id: null },
      metadata: {
        canceled_post_id: "41",
        source_type: "COURIER",
        source_user_id: "212",
        source_user_role: "courier",
        source_courier_id: "212",
        source_courier_name: "Ali Valiyev",
        source_branch_id: "12",
        source_branch: "Urgut filiali (UR, ID: 12)",
        destination_branch_id: "12",
        received_by_hq: false,
        received_by: "101",
      },
    } as unknown as TrackingEvent;
    const labels = (lang: "uz" | "ru" | "en") =>
      describeTrackingEvent(event, i18n.getFixedT(lang, "orders") as never, null).details;

    const uz = labels("uz");
    expect(uz).toContainEqual({ label: "Jo'natgan kuryer", value: "Ali Valiyev" });
    expect(uz.filter((detail) => detail.value === "Ali Valiyev")).toHaveLength(1);
    expect(labels("ru")).toContainEqual({ label: "Курьер-отправитель", value: "Ali Valiyev" });
    expect(labels("en")).toContainEqual({ label: "Sending courier", value: "Ali Valiyev" });
    for (const lang of ["uz", "ru"] as const) {
      const text = labels(lang).map((detail) => `${detail.label}: ${detail.value}`).join(" / ");
      expect(text).not.toMatch(/Source|Destination|Courier|Holder|Received By|212|101/);
    }
  });

  it("`*_courier` / `source_*` id kalitlari ismi bilan kelsa — o'zbekcha yorliq (Jo'natuvchi xodim, Saqlovchi kuryer)", () => {
    const v = view({
      action: "status_change",
      changed_by_role: "registrator",
      old_value: { status: "waiting" },
      new_value: { status: "waiting", holder_courier_id: "77", holder_courier_name: "Vali Aliyev" },
      metadata: { source_user_id: "55", source_user_name: "Ravshan Ortiqov" },
    });
    expect(v.details).toContainEqual({ label: "Jo'natuvchi xodim", value: "Ravshan Ortiqov" });
    expect(v.details).toContainEqual({ label: "Saqlovchi kuryer", value: "Vali Aliyev" });
    expect(v.details.map((detail) => detail.label).join(" ")).not.toMatch(/Source|Holder|Courier|User/);
  });

  it("bekor buyurtmani topshirish usuli (`method`) jumlada — alohida «Method: qr» qatori yo'q", () => {
    const v = view({
      action: "cancelled_market_handover_qr",
      changed_by_role: "manager",
      actor: manager,
      old_value: { status: "cancelled (sent)" },
      new_value: { status: "returned_to_market" },
      metadata: { method: "qr", market_id: "37", branch_name: "Urgut filiali", from_holder_type: "BRANCH" },
    });
    expect(v.details.map((detail) => detail.label)).not.toContain("Method");
    expect(v.details.map((detail) => detail.value)).not.toContain("qr");
  });
});
