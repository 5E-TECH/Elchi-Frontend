import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  advisorIsoWeekday,
  formatAdvisorDay,
  formatAdvisorDayMonth,
  formatAdvisorDayRange,
  formatAdvisorDayRelative,
  type AiAdvisorAlertDetail,
  type AiAdvisorEvidenceCorrections,
  type AiAdvisorEvidenceExpenseStats,
  type AiAdvisorEvidenceMarketDebtDays,
  type AiAdvisorEvidenceProfitDays,
  type AiAdvisorFactsR2,
  type AiAdvisorFactsR3,
  type AiAdvisorFactsR5,
  type AiAdvisorFactsR6,
  type AiAdvisorFactsR8,
} from "../../../../../entities/ai-advisor";
import i18n from "../../../../../i18n";
import { formatDateTimeLocalized } from "../../../../../shared/lib/formatDateTime";
import { createAdvisorFixtures } from "../../../../../test/aiAdvisorFixtures";
import { renderWithProviders } from "../../../../../test/test-utils";
import { renderRuleBody } from "./index";
import { countedCorrectionKinds, deriveMarketPayouts, lossComparisonDays, thresholdMeterMax } from "./ruleData";

/**
 * Qoida tanalari R2–R6, R8 (maketlar `superadmin-ai-assistant-alert-dialog-courier-debt`, `-expense`,
 * `-market-payout`, `-hq-transfer`, `-loss`, `-corrections`; shartnoma v0.3 §5.3–5.4): faktlar, chegara o'lchagichi,
 * dalil jadvali («Jami» qatori, havolalar), telefon kartalari, trigger variantlari (R2 faqat muddat / faqat o'sish, R3
 * `scope: category`, R6 hafta). Shartnomada yo'q maydonlar (v0.4) chizilmaydi — ustun va qatorlar yo'qligi tekshiriladi.
 */

