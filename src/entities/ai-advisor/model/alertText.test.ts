import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import { createAdvisorFixtures } from "../../../test/aiAdvisorFixtures";
import type { AiAdvisorAlertListItem } from "./advisorTypes";
import {
  addAdvisorDays,
  advisorCashboxName,
  advisorDayOf,
  advisorDaysBetween,
  advisorIsoWeekday,
  advisorUserName,
  AI_ADVISOR_R8_BASELINE_DAYS,
  alertDialogTitle,
  alertHeadlineAmount,
  alertInlineName,
  alertListTitle,
  alertShortLabel,
  alertShortName,
  alertSubline,
  correctionsBaselineDays,
  formatAdvisorDayRange,
  formatAdvisorDayRelative,
  formatAdvisorWeekRange,
  ruleConditionText,
  ruleName,
  subjectName,
} from "./alertText";
import { AI_ADVISOR_RULE_KEYS } from "./advisorTypes";
import { THRESHOLD_FIELDS } from "./advisorRules";

/**
 * Ogohlantirish matnlari — maket matnlari aynan (`superadmin-ai-assistant-alerts`, `-alert-dialog*`,
 * `-alert-resolve-confirm`, `-settings-rules-dialog`), ru/en — to'liq tarjima (kalit yoki `{{…}}` qolmaydi).
 * «Bugun» — 23.10.2026, juma (maketdagidek): o'tgan hafta 12–18 oktabr.
 */

type T = (key: string, options?: Record<string, unknown>) => string;
const t = (lng: string) => i18n.getFixedT(lng, "aiAdvisor") as unknown as T;

const fx = createAdvisorFixtures(new Date(2026, 9, 23, 15, 0));
const LANGS = ["uz", "ru", "en"] as const;

/**
 * Barcha variantlar: ro'yxatdagi 8 ta + tafsilot variantlari (R2 muddat, R6 hafta, R7 karta) + backend dev holatlari
 * (R7 valyuta / o'tkazma / faqat karta, R8 baza 0, R3 mediana 0, nomsiz market).
 */
const variants: AiAdvisorAlertListItem[] = [
  ...fx.items,
  fx.detail.r2NoHandover,
  fx.detail.r6Week,
  fx.detail.r7Card,
  fx.detail.r7Currency,
  fx.detail.r7Transfer,
  fx.detail.r7CardOnly,
  fx.detail.r8NoBaseline,
  fx.detail.r3NoRatio,
  fx.detail.r4Nameless,
];

beforeAll(async () => {
  await i18n.loadLanguages(["ru", "en"]);
  await i18n.loadNamespaces("aiAdvisor");
});

