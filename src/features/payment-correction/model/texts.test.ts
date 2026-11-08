import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import { buildCorrectionTarget, type CorrectionTarget } from "./target";
import { createCorrectionTexts } from "./texts";

/**
 * T6 N2 — oyna, tasdiq va xabar matnlari maketdan aynan (`superadmin-payments-history-reverse-{dialog,confirm}`,
 * `-correct-amount-{dialog,confirm}`, `-detail-dialog-{correctable,locked}`): to'lov turi × amal × yo'nalish × usul;
 * tomonlar `correctable.transfer` dan, nom yo'q — umumiy so'z, `transfer` yo'q — umumiy jumla. Pul va sana bo'linmaydi
 * (U+00A0) — solishtirishda oddiy bo'shliqqa qaytariladi.
 */

const plain = <T,>(value: T): T =>
  (typeof value === "string"
    ? value.replace(/\u00a0/g, " ")
    : Array.isArray(value)
      ? value.map(plain)
      : value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, plain(child)]))
        : value) as T;

const uz = () => createCorrectionTexts(i18n.getFixedT("uz", "payments"), "uz");

const courierTransfer = {
  kind: "courier_payment",
  payment_method: "cash",
  amount: 1850000,
  receiver: { cashbox_type: "main", branch_id: null, name: null },
  courier: { id: "301", name: "Jasur Tursunov" },
  market: null,
};
const marketTransfer = {
  kind: "market_payment",
  payment_method: "click",
  amount: 2400000,
  receiver: { cashbox_type: "main", branch_id: null, name: null },
  courier: null,
  market: { id: "77", name: "Baraka Shop" },
};

const make = (
  transfer: unknown,
  extra: Partial<{ id: string; amount: number; title: string; createdAt: string; paymentMethod: string }> = {},
): CorrectionTarget =>
  buildCorrectionTarget({
    id: extra.id ?? "4512",
    amount: extra.amount ?? 1850000,
    title: extra.title ?? "Kuryer to'lovi",
    createdAt: extra.createdAt ?? "2026-10-07T09:32:00.000Z",
    paymentMethod: extra.paymentMethod ?? "cash",
    correctable: {
      allowed: true,
      deadline: "2026-11-07T08:05:00.000Z",
      window_days: 30,
      root_history_id: extra.id ?? "4512",
      transfer,
    },
  })!;