const fx = createAdvisorFixtures();
const at = (iso: string) => formatDateTimeLocalized(iso, { language: "uz" });
const UZ_WEEKDAYS = ["", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba", "yakshanba"];

const PHONE_QUERY = "(max-width: 767px)";
const usePhoneViewport = () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === PHONE_QUERY,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

afterEach(async () => {
  vi.unstubAllGlobals();
  if (i18n.language !== "uz") await act(() => i18n.changeLanguage("uz"));
});

const renderBody = (alert: AiAdvisorAlertDetail) => renderWithProviders(<div>{renderRuleBody(alert)}</div>);

const readFacts = (label = "Asosiy ma'lumotlar") => {
  const dl = screen.getByLabelText(label);
  return {
    terms: within(dl).getAllByRole("term").map((node) => node.textContent),
    values: within(dl).getAllByRole("definition").map((node) => node.textContent),
  };
};

/** Jadval qatorlari (sarlavha qatori ham) — har katak matni. */
const tableRows = (name: string) =>
  within(screen.getByRole("table", { name }))
    .getAllByRole("row")
    .map((row) => [...row.querySelectorAll("th, td")].map((cell) => cell.textContent));

const meterOf = (name: string) => screen.getByRole("meter", { name });

describe("R2 «Kuryer qarzi o'smoqda» (maket -alert-dialog-courier-debt)", () => {
  const r2 = fx.detail.r2;
  const rows = r2.evidence?.kind === "courier_days" ? r2.evidence.rows : [];
  const dayLabel = (index: number) => (index === rows.length - 1 ? "Bugun, 14:00" : formatAdvisorDayRelative(rows[index].date, "uz"));

  it("faktlar, o'lchagich («Ikkala shart bajarildi»), kassa harakati jadvali va o'sish boshlangan kundan beri jami", () => {
    renderBody(r2);
    expect(readFacts()).toEqual({
      terms: ["Kuryer", "Kassadagi summa", "Oxirgi topshirish", "Qoida"],
      values: [
        "Jasur Tursunov · Toshkent HQ",
        "2 840 000 so'm",
        `${at(fx.at(-4, 18, 20))} · 4 kun oldin`,
        "3 kun ketma-ket o'sib 2 000 000 so'mdan oshsa yoki 3 kundan ortiq topshirilmasa",
      ],
    });

    const meter = meterOf("Kassadagi summa 2 840 000 so'm, qoida chegarasi 2 000 000 so'm");
    expect(meter).toHaveAttribute("aria-valuenow", "2840000");
    expect(meter).toHaveAttribute("aria-valuemax", "3000000");
    expect(screen.getByText("Chegaradan 840 000 so'm ortiq")).toBeInTheDocument();
    expect(screen.getByText("2 840 000 / 2 000 000 so'm")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tik chiziq — qoida chegarasi, 2 000 000 so'm. Ikkala shart bajarildi: 4 kun ketma-ket o'sdi va 4 kun topshirilmagan",
      ),
    ).toBeInTheDocument();

    expect(screen.getByText("Qoldiq — kun oxiridagi summa")).toBeInTheDocument();
    expect(tableRows("Kassa harakati · oxirgi 5 kun")).toEqual([
      ["Kun", "Sotuvlar", "Topshirildi", "O'sish", "Qoldiq", "Kuryer kassasini ochish"],
      [dayLabel(0), "1 180 000 so'm", "1 560 000 so'm", "−380 000 so'm", "0 so'm", ""],
      [dayLabel(1), "610 000 so'm", "0 so'm", "+610 000 so'm", "610 000 so'm", ""],
      [dayLabel(2), "780 000 so'm", "0 so'm", "+780 000 so'm", "1 390 000 so'm", ""],
      [dayLabel(3), "905 000 so'm", "0 so'm", "+905 000 so'm", "2 295 000 so'm", ""],
      ["Bugun, 14:00", "545 000 so'm", "0 so'm", "+545 000 so'm", "2 840 000 so'm", ""],
      [`${formatAdvisorDayMonth(rows[1].date)} dan beri`, "2 840 000 so'm", "0 so'm", "+2 840 000 so'm", "2 840 000 so'm", ""],
    ]);
    expect(dayLabel(3)).toBe("Kecha");
    // Har kun — kuryer kassasiga havola (sarlavha katagi va › tugmasi).
    const links = screen.getAllByRole("link", { name: /kassa harakatini ochish$/ });
    expect(links).toHaveLength(5);
    for (const link of links) expect(link).toHaveAttribute("href", "/payments/cash-detail/377?type=courier");
  });

  it("faqat muddat sharti, qoldiq chegaradan past (maket «Boshqa holatlar»): o'lchagich yo'q, «Bajarilgan shart»", () => {
    renderBody(fx.detail.r2NoHandover);
    const { terms, values } = readFacts();
    expect(terms).toEqual(["Kuryer", "Kassadagi summa", "Oxirgi topshirish", "Qoida", "Bajarilgan shart"]);
    expect(values[0]).toBe("Farhod Ismoilov · Samarqand filiali");
    expect(values[4]).toBe("3 kundan ortiq topshirilmagan");
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("faqat o'sish sharti: o'lchagich oddiy izoh bilan, «Bajarilgan shart» — o'sish; topshirish bo'lmagan", () => {
    const facts = r2.facts as AiAdvisorFactsR2;
    renderBody({ ...r2, facts: { ...facts, trigger: "growth", last_handover_at: null, days_without_handover: null } } as AiAdvisorAlertDetail);
    const { values } = readFacts();
    expect(values[2]).toBe("Topshirish bo'lmagan");
    expect(values[4]).toBe("3 kun ketma-ket o'sib 2 000 000 so'mdan oshdi");
    expect(screen.getByText("Tik chiziq — qoida chegarasi, 2 000 000 so'm")).toBeInTheDocument();
    expect(screen.queryByText(/Ikkala shart/)).not.toBeInTheDocument();
  });

  it("telefonda — kartalar: «Sotuvlar … · topshirildi …» / «… · o'sish …», oxirida «… dan beri · 4 kun»", () => {
    usePhoneViewport();
    renderBody(r2);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const items = within(screen.getByRole("list", { name: "Kassa harakati · oxirgi 5 kun" })).getAllByRole("listitem");
    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent(`${dayLabel(0)}0 so'mSotuvlar 1 180 000 · topshirildi 1 560 000 so'm`);
    expect(items[1]).toHaveTextContent("Sotuvlar 610 000 · o'sish +610 000 so'm");
    expect(items[5]).toHaveTextContent(`${formatAdvisorDayMonth(rows[1].date)} dan beri · 4 kun2 840 000 so'm`);
  });
});

describe("R3 «G'ayrioddiy xarajat» (maket -alert-dialog-expense)", () => {
  const r3 = fx.detail.r3;

  it("faktlar, «Odatdagidan 3,4 barobar» o'lchagichi, oxirgi 5 xarajat («Shu xarajat»), jami — 30 kunlik mediana; «Izoh» ustuni yo'q", () => {
    renderBody(r3);
    expect(readFacts()).toEqual({
      terms: ["Xarajat", "Kategoriya", "Kassa", "Kiritgan", "30 kunlik mediana", "Mediana og'ishi"],
      values: [
        "1 450 000 so'm",
        "Yoqilg'i",
        "Farg'ona filiali kassasi",
        `Dilmurod Xasanov · ${at(fx.at(-1, 18, 5))}`,
        "425 000 so'm · 11 ta xarajat",
        "85 000 so'm",
      ],
    });
    const meter = meterOf("Xarajat 1 450 000 so'm, qoida chegarasi 680 000 so'm");
    expect(meter).toHaveAttribute("aria-valuemax", "1600000");
    expect(screen.getByText("Odatdagidan 3,4 barobar")).toBeInTheDocument();
    expect(screen.getByText("1 450 000 / 425 000 so'm")).toBeInTheDocument();
    expect(screen.getByText("Tik chiziq — qoida chegarasi: mediana + 3 × mediana og'ishi = 680 000 so'm")).toBeInTheDocument();

    expect(screen.getByText("Yoqilg'i · Farg'ona filiali")).toBeInTheDocument();
    const rows = tableRows("Shu kategoriyadagi oxirgi 5 xarajat");
    expect(rows[0]).toEqual(["Sana", "Kiritgan", "Summa", "Xarajatni ochish"]);
    expect(rows[1]).toEqual([`${at(fx.at(-1, 18, 5))}Shu xarajat`, "Dilmurod Xasanov", "1 450 000 so'm", ""]);
    expect(rows[4]).toEqual([at(fx.at(-12, 17, 30)), "Dilshod Rahimov", "395 000 so'm", ""]);
    expect(rows[6]).toEqual(["30 kunlik mediana", "11 ta xarajat", "425 000 so'm", ""]);
    expect(screen.queryByRole("columnheader", { name: "Izoh" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: `${at(fx.at(-1, 18, 5))} xarajatini ochish` })).toHaveAttribute(
      "href",
      "/payments/cash-detail/9?type=branch&history=98877",
    );
  });

  it("qamrov `category` (filial namunasi kam) — «Yoqilg'i · butun tizim»", () => {
    const facts = r3.facts as AiAdvisorFactsR3;
    const evidence = r3.evidence as AiAdvisorEvidenceExpenseStats;
    renderBody({
      ...r3,
      facts: { ...facts, scope: "category" },
      evidence: { ...evidence, stats: { ...evidence.stats, scope: "category" } },
    } as AiAdvisorAlertDetail);
    expect(screen.getByText("Yoqilg'i · butun tizim")).toBeInTheDocument();
  });

  it("telefonda — kartalar «Shu xarajat · Dilmurod Xasanov», oxirida «30 kunlik mediana · 11 ta»", () => {
    usePhoneViewport();
    renderBody(r3);
    const items = within(screen.getByRole("list", { name: "Shu kategoriyadagi oxirgi 5 xarajat" })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Shu xarajat · Dilmurod Xasanov");
    expect(items[0].querySelector("a")).toHaveAttribute("href", "/payments/cash-detail/9?type=branch&history=98877");
    expect(items[items.length - 1]).toHaveTextContent("30 kunlik mediana · 11 ta425 000 so'm");
  });
});

describe("R4 «Market to'lovi kechikmoqda» (maket -alert-dialog-market-payout)", () => {
  const r4 = fx.detail.r4;
  const evidence = r4.evidence as AiAdvisorEvidenceMarketDebtDays;

  it("to'lovlar: `paid > 0` kunlari + `last_payout` (bir kunda, summa teng — vaqti qo'shiladi), yangisi birinchi", () => {
    expect(deriveMarketPayouts(evidence)).toEqual([
      { key: fx.day(-10), day: fx.day(-10), at: fx.at(-10, 16, 20), amount: 2_450_000 },
      { key: fx.day(-14), day: fx.day(-14), at: null, amount: 1_980_000 },
    ]);
    // Kunlik jami boshqa (o'sha kuni ikki to'lov) — vaqtsiz kunlik summa qoladi.
    const twoPayouts = { ...evidence, last_payout: { ...evidence.last_payout!, amount: 1_000_000 } };
    expect(deriveMarketPayouts(twoPayouts)[0]).toMatchObject({ day: fx.day(-10), at: null, amount: 2_450_000 });
    // Oxirgi to'lov qatorlar oynasidan tashqarida — alohida qo'shiladi.
    const outside = { ...evidence, rows: [], last_payout: { at: fx.at(-20, 10, 0), amount: 500_000, history_id: "1" } };
    expect(deriveMarketPayouts(outside)).toEqual([{ key: "last-1", day: fx.day(-20), at: fx.at(-20, 10, 0), amount: 500_000 }]);
    expect(deriveMarketPayouts(null)).toEqual([]);
  });

  it("faktlar, «To'lovlar tarixi» (Sana · Summa · Oraliq), jami «… holatida · berilishi kerak» / qarz / to'lovsiz kunlar", () => {
    renderBody(r4);
    expect(readFacts()).toEqual({
      terms: ["Market", "Berilishi kerak", "Oxirgi to'lov", "Qoida"],
      values: ["Nur Elektronika", "3 120 000 so'm", at(fx.at(-10, 16, 20)), "7 kundan ortiq to'lov yo'q va qarz bor"],
    });
    expect(tableRows("To'lovlar tarixi · oxirgi 2 ta")).toEqual([
      ["Sana", "Summa", "Oraliq"],
      [at(fx.at(-10, 16, 20)), "2 450 000 so'm", "4 kun"],
      [formatAdvisorDay(fx.day(-14)), "1 980 000 so'm", "—"],
      [`${at(fx.at(-1, 9, 0))} holatida · berilishi kerak`, "3 120 000 so'm", "9 kun"],
    ]);
    for (const absent of ["To'lagan", "To'lov turi"]) expect(screen.queryByRole("columnheader", { name: absent })).not.toBeInTheDocument();
    for (const absent of ["To'lanmagan buyurtmalar", "Eng eski to'lanmagan sotuv"]) expect(screen.queryByText(absent)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("telefonda — «oldingisidan 4 kun keyin», oxirida «… holatida · 9 kun to'lovsiz»", () => {
    usePhoneViewport();
    renderBody(r4);
    const items = within(screen.getByRole("list", { name: "To'lovlar tarixi · oxirgi 2 ta" })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("oldingisidan 4 kun keyin");
    expect(items[1]).not.toHaveTextContent("oldingisidan");
    expect(items[2]).toHaveTextContent(`${at(fx.at(-1, 9, 0))} holatida · 9 kun to'lovsiz3 120 000 so'm`);
  });
});

describe("R5 «HQ'ga o'tkazma kechikmoqda» (maket -alert-dialog-hq-transfer)", () => {
  const r5 = fx.detail.r5;

  it("faktlar, o'lchagich (diqqat), oxirgi o'tkazmalar (havola), jami «… holatida · 4 kun o'tkazmasiz»; Menejer va Tarkibi yo'q", () => {
    renderBody(r5);
    expect(readFacts()).toEqual({
      terms: ["Filial", "Filial kassasida", "Oxirgi o'tkazma", "Qoida"],
      values: ["Urgut filiali", "6 400 000 so'm", at(fx.at(-6, 18, 40)), "5 000 000 so'mdan ko'p va 3 kundan ortiq o'tkazma yo'q"],
    });
    const meter = meterOf("Filial kassasida 6 400 000 so'm, qoida chegarasi 5 000 000 so'm");
    expect(meter.className).toContain("bg-warning-soft");
    expect(screen.getByText("Chegaradan 1 400 000 so'm ortiq")).toBeInTheDocument();
    expect(screen.getByText("Tik chiziq — qoida chegarasi, 5 000 000 so'm")).toBeInTheDocument();

    const rows = tableRows("HQ'ga oxirgi o'tkazmalar · 4 ta");
    expect(rows[0]).toEqual(["Sana", "Summa", "O'tkazmani ochish"]);
    expect(rows[1]).toEqual([at(fx.at(-6, 18, 40)), "3 180 000 so'm", ""]);
    expect(rows[5]).toEqual([`${at(fx.at(-2, 10, 30))} holatida · 4 kun o'tkazmasiz`, "6 400 000 so'm", ""]);
    expect(screen.getByRole("link", { name: `${at(fx.at(-6, 18, 40))} o'tkazmasini ochish` })).toHaveAttribute(
      "href",
      "/payments/cash-detail/12?type=branch&history=97210",
    );
    for (const absent of ["Menejer", "Tarkibi"]) expect(screen.queryByText(absent)).not.toBeInTheDocument();
  });

  it("qoldiq chegaradan oshmagan — o'lchagich chizilmaydi", () => {
    const facts = r5.facts as AiAdvisorFactsR5;
    renderBody({ ...r5, facts: { ...facts, balance: 4_000_000 } } as AiAdvisorAlertDetail);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
});

describe("R6 «Zarar» (maket -alert-dialog-loss)", () => {
  const r6 = fx.detail.r6;
  const loss = r6.facts as AiAdvisorFactsR6;

  it("kunlik: faktlar (davr hafta kuni bilan), oldingi kun bilan solishtirish — foiz o'zgarishi va sof foyda farqi", () => {
    renderBody(r6);
    const weekday = UZ_WEEKDAYS[advisorIsoWeekday(loss.from) ?? 0];
    expect(readFacts()).toEqual({
      terms: ["Davr", "Qamrov", "Pochta foydasi", "Xarajatlar", "Sof foyda", "Qoida"],
      values: [
        `${formatAdvisorDay(loss.from)}, ${weekday} · kun`,
        "Butun tizim",
        "1 240 000 so'm",
        "1 620 000 so'm",
        "−380 000 so'm",
        "Kunlik yoki haftalik sof foyda 0 dan past",
      ],
    });
    const prevDay = fx.day(-4);
    expect(screen.getByText(`${formatAdvisorDay(prevDay)}, ${UZ_WEEKDAYS[advisorIsoWeekday(prevDay) ?? 0]}`)).toBeInTheDocument();
    expect(tableRows("Oldingi kun bilan solishtirish")).toEqual([
      ["Ko'rsatkich", formatAdvisorDay(prevDay), formatAdvisorDay(loss.from), "O'zgarish"],
      ["Pochta foydasi", "1 310 000 so'm", "1 240 000 so'm", "−5,3%"],
      ["Xarajatlar", "1 050 000 so'm", "1 620 000 so'm", "+54,3%"],
      ["Sof foyda", "+260 000 so'm", "−380 000 so'm", "−640 000 so'm"],
    ]);
    expect(screen.getByText("+260 000 so'm")).toHaveClass("text-success-fg");
    expect(screen.getAllByText("−380 000 so'm").every((node) => node.classList.contains("text-danger-fg"))).toBe(true);
    // Foyda kamaydi — yomon (pastga), xarajat oshdi — yomon (tepaga).
    const deltas = document.querySelectorAll("[data-delta]");
    expect([...deltas].map((node) => node.getAttribute("data-direction"))).toEqual(["down", "up"]);
    expect(screen.queryByText(/Zararga eng ko'p ta'sir/)).not.toBeInTheDocument();
  });

  it("haftalik: «12–18.10.2026 · hafta», solishtirish jadvali yo'q (oldingi hafta — shartnomada yo'q)", () => {
    renderBody(fx.detail.r6Week);
    const week = fx.detail.r6Week.facts as typeof loss;
    expect(readFacts().values[0]).toBe(`${formatAdvisorDayRange(week.from, week.to)} · hafta`);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Oldingi hafta")).not.toBeInTheDocument();
  });

  it("oldingi kun dalilda yo'q — solishtirish chizilmaydi", () => {
    const evidence = r6.evidence as AiAdvisorEvidenceProfitDays;
    const onlyDay = { ...evidence, rows: evidence.rows.filter((row) => row.is_trigger) };
    expect(lossComparisonDays(loss, onlyDay)).toBeNull();
    expect(lossComparisonDays({ ...loss, period: "week" }, evidence)).toBeNull();
    renderBody({ ...r6, evidence: onlyDay } as AiAdvisorAlertDetail);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("telefonda — kartalar: «DD.MM: oldingi qiymat» va o'zgarish", () => {
    usePhoneViewport();
    renderBody(r6);
    const items = within(screen.getByRole("list", { name: "Oldingi kun bilan solishtirish" })).getAllByRole("listitem");
    const prev = formatAdvisorDayMonth(fx.day(-4));
    expect(items[0]).toHaveTextContent(`Pochta foydasi1 240 000 so'm${prev}: 1 310 000 so'm−5,3%`);
    expect(items[2]).toHaveTextContent(`Sof foyda−380 000 so'm${prev}: +260 000 so'm−640 000 so'm`);
  });
});

describe("R8 «Tuzatishlar ko'paydi» (maket -alert-dialog-corrections)", () => {
  const r8 = fx.detail.r8;
  const facts = r8.facts as AiAdvisorFactsR8;

  it("faktlar («14 ta · 9 qaytarish, 5 tahrir»), «Taqsimot · Turi bo'yicha» — faqat sanalgan va > 0 turlar", () => {
    renderBody(r8);
    const range = formatAdvisorDayRange(facts.from, facts.to);
    expect(readFacts()).toEqual({
      terms: ["Hafta", "Tuzatishlar", "30 kunlik o'rtacha", "Nisbat", "Qoida"],
      values: [range, "14 ta · 9 qaytarish, 5 tahrir", "6,1 ta / hafta", "2,3 barobar", "30 kunlik o'rtachadan 2 barobar va undan ko'p"],
    });
    const section = screen.getByRole("region", { name: "Taqsimot · 14 ta tuzatish" });
    expect(within(section).getByText(range)).toBeInTheDocument();
    expect(within(section).getByText("Turi bo'yicha")).toBeInTheDocument();
    expect(within(section).getAllByRole("meter").map((node) => node.getAttribute("aria-label"))).toEqual([
      "Qaytarish: 14 tadan 9 ta",
      "Summani tahrirlash: 14 tadan 5 ta",
    ]);
    for (const absent of ["Kassa bo'yicha", "Kim tuzatgan", "Tuzatilgan to'lovlar", "Buyurtma qaytarilishi"]) {
      expect(screen.queryByText(absent)).not.toBeInTheDocument();
    }
  });

  it("sanalgan turlar tartibi va filtri", () => {
    const evidence = r8.evidence as AiAdvisorEvidenceCorrections;
    expect(countedCorrectionKinds(evidence)).toEqual([
      { kind: "payment_reverse", count: 9 },
      { kind: "payment_edit", count: 5 },
    ]);
    const withRollback = { ...evidence, counted_kinds: [...evidence.counted_kinds, "order_rollback" as const] };
    expect(countedCorrectionKinds(withRollback).map((item) => item.kind)).toEqual(["payment_reverse", "payment_edit", "order_rollback"]);
    expect(countedCorrectionKinds(null)).toEqual([]);
  });

  it("ru: ko'plik shakllari", async () => {
    await act(() => i18n.changeLanguage("ru"));
    renderBody(r8);
    expect(readFacts("Основные данные").values.slice(1, 4)).toEqual(["14 шт. · 9 возвратов, 5 изменений", "6,1 в неделю", "в 2,3 раза"]);
    expect(screen.getByRole("meter", { name: "Возврат: 9 из 14" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Распределение · 14 исправлений" })).toBeInTheDocument();
  });
});

describe("backend dev holatlari (shartnoma v0.4 eslatmalari, #653 review, round-3)", () => {
  const checkRegion = () => screen.getByRole("region", { name: "Chek tekshiruvi" });
  const readCheck = () => ({
    terms: within(checkRegion()).getAllByRole("term").map((node) => node.textContent),
    values: within(checkRegion()).getAllByRole("definition").map((node) => node.textContent),
  });

  it("R7 chek so'mda emas: «Chekda» — «100 USD», «Farq» — «—», belgi «So'mda emas» va izoh; sana — xom matn", () => {
    renderBody(fx.detail.r7Currency);
    expect(readFacts()).toEqual({
      terms: ["Operatsiya", "Kassa", "Kiritilgan", "Chekda", "Farq", "Kiritgan"],
      values: [
        "Qo'lda chiqim · Yoqilg'i",
        "Urgut filiali",
        "1 250 000 so'm",
        "100 USD",
        "—",
        `Ravshan Ortiqov · ${at(fx.at(0, 11, 5))}`,
      ],
    });
    expect(
      screen.getByText("Chek boshqa valyutada (USD) — so'mdagi summa bilan solishtirib bo'lmadi. Summani rasmdan tekshiring."),
    ).toBeInTheDocument();
    expect(within(checkRegion()).getByText("So'mda emas")).toBeInTheDocument();
    expect(within(checkRegion()).queryByText("Farq bor")).not.toBeInTheDocument();
    expect(readCheck()).toEqual({ terms: ["Chek sanasi", "To'lovchi", "Ishonch"], values: ["12.10.2026", "··3307", "81%"] });
  });

  it("R7 kuryer → HQ o'tkazma, pul HQ kartasiga tushmagan: «Jo'natuvchi», «Farq» yo'q, oluvchi — «HQ kartasi emas»; sana — `date_day`", () => {
    renderBody(fx.detail.r7Transfer);
    expect(readFacts()).toEqual({
      terms: ["Operatsiya", "Jo'natuvchi", "Kiritilgan", "Chekda", "Kiritgan"],
      values: [
        "Kuryer topshirig'i",
        "Jasur Tursunov",
        "1 500 000 so'm",
        "1 500 000 so'm",
        `Jasur Tursunov · ${at(fx.at(0, 11, 5))}`,
      ],
    });
    expect(within(checkRegion()).getByText("HQ kartasiga tushmagan")).toBeInTheDocument();
    expect(within(checkRegion()).queryByText("Karta mos emas")).not.toBeInTheDocument();
    expect(readCheck()).toEqual({
      terms: ["Chek sanasi", "Oluvchi", "Bank", "Ishonch"],
      values: ["20.10.2026", "··1209HQ kartasi emas", "Kapitalbank", "90%"],
    });
  });

  it("R7 karta qoldig'i — faqat karta mos emas: «Farq» — «—», izoh «Rasm boshqa kartaniki»", () => {
    renderBody(fx.detail.r7CardOnly);
    expect(readFacts()).toEqual({
      terms: ["Kassa", "Smena", "Tizimda", "AI o'qigan", "Farq"],
      values: ["Asosiy kassa · Humo virtual", formatAdvisorDay(fx.day(-1)), "2 350 000 so'm", "2 350 000 so'm", "—"],
    });
    expect(screen.getByText("Rasm boshqa kartaniki — kassa kartasining qoldig'i emas.")).toBeInTheDocument();
  });

  it("R7 karta qoldig'i — kassir boshqa raqam ham kiritgan (|AI o'qigan − kiritilgan| > 1): «Kiritilgan» oxirida, izoh bilan", () => {
    const r7 = fx.detail.r7Card;
    renderBody({
      ...r7,
      facts: { ...(r7.facts as object), entered_amount: 2_300_000, difference: 10_000 },
    } as AiAdvisorAlertDetail);
    expect(readFacts()).toEqual({
      terms: ["Kassa", "Smena", "Tizimda", "AI o'qigan", "Farq", "Kiritilgan"],
      values: [
        "Asosiy kassa · Humo virtual",
        formatAdvisorDay(fx.day(-1)),
        "2 350 000 so'm",
        "2 310 000 so'm",
        "−40 000 so'm",
        "2 300 000 so'mkassir boshqa raqam kiritgan",
      ],
    });
  });

  it("R7 karta qoldig'i — eski qator (tizim qoldig'i noma'lum): Kiritilgan · AI o'qigan · Farq (AI o'qigan − kiritilgan)", () => {
    const r7 = fx.detail.r7Card;
    renderBody({
      ...r7,
      facts: { ...(r7.facts as object), entered_amount: 2_350_000, difference: -40_000, expected_balance: null, system_difference: null },
      evidence: null,
    } as AiAdvisorAlertDetail);
    expect(readFacts()).toEqual({
      terms: ["Kassa", "Smena", "Kiritilgan", "AI o'qigan", "Farq"],
      values: ["Asosiy kassa · Humo virtual", formatAdvisorDay(fx.day(-1)), "2 350 000 so'm", "2 310 000 so'm", "−40 000 so'm"],
    });
  });

  it("R8 baza 0 (`ratio: null`): «Nisbat» — «Oldingi 30 kunda tuzatish bo'lmagan», qolgan faktlar o'rnida", () => {
    renderBody(fx.detail.r8NoBaseline);
    const facts = fx.detail.r8NoBaseline.facts as AiAdvisorFactsR8;
    expect(readFacts()).toEqual({
      terms: ["Hafta", "Tuzatishlar", "30 kunlik o'rtacha", "Nisbat", "Qoida"],
      values: [
        formatAdvisorDayRange(facts.from, facts.to),
        "4 ta · 4 qo'lda",
        "0 ta / hafta",
        "Oldingi 30 kunda tuzatish bo'lmagan",
        "30 kunlik o'rtachadan 2 barobar va undan ko'p",
      ],
    });
  });

  it("R3 mediana 0 (`ratio_to_median: null`): o'lchagich sarlavhasi «Odatdagidan ko'p»", () => {
    renderBody(fx.detail.r3NoRatio);
    expect(screen.getByText("Odatdagidan ko'p")).toBeInTheDocument();
    expect(screen.queryByText(/barobar/)).not.toBeInTheDocument();
  });

  it("ism olinmagan (`name: null`) — «#id»", () => {
    renderBody(fx.detail.r4Nameless);
    expect(readFacts().values[0]).toBe("#55");
  });
});

describe("o'lchagich shkalasi", () => {
  it("qiymat yoki chegaradan 5 % ortiq, ikki muhim raqamga yaxlit (maketdagi 3 000 000 / 1 600 000)", () => {
    expect(thresholdMeterMax(2_840_000, 2_000_000)).toBe(3_000_000);
    expect(thresholdMeterMax(1_450_000, 680_000)).toBe(1_600_000);
    expect(thresholdMeterMax(6_400_000, 5_000_000)).toBe(6_800_000);
    expect(thresholdMeterMax(500_000, 2_000_000)).toBe(2_200_000);
    expect(thresholdMeterMax(0, 0)).toBe(1);
  });
});

describe("noma'lum qoida yoki buzilgan faktlar (D14)", () => {
  it("umumiy ko'rinish: Joy · Summa · Qoida («Boshqa qoida»), dalil chizilmaydi", () => {
    renderBody({
      ...fx.detail.r4,
      rule_key: "R9",
      facts: null,
      evidence: null,
      rule: { key: "R9", severity: "warning", thresholds: {} },
    } as unknown as AiAdvisorAlertDetail);
    expect(readFacts()).toEqual({ terms: ["Joy", "Summa", "Qoida"], values: ["Nur Elektronika", "3 120 000 so'm", "Boshqa qoida"] });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