describe("ro'yxat sarlavhasi va ost-qatori (maket superadmin-ai-assistant-alerts)", () => {
  it("8 qator — maketdagi matnlar aynan", () => {
    const uz = t("uz");
    expect(fx.items.map((alert) => [alertListTitle(alert, uz, "uz"), alertSubline(alert, uz)])).toEqual([
      ["Jasur Tursunov kassasida 2 840 000 so'm — 4 kundan beri topshirilmagan", "Kuryer qarzi o'smoqda · Toshkent HQ"],
      ["Samarqand filiali kassasida 3 smena ketma-ket kamomad: −445 000 so'm", "Smena kamomadi · Samarqand filiali"],
      ["Chekda farq bor — Urgut filiali yoqilg'i xarajati, karta mos emas", "Chek yoki karta farqi · Urgut filiali"],
      ["Farg'ona filiali: yoqilg'i xarajati 1 450 000 so'm — odatdagidan 3,4 barobar", "G'ayrioddiy xarajat · Farg'ona filiali"],
      ["Nur Elektronika — 9 kundan beri to'lov yo'q, qarz 3 120 000 so'm", "Market to'lovi kechikmoqda"],
      ["Urgut filiali kassasida 6 400 000 so'm — HQ'ga 4 kundan beri o'tkazma yo'q", "HQ'ga o'tkazma kechikmoqda · Urgut filiali"],
      ["20.10 kuni sof foyda −380 000 so'm", "Zarar · butun tizim"],
      ["12–18 oktabr haftasida 14 ta tuzatish — 30 kunlik o'rtachadan 2,3 barobar", "Tuzatishlar ko'paydi"],
    ]);
  });

  it("R2 faqat muddat sharti, R6 hafta, R7 karta qoldig'i", () => {
    const uz = t("uz");
    expect(alertListTitle(fx.detail.r2NoHandover, uz, "uz")).toBe("Farhod Ismoilov kassasida 860 000 so'm — 5 kundan beri topshirilmagan");
    expect(alertSubline(fx.detail.r2NoHandover, uz)).toBe("Kuryer qarzi o'smoqda · Samarqand filiali");
    expect(alertListTitle(fx.detail.r6Week, uz, "uz")).toBe("12–18 oktabr haftasida sof foyda −1 150 000 so'm");
    expect(alertListTitle(fx.detail.r7Card, uz, "uz")).toBe("Karta qoldig'ida farq — Asosiy kassa");
    expect(alertSubline(fx.detail.r7Card, uz)).toBe("Chek yoki karta farqi · Asosiy kassa");
  });

  it("R1 bitta smena, R2 o'sish, R2 hech topshirmagan, R7 faqat karta, filialsiz kassa — «Asosiy kassada»", () => {
    const uz = t("uz");
    const r1 = fx.byRule.R1;
    const single = {
      ...r1,
      branch: null,
      facts: { ...(r1.facts as object), trigger: "single_shortage", branch: null, cashbox: { type: "main", owner_id: "0", name: "Asosiy kassa" } },
    } as AiAdvisorAlertListItem;
    expect(alertListTitle(single, uz, "uz")).toBe("Asosiy kassada smena kamomadi: −240 000 so'm");
    expect(alertDialogTitle(single, uz, "uz")).toBe("Asosiy kassada smena kamomadi");

    const r2 = fx.byRule.R2;
    const growth = { ...r2, facts: { ...(r2.facts as object), trigger: "growth" } } as AiAdvisorAlertListItem;
    expect(alertListTitle(growth, uz, "uz")).toBe("Jasur Tursunov kassasida 2 840 000 so'm — 4 kun ketma-ket o'smoqda");
    const never = { ...r2, facts: { ...(r2.facts as object), trigger: "no_handover", days_without_handover: null } } as AiAdvisorAlertListItem;
    expect(alertListTitle(never, uz, "uz")).toBe("Jasur Tursunov kassasida 2 840 000 so'm topshirilmagan");

    const r7 = fx.byRule.R7;
    const cardOnly = { ...r7, facts: { ...(r7.facts as object), mismatch: ["card"] } } as AiAdvisorAlertListItem;
    expect(alertListTitle(cardOnly, uz, "uz")).toBe("Karta mos emas — Urgut filiali yoqilg'i xarajati");
    const amountOnly = { ...r7, facts: { ...(r7.facts as object), mismatch: ["amount"] } } as AiAdvisorAlertListItem;
    expect(alertListTitle(amountOnly, uz, "uz")).toBe("Chekda farq bor — Urgut filiali yoqilg'i xarajati");
  });
});

describe("oyna sarlavhasi (maket -alert-dialog*)", () => {
  it("har qoida — maketdagi sarlavha", () => {
    const uz = t("uz");
    const title = (alert: AiAdvisorAlertListItem) => alertDialogTitle(alert, uz, "uz");
    expect(title(fx.detail.r1)).toBe("Samarqand filiali kassasida 3 smena ketma-ket kamomad");
    expect(title(fx.detail.r2)).toBe("Jasur Tursunov kassasida 2 840 000 so'm topshirilmagan");
    expect(title(fx.detail.r2NoHandover)).toBe("Farhod Ismoilov kassasida 860 000 so'm — 5 kundan beri topshirilmagan");
    expect(title(fx.detail.r3)).toBe("Farg'ona filiali: yoqilg'i xarajati odatdagidan 3,4 barobar ko'p");
    expect(title(fx.detail.r4)).toBe("Nur Elektronika — 9 kundan beri to'lov yo'q");
    expect(title(fx.detail.r5)).toBe("Urgut filiali 4 kundan beri HQ'ga pul o'tkazmagan");
    expect(title(fx.detail.r6)).toBe("20.10.2026 kuni zarar: sof foyda −380 000 so'm");
    expect(title(fx.detail.r6Week)).toBe("12–18 oktabr haftasida zarar: sof foyda −1 150 000 so'm");
    expect(title(fx.detail.r7)).toBe("Chekda farq bor — Urgut filiali yoqilg'i xarajati");
    expect(title(fx.detail.r7Card)).toBe("Karta qoldig'ida farq — Asosiy kassa");
    expect(title(fx.detail.r8)).toBe("12–18 oktabr haftasida 14 ta tuzatish — odatdagidan 2,3 barobar ko'p");
  });
});