describe("«To'lovni qaytarish» — kuryer to'lovi → asosiy kassa, naqd (maketning asosiy holati)", () => {
  it("oyna: sarlavha, tavsif, xulosa, izoh", () => {
    const texts = uz().reverse(make(courierTransfer));
    expect(plain(texts.title)).toBe("To'lovni qaytarish");
    expect(plain(texts.description)).toBe("#4512 · Kuryer to'lovi · 07.10.2026, 14:32");
    expect(texts.description).toContain("07.10.2026,\u00a014:32");
    expect(texts.amountLabel).toBe("Qaytariladigan to'lov");
    expect(texts.methodBadge).toBe("Naqd");
    expect(texts.transfer).toEqual({
      from: { title: "Kuryer kassasi", meta: "Jasur Tursunov" },
      to: { title: "Asosiy kassa" },
    });
    expect(texts.note).toBe(
      "Pul teskari yo'nalishda qaytadi: asosiy kassadan Jasur Tursunov kassasiga. Asl yozuv o'chirilmaydi — teskari yozuv qo'shiladi.",
    );
    expect([texts.cancelLabel, texts.continueLabel]).toEqual(["Bekor qilish", "Davom etish"]);
  });

  it("«Sabab»: bo'sh — «Kamida 5 ta belgi» + «0 / 500»; qisqa (tark etilgach) — xato; to'g'ri — kim ko'radi", () => {
    const texts = uz().reverse(make(courierTransfer));
    expect(texts.reasonField("", false)).toMatchObject({
      label: "Sabab",
      placeholder: "Nima uchun qaytaryapsiz?",
      hint: "Kamida 5 ta belgi",
      error: undefined,
      counter: "0 / 500",
      maxLength: 500,
      valid: false,
    });
    expect(texts.reasonField("Xato", false).error).toBeUndefined();
    expect(texts.reasonField("Xato", true)).toMatchObject({ error: "Kamida 5 ta belgi yozing", counter: "4 / 500" });
    expect(texts.reasonField("Kuryer pulni bermagan — xato bosilgan", true)).toMatchObject({
      hint: "Jurnalga yoziladi; kuryer ilovada ko'radi, Telegram xabariga kirmaydi",
      error: undefined,
      valid: true,
    });
  });

  it("tasdiq: teskari yo'nalish, oqibatlar (maketdagi 4 qator), «qaytarib bo'lmaydi», tugmalar", () => {
    const { confirm } = uz().reverse(make(courierTransfer));
    expect(confirm.title).toBe("To'lovni qaytarishni tasdiqlang");
    expect(plain(confirm.description)).toBe("#4512 · Kuryer to'lovi · 07.10.2026, 14:32");
    expect(confirm.transfer).toEqual({
      from: { title: "Asosiy kassa", label: undefined },
      to: { title: "Kuryer kassasi", meta: "Jasur Tursunov", label: undefined },
    });
    expect(plain(confirm.consequences.map((item) => item.text))).toEqual([
      "Asosiy kassadan 1 850 000 so'm naqd chiqim yoziladi — joriy smenaga",
      "Jasur Tursunov kassasiga 1 850 000 so'm qaytadi — u pulni yana topshirishi kerak bo'ladi",
      "Kuryerga xabar boradi: ilovada, Telegram ulangan bo'lsa unda ham. Sabab faqat ilovada ko'rinadi",
      "Asl yozuv o'chirilmaydi — ro'yxatda «Qaytarildi» va «Teskari yozuv» bo'lib qoladi",
    ]);
    expect(confirm.consequences.map((item) => item.icon.displayName)).toEqual(["Wallet", "Truck", "Bell", "History"]);
    expect(confirm.consequences[0].text).toContain("1\u00a0850\u00a0000\u00a0so'm");
    expect(confirm).toMatchObject({
      irreversible: "Qaytarishni bekor qilib bo'lmaydi.",
      cancelLabel: "Orqaga",
      confirmLabel: "Qaytarish",
      loadingLabel: "Qaytarilmoqda…",
      reasonLabel: "Sabab",
    });
  });

  it("xabar: «To'lov qaytarildi» — «1 850 000 so'm Jasur Tursunov kassasiga qaytdi. Kuryerga xabar yuborildi.»", () => {
    expect(plain(uz().reverse(make(courierTransfer)).toast)).toEqual({
      title: "To'lov qaytarildi",
      description: "1 850 000 so'm Jasur Tursunov kassasiga qaytdi. Kuryerga xabar yuborildi.",
    });
  });
});

