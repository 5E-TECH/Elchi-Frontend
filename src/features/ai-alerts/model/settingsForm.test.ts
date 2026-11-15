import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import type { AdvisorTranslate, AiAdvisorSettings } from "../../../entities/ai-advisor";
import { createAdvisorFixtures } from "../../../test/aiAdvisorFixtures";
import {
  diffSettings,
  fieldLimit,
  formatFieldInput,
  formatThresholdValue,
  parseFieldInput,
  parseServerField,
  rebaseSettingsForm,
  serverFieldError,
  settingsFieldErrorText,
  toSettingsForm,
  validateFieldInput,
  validateSettingsForm,
  type SettingsForm,
} from "./settingsForm";

/**
 * Qoidalar sozlamasi formasi (maket `superadmin-ai-assistant-settings-rules-dialog` + «Boshqa holatlar», tasdiq —
 * `-settings-confirm`; #644 `limits`): forma, tekshiruv (xato matnlari maketdagidek), PATCH tanasi — faqat `version` +
 * o'zgargan `enabled` / chegaralar (`severity`, `telegram`, `budget`, `schedule` hech qachon), 409 dan keyin ko'chirish,
 * server maydon xatosi.
 */

const fx = createAdvisorFixtures();
const settings = fx.settings;
const tFor = (language: string) => i18n.getFixedT(language, "aiAdvisor") as unknown as AdvisorTranslate;

beforeAll(async () => {
  await i18n.loadLanguages(["ru", "en"]);
});

const edit = (form: SettingsForm, rule: keyof SettingsForm, field: string, text: string): SettingsForm => ({
  ...form,
  [rule]: { ...form[rule], values: { ...form[rule].values, [field]: text } },
});
const toggle = (form: SettingsForm, rule: keyof SettingsForm, enabled: boolean): SettingsForm => ({
  ...form,
  [rule]: { ...form[rule], enabled },
});

describe("toSettingsForm", () => {
  it("faqat ko'rinadigan maydonlar (R8 ratio yo'q), butun — raqamlar, ko'paytiruvchi — til ajratkichi bilan", () => {
    const form = toSettingsForm({ ...settings, rules: { ...settings.rules, R3: { ...settings.rules.R3, mad_multiplier: 2.5 } } }, "uz");
    expect(form.R1).toEqual({ enabled: true, values: { shortage_uzs: "50000", consecutive_negative: "3" } });
    expect(form.R2.values).toEqual({ balance_uzs: "2000000", growth_days: "3", no_handover_days: "3" });
    expect(form.R3.values).toEqual({ mad_multiplier: "2,5" });
    expect(form.R6).toEqual({ enabled: true, values: {} });
    expect(form.R8).toEqual({ enabled: true, values: {} });
    expect(toSettingsForm(settings, "en").R3.values.mad_multiplier).toBe("3");
    expect(formatFieldInput(2.5, fieldLimit(settings, "R3", "mad_multiplier"), "en")).toBe("2.5");
  });

  it("qiymati yo'q chegara — limits.default", () => {
    const { shortage_uzs: _omit, ...r1 } = settings.rules.R1;
    void _omit;
    const form = toSettingsForm({ ...settings, rules: { ...settings.rules, R1: r1 } }, "uz");
    expect(form.R1.values.shortage_uzs).toBe("50000");
  });
});

describe("server `limits` — bitta manba (§7.6)", () => {
  it("chegarasi kelmagan maydon formada yo'q, tekshirilmaydi va PATCH ga kirmaydi", () => {
    const { shortage_uzs: _omit, ...r1Limits } = settings.limits.rules.R1;
    void _omit;
    const partial: AiAdvisorSettings = { ...settings, limits: { rules: { ...settings.limits.rules, R1: r1Limits } } };
    const form = toSettingsForm(partial, "uz");
    expect(form.R1.values).toEqual({ consecutive_negative: "3" });
    const edited = edit(edit(form, "R1", "shortage_uzs", "abc"), "R1", "consecutive_negative", "4");
    expect(validateSettingsForm(edited, partial)).toEqual({});
    expect(diffSettings(partial, edited).patch).toEqual({ version: settings.version, rules: { R1: { consecutive_negative: 4 } } });
  });
});