describe("backend dev holatlari (shartnoma v0.4 eslatmalari, #653 review, round-3)", () => {
  const uz = t("uz");

  it("R7 chek so'mda emas — «Chek so'mda emas — …», summa yo'q", () => {
    expect(alertListTitle(fx.detail.r7Currency, uz, "uz")).toBe("Chek so'mda emas — Urgut filiali yoqilg'i xarajati");
    expect(alertDialogTitle(fx.detail.r7Currency, uz, "uz")).toBe("Chek so'mda emas — Urgut filiali yoqilg'i xarajati");
    const withCard = {
      ...fx.detail.r7Currency,
      facts: { ...(fx.detail.r7Currency.facts as object), mismatch: ["currency", "card"] },
    } as unknown as AiAdvisorAlertListItem;
    expect(alertListTitle(withCard, uz, "uz")).toBe("Chek so'mda emas — Urgut filiali yoqilg'i xarajati, karta mos emas");
  });

  it("R7 o'tkazma cheki: karta farqi — «Pul HQ kartasiga tushmagan» (chek turi — `operation.kind` / `receipt_kind`)", () => {
    expect(alertListTitle(fx.detail.r7Transfer, uz, "uz")).toBe("Pul HQ kartasiga tushmagan — Samarqand filiali kuryer topshirig'i");
    const withAmount = {
      ...fx.detail.r7Transfer,
      facts: { ...(fx.detail.r7Transfer.facts as object), mismatch: ["amount", "card"] },
    } as unknown as AiAdvisorAlertListItem;
    expect(alertListTitle(withAmount, uz, "uz")).toBe(
      "Chekda farq bor — Samarqand filiali kuryer topshirig'i, pul HQ kartasiga tushmagan",
    );
    // `operation` yo'q — chek turi `receipt_kind` dan.
    const noOperation = {
      ...fx.detail.r7Transfer,
      facts: { ...(fx.detail.r7Transfer.facts as object), operation: null, receipt_kind: "branch_to_hq" },
    } as unknown as AiAdvisorAlertListItem;
    expect(alertListTitle(noOperation, uz, "uz")).toBe("Pul HQ kartasiga tushmagan — Samarqand filiali HQ'ga o'tkazma");
  });

  it("R8 baza 0 (`ratio: null`) — «oldingi 30 kunda tuzatish bo'lmagan», fakt tashlanmaydi", () => {
    expect(alertListTitle(fx.detail.r8NoBaseline, uz, "uz")).toBe(
      "12–18 oktabr haftasida 4 ta tuzatish — oldingi 30 kunda tuzatish bo'lmagan",
    );
    expect(alertDialogTitle(fx.detail.r8NoBaseline, uz, "uz")).toBe(
      "12–18 oktabr haftasida 4 ta tuzatish — oldingi 30 kunda tuzatish bo'lmagan",
    );
    // Oyna sarlavhasi va «Nisbat» fakti — bitta manba (`evidence.baseline.window_days`); ro'yxatda — backend sukuti.
    const r8 = fx.detail.r8NoBaseline;
    const evidence = r8.evidence as Extract<NonNullable<typeof r8.evidence>, { kind: "corrections" }>;
    const window28 = { ...r8, evidence: { ...evidence, baseline: { ...evidence.baseline, window_days: 28 } } };
    expect(correctionsBaselineDays(window28)).toBe(28);
    expect(correctionsBaselineDays(fx.byRule.R8)).toBe(AI_ADVISOR_R8_BASELINE_DAYS);
    expect(alertDialogTitle(window28, uz, "uz")).toBe("12–18 oktabr haftasida 4 ta tuzatish — oldingi 28 kunda tuzatish bo'lmagan");
    expect(alertDialogTitle(window28, t("ru"), "ru")).toMatch(/ — за предыдущие 28 дней исправлений не было$/);
    expect(alertDialogTitle(window28, t("en"), "en")).toMatch(/ — no corrections in the previous 28 days$/);
  });

  it("R3 mediana 0 (`ratio_to_median: null`) — «odatdagidan ko'p», sonsiz", () => {
    expect(alertListTitle(fx.detail.r3NoRatio, uz, "uz")).toBe("Farg'ona filiali: yoqilg'i xarajati 1 450 000 so'm — odatdagidan ko'p");
    expect(alertDialogTitle(fx.detail.r3NoRatio, uz, "uz")).toBe("Farg'ona filiali: yoqilg'i xarajati odatdagidan ko'p");
  });

  it("R1: «N smena ketma-ket» — uzluksiz qator (`streak_*`), jami fakt-smenalar emas", () => {
    const merged = {
      ...fx.byRule.R1,
      facts: { ...(fx.byRule.R1.facts as object), shifts_count: 4, total_difference: -545_000, streak_length: 3, streak_total: -445_000 },
    } as AiAdvisorAlertListItem;
    expect(alertListTitle(merged, uz, "uz")).toBe("Samarqand filiali kassasida 3 smena ketma-ket kamomad: −445 000 so'm");
  });

  it("ism olinmagan (`name: null`) — «#id»; nomsiz asosiy kassa — «Asosiy kassa»", () => {
    expect(alertListTitle(fx.detail.r4Nameless, uz, "uz")).toBe("#55 — 9 kundan beri to'lov yo'q, qarz 3 120 000 so'm");
    expect(subjectName(fx.detail.r4Nameless, uz)).toBe("#55");
    expect(alertShortLabel(fx.detail.r4Nameless, uz)).toBe("#55 · market to'lovi kechikmoqda");
    expect(advisorCashboxName({ type: "main", owner_id: "0", name: null }, uz)).toBe("Asosiy kassa");
    expect(advisorCashboxName({ type: "branch", owner_id: "7", name: null }, uz)).toBe("#7");
    expect(advisorCashboxName({ type: "couriers", owner_id: "377", name: " Jasur Tursunov " }, uz)).toBe("Jasur Tursunov");
    const r5 = fx.byRule.R5;
    const namelessBranch = {
      ...r5,
      branch: { id: "12", name: null },
      facts: { ...(r5.facts as object), branch: { id: "12", name: null } },
    } as AiAdvisorAlertListItem;
    expect(alertListTitle(namelessBranch, uz, "uz")).toBe("#12 kassasida 6 400 000 so'm — HQ'ga 4 kundan beri o'tkazma yo'q");
    expect(alertSubline(namelessBranch, uz)).toBe("HQ'ga o'tkazma kechikmoqda · #12");
  });

  it("nomi olinmagan filial kassasi (backend shakli) — «#7 kassasida», «#7da» emas", () => {
    const r1 = fx.byRule.R1;
    const namelessR1 = {
      ...r1,
      branch: { id: "7", name: null },
      facts: { ...(r1.facts as object), branch: { id: "7", name: null }, cashbox: { type: "branch", owner_id: "7", name: null } },
    } as AiAdvisorAlertListItem;
    expect(alertListTitle(namelessR1, uz, "uz")).toBe("#7 kassasida 3 smena ketma-ket kamomad: −445 000 so'm");
    expect(alertDialogTitle(namelessR1, uz, "uz")).toBe("#7 kassasida 3 smena ketma-ket kamomad");
    expect(alertListTitle(namelessR1, t("ru"), "ru")).toContain("в кассе «#7»");
  });

  it("asosiy kassa: server nomi o'zbekcha («Asosiy kassa») — ru/en da tarjima", () => {
    const ru = t("ru");
    const en = t("en");
    expect(advisorCashboxName({ type: "main", owner_id: "0", name: "Asosiy kassa" }, ru)).toBe("Основная касса");
    expect(advisorCashboxName({ type: "main", owner_id: "0", name: "Asosiy kassa" }, en)).toBe("Main cash desk");
    const main = { id: "1", branch: null, subject: { kind: "cashbox" as const, id: "0", name: "Asosiy kassa" } };
    expect(subjectName(main, ru)).toBe("Основная касса");
    expect(subjectName(main, uz)).toBe("Asosiy kassa");
    // Filial kassasi — server nomi o'zgarmaydi (filial nomi ustun).
    expect(subjectName({ id: "1", branch: null, subject: { kind: "cashbox", id: "7", name: "Samarqand filiali kassasi" } }, ru)).toBe(
      "Samarqand filiali kassasi",
    );
    // Noma'lum qoida — ost-qatordagi joy ham.
    const unknown = { ...fx.byRule.R1, rule_key: "R9", facts: null, title: "Server", branch: null, subject: main.subject } as AiAdvisorAlertListItem;
    expect(alertSubline(unknown, ru)).toBe(`${ruleName("R9", ru)} · Основная касса`);
  });

  it("tasdiqdagi summa: R7 summa farqisiz (karta / valyuta) — `null` («0 so'm» emas)", () => {
    expect(alertHeadlineAmount(fx.detail.r7Transfer)).toBeNull();
    expect(alertHeadlineAmount(fx.detail.r7CardOnly)).toBeNull();
    expect(alertHeadlineAmount(fx.detail.r7Currency)).toBeNull();
    expect(alertHeadlineAmount(fx.detail.r7)).toBe(-18_000);
    expect(alertHeadlineAmount(fx.detail.r7Card)).toBe(-40_000);
    expect(alertHeadlineAmount(fx.detail.r1)).toBe(-445_000);
    expect(alertHeadlineAmount(fx.detail.r8)).toBeNull();
  });
});