describe("«To'lovni qaytarish» — boshqa turlar", () => {
  it("marketga to'lov (#4498 · Baraka Shop, O'tkazma): izoh, yo'nalish, oqibatlar (+ tarix qatori)", () => {
    const texts = uz().reverse(make(marketTransfer, { id: "4498", amount: 2400000, title: "Market to'lovi" }));
    expect(texts.methodBadge).toBe("O'tkazma");
    expect(texts.transfer).toEqual({
      from: { title: "Asosiy kassa" },
      to: { title: "Market kassasi", meta: "Baraka Shop" },
    });
    expect(plain(texts.note)).toBe("Pul asosiy kassaga qaytadi, Baraka Shopga berilishi kerak summa 2 400 000 so'mga ortadi.");
    expect(plain(texts.confirm.consequences.map((item) => item.text))).toEqual([
      "Asosiy kassaga 2 400 000 so'm qaytadi",
      "Baraka Shopga berilishi kerak summa 2 400 000 so'mga ortadi",
      "Oxirgi to'langan buyurtmalar «Qisman to'langan» yoki «Sotilgan» holatiga qaytadi",
      "Market egasiga xabar boradi: ilovada, Telegram ulangan bo'lsa unda ham. Sabab faqat ilovada ko'rinadi",
      "Asl yozuv o'chirilmaydi — ro'yxatda «Qaytarildi» va «Teskari yozuv» bo'lib qoladi",
    ]);
    expect(texts.reasonField("Marketga ikki marta to'langan", true).hint).toBe(
      "Jurnalga yoziladi; market ilovada ko'radi, Telegram xabariga kirmaydi",
    );
    expect(plain(texts.toast.description)).toBe(
      "Baraka Shopga berilishi kerak summa 2 400 000 so'mga ortdi. Marketga xabar yuborildi.",
    );
  });

  it("kuryerdan marketga o'tkazma (click_to_market): izoh maketdagidek, asosiy kassa o'zgarmaydi", () => {
    const texts = uz().reverse(
      make(
        {
          ...courierTransfer,
          payment_method: "click_to_market",
          amount: 1200000,
          courier: { id: "302", name: "Rustam Qosimov" },
          market: { id: "77", name: "Baraka Shop" },
        },
        { amount: 1200000 },
      ),
    );
    expect(texts.methodBadge).toBe("O'tkazma");
    expect(texts.transfer).toEqual({
      from: { title: "Kuryer kassasi", meta: "Rustam Qosimov" },
      to: { title: "Market kassasi", meta: "Baraka Shop" },
    });
    expect(plain(texts.note)).toBe(
      "Rustam Qosimov kassasiga 1 200 000 so'm qaytadi, Baraka Shopga berilishi kerak summa ham shuncha ortadi; asosiy kassa o'zgarmaydi.",
    );
    expect(texts.reasonField("Marketga xato o'tkazilgan", true).hint).toBe(
      "Jurnalga yoziladi; kuryer va market ilovada ko'radi, Telegram xabariga kirmaydi",
    );
    expect(texts.confirm.consequences.map((item) => item.icon.displayName)).toEqual(["Truck", "Store", "Wallet", "Bell", "History"]);
  });

  it("filial kuryeri (Urgut filiali): filial kassasidan chiqim, kuryer va filial boshlig'iga xabar", () => {
    const texts = uz().reverse(
      make({ ...courierTransfer, receiver: { cashbox_type: "branch", branch_id: "15", name: "Urgut filiali" } }),
    );
    expect(texts.transfer?.to).toEqual({ title: "Filial kassasi", meta: "Urgut filiali" });
    expect(texts.note).toBe(
      "Pul teskari yo'nalishda qaytadi: Urgut filiali kassasidan Jasur Tursunov kassasiga. Asl yozuv o'chirilmaydi — teskari yozuv qo'shiladi.",
    );
    expect(plain(texts.confirm.consequences.slice(0, 3).map((item) => item.text))).toEqual([
      "Urgut filiali kassasidan chiqim yoziladi",
      "Jasur Tursunov kassasiga 1 850 000 so'm qaytadi — u pulni yana topshirishi kerak bo'ladi",
      "Kuryerga va filial boshlig'iga xabar boradi",
    ]);
    expect(texts.confirm.consequences[0].icon.displayName).toBe("Building2");
  });

  it("nom kelmagan (fail-open): umumiy so'z, gap boshida bosh harf; nom o'ylab topilmaydi", () => {
    const texts = uz().reverse(
      make({
        ...courierTransfer,
        payment_method: "click_to_market",
        courier: { id: "302", name: null },
        market: { id: "77", name: null },
        receiver: { cashbox_type: "main", branch_id: null, name: null },
      }),
    );
    expect(texts.transfer).toEqual({ from: { title: "Kuryer kassasi" }, to: { title: "Market kassasi" } });
    expect(plain(texts.note)).toBe(
      "Kuryer kassasiga 1 850 000 so'm qaytadi, marketga berilishi kerak summa ham shuncha ortadi; asosiy kassa o'zgarmaydi.",
    );
    const branch = uz().reverse(
      make({ ...courierTransfer, courier: { id: "301", name: null }, receiver: { cashbox_type: "branch", branch_id: "15", name: null } }),
    );
    expect(branch.note).toBe(
      "Pul teskari yo'nalishda qaytadi: filial kassasidan kuryer kassasiga. Asl yozuv o'chirilmaydi — teskari yozuv qo'shiladi.",
    );
    expect(branch.confirm.consequences[0].text).toBe("Filial kassasidan chiqim yoziladi");
  });

  it("`transfer` yo'q (eski backend): umumiy matn, qayerdan → qayerga yo'q, sarlavha — tafsilotdagi", () => {
    const texts = uz().reverse(make(undefined, { title: "Kuryerdan filialga o'tkazma" }));
    expect(texts.transfer).toBeUndefined();
    expect(texts.confirm.transfer).toBeUndefined();
    expect(plain(texts.description)).toBe("#4512 · Kuryerdan filialga o'tkazma · 07.10.2026, 14:32");
    expect(texts.note).toBe("Pul teskari yo'nalishda qaytadi. Asl yozuv o'chirilmaydi — teskari yozuv qo'shiladi.");
    expect(texts.methodBadge).toBe("Naqd");
    expect(texts.reasonField("Kuryer pulni bermagan", true).hint).toBe("Jurnalga yoziladi, Telegram xabariga kirmaydi");
    expect(plain(texts.confirm.consequences.map((item) => item.text))).toEqual([
      "Pul kassalarga teskari yo'nalishda qaytadi — joriy smenaga",
      "To'lov tomonlariga xabar boradi: ilovada, Telegram ulangan bo'lsa unda ham. Sabab faqat ilovada ko'rinadi",
      "Asl yozuv o'chirilmaydi — ro'yxatda «Qaytarildi» va «Teskari yozuv» bo'lib qoladi",
    ]);
    expect(plain(texts.toast.description)).toBe("#4512: 1 850 000 so'm teskari yo'nalishda qaytdi.");
  });
});