describe("validateFieldInput — maket «Noto'g'ri qiymat»", () => {
  const consecutive = fieldLimit(settings, "R1", "consecutive_negative");
  const multiplier = fieldLimit(settings, "R3", "mad_multiplier");
  const money = fieldLimit(settings, "R1", "shortage_uzs");

  it.each([
    ["", consecutive, { code: "required" }],
    ["abc", consecutive, { code: "number" }],
    ["0", consecutive, { code: "greaterThan", value: 1 }],
    ["31", consecutive, { code: "atMost", value: 30 }],
    ["2,5", consecutive, { code: "integer" }],
    ["0,5", multiplier, { code: "atLeast", value: 1 }],
    ["3,25", multiplier, { code: "decimal", digits: 1 }],
    ["11", multiplier, { code: "atMost", value: 10 }],
    ["0", money, { code: "greaterThan", value: 0 }],
    ["1000000001", money, { code: "atMost", value: 1_000_000_000 }],
  ])("%j → xato", (text, limit, expected) => {
    expect(validateFieldInput(text, limit)).toEqual(expected);
  });

  it.each([
    ["3", consecutive],
    ["2", consecutive],
    ["30", consecutive],
    ["3,5", multiplier],
    ["3.5", multiplier],
    ["1", multiplier],
    ["2,0", consecutive],
    ["30 000", money],
  ])("%j → to'g'ri", (text, limit) => {
    expect(validateFieldInput(text, limit)).toBeNull();
  });

  it("xato matnlari (uz — maketdagidek; ru, en)", () => {
    const uz = tFor("uz");
    expect(settingsFieldErrorText({ code: "greaterThan", value: 1 }, consecutive, uz, "uz")).toBe("1 dan katta son kiriting");
    expect(settingsFieldErrorText({ code: "atLeast", value: 1 }, multiplier, uz, "uz")).toBe("Kamida 1 kiriting");
    expect(settingsFieldErrorText({ code: "atMost", value: 1_000_000_000 }, money, uz, "uz")).toBe(
      "1 000 000 000 dan katta bo'lmasin",
    );
    expect(settingsFieldErrorText({ code: "number" }, consecutive, uz, "uz")).toBe("Son kiriting");
    expect(settingsFieldErrorText({ code: "required" }, consecutive, uz, "uz")).toBe("Qiymat kiriting");
    expect(settingsFieldErrorText({ code: "integer" }, consecutive, uz, "uz")).toBe("Butun son kiriting");
    expect(settingsFieldErrorText({ code: "decimal", digits: 1 }, multiplier, uz, "uz")).toBe("Ko'pi bilan 1 kasr xona");
    expect(settingsFieldErrorText({ code: "range", min: 1.1, max: 10 }, multiplier, uz, "uz")).toBe("1,1–10 oralig'ida kiriting");
    expect(settingsFieldErrorText({ code: "greaterThan", value: 1 }, consecutive, tFor("ru"), "ru")).toBe("Введите число больше 1");
    expect(settingsFieldErrorText({ code: "atMost", value: 30 }, consecutive, tFor("en"), "en")).toBe("Must not exceed 30");
  });

  it("validateSettingsForm — o'chirilgan qoidaning maydoni ham tekshiriladi", () => {
    let form = toSettingsForm(settings, "uz");
    form = toggle(edit(form, "R1", "consecutive_negative", "0"), "R1", false);
    form = edit(form, "R5", "balance_uzs", "");
    expect(validateSettingsForm(form, settings)).toEqual({
      "R1.consecutive_negative": { code: "greaterThan", value: 1 },
      "R5.balance_uzs": { code: "required" },
    });
    expect(validateSettingsForm(toSettingsForm(settings, "uz"), settings)).toEqual({});
  });
});

describe("diffSettings — PATCH tanasi va tasdiq qatorlari", () => {
  it("o'zgarish yo'q — patch null", () => {
    expect(diffSettings(settings, toSettingsForm(settings, "uz"))).toEqual({ changes: [], patch: null });
    // Bir xil son boshqa yozuvda («3,0») — o'zgarish emas.
    expect(diffSettings(settings, edit(toSettingsForm(settings, "uz"), "R3", "mad_multiplier", "3,0")).patch).toBeNull();
  });

  it("maketdagi misol: R1 chegarasi 50 000 → 30 000, R8 o'chirildi — faqat version + o'zgarganlar", () => {
    let form = toSettingsForm(settings, "uz");
    form = edit(form, "R1", "shortage_uzs", "30000");
    form = toggle(form, "R8", false);
    form = edit(form, "R3", "mad_multiplier", "2,5");
    const { changes, patch } = diffSettings(settings, form);
    expect(patch).toEqual({
      version: 4,
      rules: { R1: { shortage_uzs: 30_000 }, R3: { mad_multiplier: 2.5 }, R8: { enabled: false } },
    });
    const body = JSON.stringify(patch);
    for (const forbidden of ["severity", "telegram", "budget", "schedule", "ratio"]) expect(body).not.toContain(forbidden);
    expect(changes).toEqual([
      { kind: "threshold", rule: "R1", field: "shortage_uzs", unit: "uzs", decimals: 0, from: 50_000, to: 30_000 },
      { kind: "threshold", rule: "R3", field: "mad_multiplier", unit: "multiplier", decimals: 1, from: 3, to: 2.5 },
      { kind: "enabled", rule: "R8", from: true, to: false },
    ]);
  });

  it("kalit qaytarib qo'yilsa (yoqildi → o'chirildi → yoqildi) — o'zgarish emas", () => {
    const form = toggle(toggle(toSettingsForm(settings, "uz"), "R2", false), "R2", true);
    expect(diffSettings(settings, form).patch).toBeNull();
  });
});