describe("qisqa yorliq (toast, «Hal qilindi» tasdig'i) va nomlar", () => {
  it("«Samarqand filiali · smena kamomadi», «Farg'ona filiali · g'ayrioddiy xarajat», tizim — «Butun tizim · zarar»", () => {
    const uz = t("uz");
    expect(alertShortLabel(fx.byRule.R1, uz)).toBe("Samarqand filiali · smena kamomadi");
    expect(alertShortLabel(fx.byRule.R3, uz)).toBe("Farg'ona filiali · g'ayrioddiy xarajat");
    expect(alertShortLabel(fx.byRule.R6, uz)).toBe("Butun tizim · zarar");
    expect(alertShortLabel(fx.byRule.R4, uz)).toBe("Nur Elektronika · market to'lovi kechikmoqda");
    expect(alertShortLabel(fx.detail.r7Card, uz)).toBe("Asosiy kassa · karta qoldig'ida farq");
  });

  it("R7 qisqa nomi variant bo'yicha (§9.3), qolganlari — qoida nomi", () => {
    const uz = t("uz");
    expect(alertShortName(fx.byRule.R7, uz)).toBe("Chekda farq bor");
    expect(alertShortName(fx.detail.r7Card, uz)).toBe("Karta qoldig'ida farq");
    expect(alertShortName(fx.byRule.R2, uz)).toBe("Kuryer qarzi o'smoqda");
    expect(alertInlineName(fx.byRule.R2, uz)).toBe("kuryer qarzi o'smoqda");
  });

  it("nomsiz odam va obyekt — «#id»; tizim — tarjima", () => {
    expect(advisorUserName({ id: "5", name: null })).toBe("#5");
    expect(advisorUserName({ id: "5", name: "  " })).toBe("#5");
    expect(subjectName({ id: "1", branch: null, subject: { kind: "market", id: "55", name: "" } }, t("uz"))).toBe("#55");
    expect(subjectName({ id: "1", branch: null, subject: { kind: "system", id: null, name: "Butun tizim" } }, t("ru"))).toBe("Вся система");
  });

  it("noma'lum qoida — server sarlavhasi, «Boshqa qoida»", () => {
    const uz = t("uz");
    const unknown: AiAdvisorAlertListItem = { ...fx.byRule.R1, rule_key: "R9", facts: null, title: "Server sarlavhasi" };
    expect(alertListTitle(unknown, uz, "uz")).toBe("Server sarlavhasi");
    expect(alertDialogTitle(unknown, uz, "uz")).toBe("Server sarlavhasi");
    expect(alertSubline(unknown, uz)).toBe("Boshqa qoida · Samarqand filiali");
    expect(alertShortName(unknown, uz)).toBe("Boshqa qoida");
    expect(ruleName("R9", uz)).toBe("Boshqa qoida");
    expect(ruleConditionText({ key: "R9", thresholds: {} }, uz, "uz")).toBeNull();
  });
});