describe("«Summani tahrirlash»", () => {
  const market = () => make(marketTransfer, { id: "4498", amount: 2400000, title: "Market to'lovi", createdAt: "2026-10-07T08:05:00.000Z" });

  it("oyna: tavsif kontragent bilan, joriy summa, «To'g'ri summa», maydon xatolari", () => {
    const texts = uz().correct(market(), null);
    expect(texts.title).toBe("Summani tahrirlash");
    expect(plain(texts.description)).toBe("#4498 · Market to'lovi · Baraka Shop · 07.10.2026, 13:05");
    expect(texts.amountLabel).toBe("Joriy summa");
    expect(texts.newAmountLabel).toBe("To'g'ri summa");
    expect(texts.newAmountHint).toBe("0 dan katta va joriy summadan farqli");
    expect(texts.amountErrors.zero).toBe("0 dan katta summa kiriting");
    expect(texts.amountErrors.same).toBe("Yangi summa joriy summa bilan bir xil");
    expect(plain(texts.amountErrors.exceeds(7220000))).toBe("Ko'pi bilan 7 220 000 so'm");
    expect(texts.amountErrors.exceeds(null)).toBe("Summa chegaradan oshdi");
    expect(texts.diffText).toBeNull();
    expect(texts.reasonField("", false).placeholder).toBe("Nima uchun tahrirlayapsiz?");
    expect(texts.toast).toBeNull();
  });

  it("market, kamaydi 2 400 000 → 2 000 000: «Farq», izoh, tasdiq qatorlari, oqibatlar, eslatma, xabar", () => {
    const texts = uz().correct(market(), 2000000);
    expect(plain(texts.diffText)).toBe("−400 000 so'm");
    expect(plain(texts.diffLine)).toBe(
      "Asosiy kassaga 400 000 so'm qaytadi, Baraka Shopga berilishi kerak summa 400 000 so'mga ortadi",
    );
    expect(texts.confirm.title).toBe("Summani tahrirlashni tasdiqlang");
    expect(texts.confirm.description).toBe("#4498 · Market to'lovi · Baraka Shop");
    expect(plain(texts.confirm.rows)).toEqual({
      currentLabel: "Joriy summa",
      current: "2 400 000 so'm",
      nextLabel: "To'g'ri summa",
      next: "2 000 000 so'm",
      diffLabel: "Farq",
      diff: "−400 000 so'm",
      reasonLabel: "Sabab",
    });
    expect(plain(texts.confirm.consequences.map((item) => item.text))).toEqual([
      "Asosiy kassaga 400 000 so'm qaytadi — joriy smenaga",
      "Baraka Shopga berilishi kerak summa 400 000 so'mga ortadi; oxirgi to'langan buyurtmalar qayta hisoblanadi",
      "Asl yozuv o'chirilmaydi: teskari yozuv (+2 400 000 so'm) va yangi to'lov (−2 000 000 so'm) qo'shiladi",
      "Market egasiga xabar boradi: ilovada, Telegram ulangan bo'lsa unda ham. Sabab faqat ilovada ko'rinadi",
    ]);
    expect(texts.confirm.consequences.map((item) => item.icon.displayName)).toEqual(["Wallet", "Store", "History", "Bell"]);
    expect(plain(texts.confirm.note)).toBe("Kerak bo'lsa, yangi to'lovni 07.11.2026, 13:05 gacha yana tuzatish mumkin.");
    expect(texts.confirm).toMatchObject({ cancelLabel: "Orqaga", confirmLabel: "Tahrirlash", loadingLabel: "Saqlanmoqda…" });
    expect(plain(texts.toast)).toEqual({
      title: "Summa tuzatildi",
      description: "#4498: 2 400 000 → 2 000 000 so'm. Marketga xabar yuborildi.",
    });
  });

  it("market, oshdi: «+200 000 so'm», izoh va oqibatlar (maket «Summa oshirilsa»)", () => {
    const texts = uz().correct(market(), 2600000);
    expect(plain(texts.diffText)).toBe("+200 000 so'm");
    expect(plain(texts.diffLine)).toBe(
      "Asosiy kassadan yana 200 000 so'm chiqadi, Baraka Shopga berilishi kerak summa 200 000 so'mga kamayadi",
    );
    const big = uz().correct(market(), 20000000);
    expect(plain(big.confirm.consequences.map((item) => item.text)).slice(0, 3)).toEqual([
      "Asosiy kassadan yana 17 600 000 so'm chiqadi — joriy smenaga",
      "Baraka Shopga berilishi kerak summa 17 600 000 so'mga kamayadi; oxirgi to'langan buyurtmalar qayta hisoblanadi",
      "Asl yozuv o'chirilmaydi: teskari yozuv (+2 400 000 so'm) va yangi to'lov (−20 000 000 so'm) qo'shiladi",
    ]);
  });

  it("kuryer to'lovi 500 000 → 50 000 (maket): izoh, oqibatlar, xabar", () => {
    const texts = uz().correct(make({ ...courierTransfer, amount: 500000 }, { id: "4470", amount: 500000 }), 50000);
    expect(plain(texts.diffLine)).toBe("Jasur Tursunov kassasiga 450 000 so'm qaytadi, asosiy kassadan 450 000 so'm chiqadi");
    expect(plain(texts.confirm.consequences.map((item) => item.text))).toEqual([
      "Jasur Tursunov kassasiga 450 000 so'm qaytadi",
      "Asosiy kassadan 450 000 so'm naqd chiqadi",
      "Asl yozuv o'chirilmaydi: teskari yozuv (−500 000 so'm) va yangi to'lov (+50 000 so'm) qo'shiladi",
      "Kuryerga xabar boradi: ilovada, Telegram ulangan bo'lsa unda ham",
    ]);
    expect(plain(texts.toast?.description)).toBe("#4470: 500 000 → 50 000 so'm. Kuryerga xabar yuborildi.");
  });

  it("kuryer to'lovi oshdi (maket yo'q — taklif) va filial qabul qilgan", () => {
    const up = uz().correct(make({ ...courierTransfer, amount: 500000 }, { amount: 500000 }), 600000);
    expect(plain(up.diffLine)).toBe("Jasur Tursunov kassasidan yana 100 000 so'm chiqadi, asosiy kassaga 100 000 so'm kiradi");
    const branch = uz().correct(
      make({ ...courierTransfer, amount: 500000, receiver: { cashbox_type: "branch", branch_id: "15", name: "Urgut filiali" } }, { amount: 500000 }),
      400000,
    );
    expect(plain(branch.diffLine)).toBe("Jasur Tursunov kassasiga 100 000 so'm qaytadi, Urgut filiali kassasidan 100 000 so'm chiqadi");
    expect(plain(branch.confirm.consequences.map((item) => item.text))[1]).toBe("Urgut filiali kassasidan 100 000 so'm chiqadi");
  });

  it("`transfer` yo'q: «Farq» bor, izoh yo'q; oqibatlar umumiy", () => {
    const texts = uz().correct(make(undefined, { title: "Kuryer to'lovi" }), 1500000);
    expect(plain(texts.diffText)).toBe("−350 000 so'm");
    expect(texts.diffLine).toBeNull();
    expect(texts.confirm.consequences.map((item) => item.icon.displayName)).toEqual(["History", "Bell"]);
    expect(plain(texts.toast?.description)).toBe("#4512: 1 850 000 → 1 500 000 so'm.");
  });
});

