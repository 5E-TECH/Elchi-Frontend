import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { queryKeys } from "../../shared/config/queryKeys";
import {
  ADVISOR_ALERT_TYPE,
  ADVISOR_CRITICAL_LIST_LINK,
  advisorAlertsBatchToast,
  advisorAlertToast,
  isAdvisorAlert,
  refreshAdvisorQueries,
} from "./realtimeAdvisor";

/** Shartnoma v0.3 §9.3: rol orqali emas, `recipient_ids` ga to'liq qator; `data` — qisqa nom va joy uchun. */
const row = (data: Record<string, unknown> | null, extra: Record<string, unknown> = {}) => ({
  id: "n-500",
  type: ADVISOR_ALERT_TYPE,
  category: "finance",
  priority: "critical",
  title: "Jiddiy ogohlantirish · Chekda farq bor",
  body: "Urgut filiali · yoqilg'i: kiritilgan 320 000 so'm, chekda 302 000 so'm (−18 000 so'm).",
  link: "/ai-assistant?tab=alerts&alert=1045",
  data,
  ...extra,
});

const R7_RECEIPT = { alert_id: "1045", rule_key: "R7", severity: "critical", variant: "receipt", subject_name: "Urgut filiali" };

/** `RealtimeSync` dagi `t` — `notifications` nomlar fazosi; maslahatchi matnlari kalit prefiksi bilan o'qiladi. */
const tNotifications = () => i18n.getFixedT(i18n.language, "notifications");

describe("realtimeAdvisor — jiddiy AI ogohlantirishi jonli kanalda (60PWUbgC §9.4)", () => {
  afterEach(async () => {
    await i18n.changeLanguage("uz");
  });

  it("faqat `ai.advisor_alert` turi (qatorli ham, signal ham) — boshqa turlar emas", () => {
    expect(isAdvisorAlert(row(R7_RECEIPT))).toBe(true);
    expect(isAdvisorAlert({ type: "ai.advisor_alert" })).toBe(true);
    expect(isAdvisorAlert({ type: "ai.advisor_report" })).toBe(false);
    expect(isAdvisorAlert({ type: "order.sold" })).toBe(false);
    expect(isAdvisorAlert({})).toBe(false);
    expect(isAdvisorAlert(null)).toBe(false);
  });

  it("⭐ maket matni: «Jiddiy ogohlantirish» + «Chekda farq bor — Urgut filiali», havola — ogohlantirish oynasi", () => {
    expect(advisorAlertToast(row(R7_RECEIPT), tNotifications())).toEqual({
      title: "Jiddiy ogohlantirish",
      description: "Chekda farq bor — Urgut filiali",
      link: "/ai-assistant?tab=alerts&alert=1045",
    });
  });

  it("qisqa nom qoidadan: R7 karta qoldig'i — «Karta qoldig'ida farq», R2 — qoida nomi; joysiz — faqat qisqa nom", () => {
    const t = tNotifications();
    expect(
      advisorAlertToast(row({ ...R7_RECEIPT, variant: "card_balance", subject_name: "Toshkent HQ" }), t).description,
    ).toBe("Karta qoldig'ida farq — Toshkent HQ");
    expect(
      advisorAlertToast(row({ alert_id: "1041", rule_key: "R2", variant: null, subject_name: "Toshkent HQ" }), t)
        .description,
    ).toBe("Kuryer qarzi o'smoqda — Toshkent HQ");
    expect(advisorAlertToast(row({ rule_key: "R6", subject_name: "  " }), t)).toMatchObject({
      title: "Jiddiy ogohlantirish",
      description: "Zarar",
    });
  });

  it("ru / en — qisqa nom va sarlavha tanlangan tilda, joy — server nomi", async () => {
    await i18n.changeLanguage("ru");
    expect(advisorAlertToast(row(R7_RECEIPT), tNotifications())).toMatchObject({
      title: "Критичное предупреждение",
      description: "Расхождение по чеку — Urgut filiali",
    });
    await i18n.changeLanguage("en");
    expect(advisorAlertToast(row({ ...R7_RECEIPT, rule_key: "R2", variant: null }), tNotifications())).toMatchObject({
      title: "Critical alert",
      description: "Courier debt growing — Urgut filiali",
    });
  });

  it("noma'lum qoida yoki `data` yo'q — serverning sarlavhasi, izohda joy (bo'lmasa — `body`)", () => {
    const t = tNotifications();
    expect(advisorAlertToast(row({ rule_key: "R9", subject_name: "Samarqand filiali" }), t)).toEqual({
      title: "Jiddiy ogohlantirish · Chekda farq bor",
      description: "Samarqand filiali",
      link: "/ai-assistant?tab=alerts&alert=1045",
    });
    expect(advisorAlertToast(row(null), t)).toEqual({
      title: "Jiddiy ogohlantirish · Chekda farq bor",
      description: "Urgut filiali · yoqilg'i: kiritilgan 320 000 so'm, chekda 302 000 so'm (−18 000 so'm).",
      link: "/ai-assistant?tab=alerts&alert=1045",
    });
    expect(advisorAlertToast(row([1, 2] as never, { body: null }), t).description).toBeUndefined();
  });

  it("`link` bo'lmasa — `data.alert_id` dan ogohlantirish oynasi; noto'g'ri ID — havolasiz (chaqiruvchi /inbox ga)", () => {
    const t = tNotifications();
    expect(advisorAlertToast(row(R7_RECEIPT, { link: null }), t).link).toBe("/ai-assistant?tab=alerts&alert=1045");
    expect(advisorAlertToast(row({ ...R7_RECEIPT, alert_id: 1046 }, { link: "" }), t).link).toBe(
      "/ai-assistant?tab=alerts&alert=1046",
    );
    expect(advisorAlertToast(row({ ...R7_RECEIPT, alert_id: "../x" }, { link: null }), t).link).toBeNull();
  });

  it("yangilash — `overview` (tab nishoni, banner) va ro'yxatlar prefiksi (sanoqlar ham); tafsilot so'ralmaydi", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await refreshAdvisorQueries(client);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      queryKeys.aiAdvisor.overview,
      queryKeys.aiAdvisor.alertLists,
    ]);
  });
  it("bir nechtasi — «N ta jiddiy ogohlantirish» (ru — ko'plik shakli), qisqa nomlar takrorsiz, havola — faqat jiddiylar", async () => {
    const r2 = { alert_id: "1041", rule_key: "R2", severity: "critical", subject_name: "Toshkent HQ" };
    const rows = [row(R7_RECEIPT), row(r2, { id: "n-501" }), row({ ...r2, alert_id: "1042" }, { id: "n-502" })];
    expect(advisorAlertsBatchToast(rows, tNotifications(), "uz")).toEqual({
      title: "3 ta jiddiy ogohlantirish",
      description: "Chekda farq bor · Kuryer qarzi o'smoqda",
      link: ADVISOR_CRITICAL_LIST_LINK,
    });
    // Qoida noma'lum — izohsiz.
    expect(advisorAlertsBatchToast([row(null), row(null, { id: "n-9" })], tNotifications(), "uz").description).toBeUndefined();

    await i18n.changeLanguage("ru");
    expect(advisorAlertsBatchToast(rows, tNotifications(), "ru").title).toBe("3 критичных предупреждения");
    await i18n.changeLanguage("en");
    expect(advisorAlertsBatchToast(rows, tNotifications(), "en").title).toBe("3 critical alerts");
  });
});