describe("qoida sharti (oynadagi «Qoida» qatori)", () => {
  it("ochilgan paytdagi chegaralar bilan — maket matnlari", () => {
    const uz = t("uz");
    const ids: Record<string, string> = { R1: "1040", R2: "1041", R3: "1036", R4: "1034", R5: "1033", R6: "1031", R7: "1039", R8: "1029" };
    const condition = (key: string) => ruleConditionText(fx.details[ids[key]].rule, uz, "uz");
    expect(condition("R1")).toBe("Bir smenada 50 000 so'mdan ko'p yoki 3 smena ketma-ket kamomad");
    expect(condition("R2")).toBe("3 kun ketma-ket o'sib 2 000 000 so'mdan oshsa yoki 3 kundan ortiq topshirilmasa");
    expect(condition("R3")).toBe("30 kunlik mediana + 3 × mediana og'ishidan ko'p");
    expect(condition("R4")).toBe("7 kundan ortiq to'lov yo'q va qarz bor");
    expect(condition("R5")).toBe("5 000 000 so'mdan ko'p va 3 kundan ortiq o'tkazma yo'q");
    expect(condition("R6")).toBe("Kunlik yoki haftalik sof foyda 0 dan past");
    expect(condition("R7")).toBe("Smena karta tekshiruvi yoki chek AI tekshiruvida «Farq bor»");
    expect(condition("R8")).toBe("30 kunlik o'rtachadan 2 barobar va undan ko'p");
  });

  it("boshqa chegara va kasr ko'paytuvchi; chegara yo'q — #644 sukuti", () => {
    const uz = t("uz");
    expect(ruleConditionText({ key: "R1", thresholds: { shortage_uzs: 30_000, consecutive_negative: 2 } }, uz, "uz")).toBe(
      "Bir smenada 30 000 so'mdan ko'p yoki 2 smena ketma-ket kamomad",
    );
    expect(ruleConditionText({ key: "R3", thresholds: { mad_multiplier: 2.5 } }, uz, "uz")).toBe(
      "30 kunlik mediana + 2,5 × mediana og'ishidan ko'p",
    );
    expect(ruleConditionText({ key: "R4", thresholds: {} }, uz, "uz")).toBe("7 kundan ortiq to'lov yo'q va qarz bor");
  });
});