describe("tafsilot pastki qismi: muddat izohi va qulf", () => {
  it("muddat: «Qaytarish yoki tahrirlash mumkin: 07.11.2026, 14:32 gacha · muddat 30 kun»; zanjir davomi", () => {
    const texts = uz();
    const hint = texts.deadlineHint({
      kind: "actions",
      deadline: "2026-11-07T09:32:00.000Z",
      windowDays: 30,
      rootHistoryId: "4512",
      chained: false,
    });
    expect(plain(hint)).toEqual({
      lead: "Qaytarish yoki tahrirlash mumkin:",
      until: "07.11.2026, 14:32 gacha",
      window: "muddat 30 kun",
    });
    expect(hint.until).toBe("07.11.2026,\u00a014:32\u00a0gacha");
    const chained = texts.deadlineHint({
      kind: "actions",
      deadline: "2026-11-07T08:05:00.000Z",
      windowDays: 30,
      rootHistoryId: "4498",
      chained: true,
    });
    expect(plain(chained.window)).toBe("muddat birinchi to'lovdan (#4498)");
    expect(texts.actions).toEqual({ reverse: "Qaytarish", correct: "Summani tahrirlash" });
  });

  it("qulf: muddat tugagan (+ «Muddatni o'zgartirish»), eski yozuv, kuryer ko'chgan (ega qarori), teskari yozuv, kassa o'chirilgan", () => {
    const texts = uz();
    expect(
      plain(texts.lock({ allowed: false, code: "WINDOW_EXPIRED", deadline: "2026-10-02T12:30:00.000Z", window_days: 30, root_history_id: null })),
    ).toEqual({
      title: "Muddat tugagan: 02.10.2026, 17:30",
      body: "To'lovni 30 kun ichida qaytarish yoki summasini tahrirlash mumkin edi.",
      changeWindow: "Muddatni o'zgartirish",
    });
    expect(texts.lock({ allowed: false, code: "LEGACY_UNLINKED", deadline: null, window_days: 30, root_history_id: null })).toEqual({
      title: "Eski yozuv",
      body: "Bu to'lov tuzatish imkoniyati qo'shilishidan oldin yozilgan va kassalardagi juft yozuvlari aniqlanmagan — uni qaytarib ham, tahrirlab ham bo'lmaydi.",
      changeWindow: null,
    });
    expect(texts.lock({ allowed: false, code: "COURIER_MOVED", deadline: null, window_days: 30, root_history_id: null })).toEqual({
      title: null,
      body: "Tuzatib bo'lmaydi — kuryer boshqa filialga o'tgan.",
      changeWindow: null,
    });
    const notCorrectable = (reason: "reversal_row" | "cashbox_deleted" | "unsupported_type", kind?: string) =>
      texts.lock({
        allowed: false,
        code: "NOT_CORRECTABLE",
        reason,
        deadline: null,
        window_days: 30,
        root_history_id: null,
        transfer: kind
          ? { kind: kind as "market_payment", payment_method: "cash", amount: 1, receiver: { cashbox_type: "main", branch_id: null, name: null }, courier: null, market: null }
          : null,
      })?.body;
    expect(notCorrectable("reversal_row")).toBe("Teskari yozuvni qaytarib ham, tahrirlab ham bo'lmaydi.");
    expect(notCorrectable("cashbox_deleted", "courier_payment")).toBe("Kuryer kassasi o'chirilgan.");
    expect(notCorrectable("cashbox_deleted", "market_payment")).toBe("Market kassasi o'chirilgan.");
    expect(notCorrectable("cashbox_deleted")).toBe("Kassa o'chirilgan.");
    expect(notCorrectable("unsupported_type")).toBe("To'lovning kassalardagi yozuvlari to'liq emas.");
    expect(texts.lock({ allowed: false, code: "ALREADY_CORRECTED", deadline: null, window_days: 30, root_history_id: null })).toBeNull();
  });
});