describe("rebaseSettingsForm — 409 / yangi versiya", () => {
  it("foydalanuvchi o'zgartirgani qoladi, boshqa oynadagi o'zgarish olinadi (qaytarib yuborilmaydi)", () => {
    let form = toSettingsForm(settings, "uz");
    form = edit(form, "R1", "shortage_uzs", "30000");
    form = toggle(form, "R8", false);
    const next: AiAdvisorSettings = {
      ...settings,
      version: 5,
      rules: {
        ...settings.rules,
        R1: { ...settings.rules.R1, shortage_uzs: 70_000, consecutive_negative: 4 },
        R2: { ...settings.rules.R2, enabled: false },
      },
    };
    const rebased = rebaseSettingsForm(form, settings, next, "uz");
    expect(rebased.R1.values).toEqual({ shortage_uzs: "30000", consecutive_negative: "4" });
    expect(rebased.R2.enabled).toBe(false);
    expect(rebased.R8.enabled).toBe(false);
    const { patch } = diffSettings(next, rebased);
    expect(patch).toEqual({ version: 5, rules: { R1: { shortage_uzs: 30_000 }, R8: { enabled: false } } });
  });

  it("noto'g'ri matn ham saqlanadi (foydalanuvchi tuzatadi)", () => {
    const form = edit(toSettingsForm(settings, "uz"), "R4", "days_without_payout", "");
    expect(rebaseSettingsForm(form, settings, { ...settings, version: 5 }, "uz").R4.values.days_without_payout).toBe("");
  });
});

describe("server xatosi — INVALID_RULE {field, min, max}", () => {
  it("parseServerField", () => {
    expect(parseServerField("rules.R1.consecutive_negative")).toEqual({ rule: "R1", field: "consecutive_negative" });
    expect(parseServerField("rules.R8.ratio")).toBeNull();
    expect(parseServerField("rules.R9.shortage_uzs")).toBeNull();
    expect(parseServerField("rules.R1.severity")).toBeNull();
    expect(parseServerField("version")).toBeNull();
    expect(parseServerField(null)).toBeNull();
  });

  it("serverFieldError — server chegarasi bilan, aniqlanmasa oraliq", () => {
    const limit = fieldLimit(settings, "R1", "consecutive_negative");
    expect(serverFieldError("3", limit, { min: 5, max: 30 })).toEqual({ code: "greaterThan", value: 4 });
    expect(serverFieldError("3", limit, { min: 2, max: 30 })).toEqual({ code: "range", min: 2, max: 30 });
    expect(serverFieldError("3", limit, { min: null, max: null })).toEqual({ code: "range", min: 2, max: 30 });
  });
});

describe("formatThresholdValue va parseFieldInput", () => {
  it("birliklar bilan va birliksiz (uz, ru, en)", () => {
    const uz = tFor("uz");
    expect(formatThresholdValue(50_000, fieldLimit(settings, "R1", "shortage_uzs"), uz, "uz")).toBe("50 000 so'm");
    expect(formatThresholdValue(50_000, fieldLimit(settings, "R1", "shortage_uzs"), uz, "uz", { unit: false })).toBe("50 000");
    expect(formatThresholdValue(7, fieldLimit(settings, "R4", "days_without_payout"), uz, "uz")).toBe("7 kun");
    expect(formatThresholdValue(3, fieldLimit(settings, "R1", "consecutive_negative"), uz, "uz")).toBe("3 ta");
    expect(formatThresholdValue(2.5, fieldLimit(settings, "R3", "mad_multiplier"), uz, "uz")).toBe("2,5 ×");
    expect(formatThresholdValue(3, fieldLimit(settings, "R1", "consecutive_negative"), tFor("en"), "en")).toBe("3");
    expect(formatThresholdValue(7, fieldLimit(settings, "R4", "days_without_payout"), tFor("ru"), "ru")).toBe("7 дн.");
  });

  it("parseFieldInput", () => {
    expect(parseFieldInput("2,5")).toBe(2.5);
    expect(parseFieldInput(" 30 000 ")).toBe(30_000);
    expect(parseFieldInput("")).toBeNull();
    expect(parseFieldInput("1e3")).toBeNull();
    expect(parseFieldInput(undefined)).toBeNull();
  });
});