describe("hafta oralig'i", () => {
  it("bir oy / ikki oy — uz, ru, en", () => {
    expect(formatAdvisorWeekRange("2026-10-12", "2026-10-18", t("uz"))).toBe("12–18 oktabr");
    expect(formatAdvisorWeekRange("2026-09-28", "2026-10-04", t("uz"))).toBe("28 sentyabr – 4 oktabr");
    expect(formatAdvisorWeekRange("2026-10-12", "2026-10-18", t("ru"))).toBe("12–18 октября");
    expect(formatAdvisorWeekRange("2026-09-28", "2026-10-04", t("en"))).toBe("September 28 – October 4");
  });
});

describe("kun yordamchilari (dalil qatorlari, R4 oraliq, R6 hafta kuni)", () => {
  it("davr: bir oy, oy almashsa, yil almashsa, bitta kun", () => {
    expect(formatAdvisorDayRange("2026-10-12", "2026-10-18")).toBe("12–18.10.2026");
    expect(formatAdvisorDayRange("2026-09-28", "2026-10-04")).toBe("28.09–04.10.2026");
    expect(formatAdvisorDayRange("2025-12-29", "2026-01-04")).toBe("29.12.2025 – 04.01.2026");
    expect(formatAdvisorDayRange("2026-10-20", "2026-10-20")).toBe("20.10.2026");
  });

  it("kun qo'shish / farq — oy va yil chegarasi, yaroqsiz qiymat", () => {
    expect(addAdvisorDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(addAdvisorDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addAdvisorDays("yo'q", 1)).toBe("yo'q");
    expect(advisorDaysBetween("2026-10-09", "2026-10-13")).toBe(4);
    expect(advisorDaysBetween("2026-10-13", "2026-10-09")).toBe(-4);
    expect(advisorDaysBetween("2026-10-13", "")).toBeNull();
  });

  it("hafta kuni (dushanba — 1) va lahzaning Toshkent kuni", () => {
    expect(advisorIsoWeekday("2026-10-20")).toBe(2);
    expect(advisorIsoWeekday("2026-10-18")).toBe(7);
    expect(advisorIsoWeekday("")).toBeNull();
    // 19:30 UTC = ertasi kun 00:30 Toshkent vaqti.
    expect(advisorDayOf("2026-10-19T19:30:00Z")).toBe("2026-10-20");
    expect(advisorDayOf(null)).toBeNull();
  });

  it("nisbiy kun: «Bugun» / «Kecha» / sana (uz, ru, en)", () => {
    const now = new Date(2026, 9, 23, 15, 0);
    expect(formatAdvisorDayRelative("2026-10-23", "uz", now)).toBe("Bugun");
    expect(formatAdvisorDayRelative("2026-10-22", "uz", now)).toBe("Kecha");
    expect(formatAdvisorDayRelative("2026-10-22", "ru", now)).toBe("Вчера");
    expect(formatAdvisorDayRelative("2026-10-21", "en", now)).toBe("21.10.2026");
  });
});

describe("ru / en — to'liq tarjima", () => {
  const leftovers = /rules\.|alerts\.|\{\{|undefined|NaN/;

  it("har variant: sarlavha, ost-qator, qisqa yorliq, shart — kalitsiz va o'zbekchadan farqli", () => {
    for (const lng of LANGS) {
      const tr = t(lng);
      for (const alert of variants) {
        const texts = [
          alertListTitle(alert, tr, lng),
          alertDialogTitle(alert, tr, lng),
          alertSubline(alert, tr),
          alertShortLabel(alert, tr),
          alertShortName(alert, tr),
        ];
        for (const text of texts) expect(text, `${lng} ${alert.id}`).not.toMatch(leftovers);
        // Backend o'zbekcha to'ldiradigan nomlar (asosiy kassa, butun tizim) — tarjimadan.
        if (lng !== "uz") for (const text of texts) expect(text, `${lng} ${alert.id}`).not.toMatch(/Asosiy kassa|Butun tizim/);
        if (lng !== "uz") {
          const uz = t("uz");
          expect(alertListTitle(alert, tr, lng), `${lng} ${alert.id}`).not.toBe(alertListTitle(alert, uz, "uz"));
          expect(alertSubline(alert, tr)).not.toBe(alertSubline(alert, uz));
        }
      }
      for (const key of AI_ADVISOR_RULE_KEYS) {
        expect(ruleConditionText({ key, thresholds: {} }, tr, lng), `${lng} ${key}`).not.toMatch(leftovers);
        expect(ruleName(key, tr)).not.toMatch(leftovers);
        expect(tr(`rules.${key}.description`, { ratio: "2" })).not.toMatch(leftovers);
        for (const spec of THRESHOLD_FIELDS[key]) {
          expect(tr(spec.labelKey), `${lng} ${spec.labelKey}`).not.toMatch(leftovers);
          if (spec.hintKey) expect(tr(spec.hintKey, { value: "3" })).not.toMatch(leftovers);
        }
      }
      for (const key of ["critical", "warning"]) expect(tr(`alerts.severity.${key}`)).not.toMatch(leftovers);
      for (const key of ["new", "seen", "resolved", "dismissed"]) expect(tr(`alerts.status.${key}`)).not.toMatch(leftovers);
    }
  });

  it("ruscha ko'plik: 1 смена / 3 смены / 5 смен, 4 дня / 9 дней; inglizcha 1 day / 3 shifts", () => {
    const ru = t("ru");
    const r1 = fx.byRule.R1;
    // «N smena ketma-ket» — uzluksiz qator (`streak_length`), jami fakt-smenalar (`shifts_count`) bilan bir xil.
    const withShifts = (n: number) =>
      ({ ...r1, facts: { ...(r1.facts as object), shifts_count: n, streak_length: n } }) as AiAdvisorAlertListItem;
    expect(alertListTitle(withShifts(3), ru, "ru")).toBe("Недостача 3 смены подряд в кассе «Samarqand filiali»: −445 000 сум");
    expect(alertListTitle(withShifts(5), ru, "ru")).toContain("5 смен подряд");
    expect(alertListTitle(fx.byRule.R2, ru, "ru")).toBe("У Jasur Tursunov в кассе 2 840 000 сум — не сдаёт 4 дня");
    expect(alertListTitle(fx.byRule.R4, ru, "ru")).toContain("без выплаты 9 дней");
    expect(ruleConditionText({ key: "R4", thresholds: { days_without_payout: 21 } }, ru, "ru")).toBe(
      "Нет выплаты более 21 дня и есть долг",
    );
    const en = t("en");
    expect(alertListTitle(withShifts(3), en, "en")).toBe("3 shifts in a row short at Samarqand filiali cash desk: −445,000 UZS");
    expect(ruleConditionText({ key: "R4", thresholds: { days_without_payout: 1 } }, en, "en")).toBe(
      "No payout for more than 1 day and money is owed",
    );
  });
});