describe("ru / en", () => {
  beforeAll(async () => {
    await i18n.loadLanguages(["ru", "en"]);
    await i18n.loadNamespaces("payments");
  });

  it("ru: izoh, ko'plik (1 / 3 / 5 kun), xabar", () => {
    const ru = createCorrectionTexts(i18n.getFixedT("ru", "payments"), "ru");
    const texts = ru.reverse(make(courierTransfer));
    expect(texts.note).toBe(
      "Деньги вернутся обратно: из основной кассы в кассу курьера Jasur Tursunov. Исходная запись не удаляется — добавляется сторно.",
    );
    expect(plain(texts.toast)).toEqual({ title: "Платёж отменён", description: "1 850 000 сум вернулось в кассу курьера Jasur Tursunov. Курьер уведомлён." });
    const windowOf = (count: number) =>
      ru.deadlineHint({ kind: "actions", deadline: null, windowDays: count, rootHistoryId: null, chained: false }).window;
    expect([windowOf(1), windowOf(3), windowOf(5)]).toEqual(["срок 1 день", "срок 3 дня", "срок 5 дней"]);
  });

  it("en: umumiy so'z (nomsiz) va ko'plik", () => {
    const en = createCorrectionTexts(i18n.getFixedT("en", "payments"), "en");
    const texts = en.reverse(make({ ...courierTransfer, courier: { id: "301", name: null } }));
    expect(texts.note).toBe(
      "The money goes back the other way: from the main cashbox to the cashbox of the courier. The original entry is kept — a reversal entry is added.",
    );
    const windowOf = (count: number) =>
      en.deadlineHint({ kind: "actions", deadline: null, windowDays: count, rootHistoryId: null, chained: false }).window;
    expect([windowOf(1), windowOf(30)]).toEqual(["window 1 day", "window 30 days"]);
  });
});
