import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { createInstance } from "i18next";
import uzLocale from "../../../locales/uz/integrations.json";
import ruLocale from "../../../locales/ru/integrations.json";
import enLocale from "../../../locales/en/integrations.json";
import ConnectionSettlement from "./ConnectionSettlement";
import { renderWithProviders } from "../../../test/test-utils";
import type { Connection } from "../useConnections";
import i18n from "../../../i18n";

/**
 * IS-3 (DxdZFdIk) — «Olingan to'lovlar» va to'lovni bekor qilish (maket `*-panel-settlement`,
 * `*-settlement-cancel-dialog`).
 *
 *  - ro'yxat `GET integrations/:id/remittances` (status, from_date, to_date, page, limit); «Holat · kassa»
 *    `cashbox_posted` bo'yicha; muallif ismi chizilmaydi (Taklif);
 *  - holatlar `QueryBoundary`: filtrsiz bo'sh, filtr bo'yicha bo'sh + «Filtrni tozalash», xato + «Qayta urinish»;
 *  - bekor qilish: oqibatlar, «Sabab *» (≤ 500), eski yozuvda majburiy radio → `reverse_cashbox`, oldindan
 *    «Hozir bekor qilib bo'lmaydi», 409 / 502 / 404 / idempotent — faqat i18n matn (xom o'zbekcha `message` emas).
 */

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
vi.mock("../../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

// Kassa keshini yangilash — haqiqiy funksiya, lekin chaqiruvi kuzatiladi (natija noma'lum bo'lganda ham yangilansin).
const refreshCashbox = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("../../../entities/payments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../entities/payments")>();
  refreshCashbox.fn.mockImplementation(actual.refreshCashboxQueries);
  return { ...actual, refreshCashboxQueries: (...args: Parameters<typeof actual.refreshCashboxQueries>) => refreshCashbox.fn(...args) };
});

const carrier = {
  uid: "integration:7",
  kind: "integration",
  id: "7",
  name: "Tez Yetkaz",
  role: "carrier",
  category: "cargo",
  is_active: true,
  subtitle: "",
  raw: { slug: "tez-yetkaz", base_url: "https://api.tezyetkaz.uz", auth_type: "api_key", last_sync_at: null },
} as unknown as Connection;

const BALANCE = { integration_id: "7", outstanding_amount: "4860000.00", outstanding_count: 23, advance_balance: 350000, payable_amount: 4510000 };

const ROWS = [
  { id: 82, created_at: "2026-10-14T06:20:00.000Z", amount: 1500000, settled_count: 1, settled_amount: 1150000, unapplied_amount: 350000, advance_applied: 0, reference: "To'lov topshiriqnomasi №4518", note: "Oktyabr, 2-hafta COD", created_by: "1", status: "active", cashbox_posted: true, cancelled_at: null, cancel_reason: null },
  { id: 79, created_at: "2026-10-13T12:45:00.000Z", amount: 2000000, settled_count: 6, settled_amount: 2000000, unapplied_amount: 0, advance_applied: 0, reference: "PAY-2026-10-18-002", note: null, created_by: "2", status: "active", cashbox_posted: false, cancelled_at: null, cancel_reason: null },
  { id: 77, created_at: "2026-10-12T10:10:00.000Z", amount: 5000000, settled_count: 7, settled_amount: 5000000, unapplied_amount: 0, advance_applied: 0, reference: "To'lov topshiriqnomasi №4497", note: null, created_by: "1", status: "cancelled", cashbox_posted: true, cancelled_at: "2026-10-12T10:32:00.000Z", cancel_reason: "Summa xato: 500 000 o'rniga 5 000 000" },
  { id: 61, created_at: "2026-10-02T07:00:00.000Z", amount: 2300000, settled_count: 9, settled_amount: null, unapplied_amount: null, advance_applied: null, reference: null, note: "Sentabr hisob-kitobi", created_by: "1", status: "active", cashbox_posted: null, cancelled_at: null, cancel_reason: null },
];

let balance: Record<string, unknown> = BALANCE;
let rows: Record<string, unknown>[] = ROWS;
let remittancesFail = false;

const receivable = { id: 4, order_id: "10209", integration_id: "7", provider_slug: "tez-yetkaz", external_ref: "TY-447738", amount: "1150000.00", status: "settled", remittance_id: "82", settled_at: "2026-10-14T06:20:00.000Z" };

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
const httpError = (status: number, message: string) =>
  new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_RESPONSE", config, {}, {
    status,
    statusText: "",
    headers: {},
    config,
    data: { statusCode: status, message },
  } as AxiosResponse);

const remittanceCalls = () =>
  apiGetMock.mock.calls.filter(([url]) => String(url) === "integrations/7/remittances").map(([, opts]) => opts?.params);

beforeEach(() => {
  balance = BALANCE;
  rows = ROWS;
  remittancesFail = false;
  apiGetMock.mockReset().mockImplementation((url: string, opts?: { params?: Record<string, unknown> }) => {
    const path = String(url);
    if (path.includes("receivable-balance")) return Promise.resolve({ data: { statusCode: 200, data: balance } });
    if (path === "integrations/7/remittances") {
      if (remittancesFail) return Promise.reject(httpError(500, "Internal server error"));
      const status = opts?.params?.status;
      const items = rows.filter((r) => !status || r.status === status);
      return Promise.resolve({ data: { statusCode: 200, data: { items, pagination: { total: items.length, page: 1, limit: 10 } } } });
    }
    return Promise.resolve({ data: { statusCode: 200, data: { items: [receivable], pagination: { total: 1, page: 1, limit: 20 } } } });
  });
  apiPostMock.mockReset().mockResolvedValue({
    data: { statusCode: 200, message: "To'lov bekor qilindi", data: { remittance_id: "82", amount: 1500000, status: "cancelled", reopened_count: 1, cashbox_reversed: true } },
  });
});

const norm = (value: string | null | undefined) => (value ?? "").replace(/\s/g, " ");

const renderPanel = async () => {
  const user = userEvent.setup();
  renderWithProviders(<ConnectionSettlement connection={carrier} />);
  const section = await screen.findByRole("region", { name: "Olingan to'lovlar" });
  return { user, section };
};

const rowOf = async (section: HTMLElement, id: string) => {
  const table = await within(section).findByRole("table", { name: "Olingan to'lovlar" });
  return within(table).getByRole("row", { name: new RegExp(`№${id}\\b`) });
};

const openCancel = async (id: string) => {
  const { user, section } = await renderPanel();
  await user.click(await within(section).findByRole("button", { name: `№${id} to'lovini bekor qilish` }));
  const dialog = await screen.findByRole("alertdialog", { name: "To'lovni bekor qilasizmi?" });
  return { user, section, dialog };
};

describe("«Olingan to'lovlar» — ro'yxat", () => {
  it("⭐ qatorlar: summa, yopilgan qarzlar, avans, to'lov raqami, «Holat · kassa»; muallif ismi yo'q", async () => {
    const { section } = await renderPanel();
    const r82 = norm((await rowOf(section, "82")).textContent);
    expect(r82).toContain("1 500 000 so'm");
    expect(r82).toContain("1 ta qarz");
    expect(r82).toContain("1 150 000 so'm · 350 000 so'm avansga o'tdi");
    expect(r82).toContain("To'lov topshiriqnomasi №4518");
    expect(r82).toContain("Oktyabr, 2-hafta COD");
    expect(r82).toContain("Faol");
    expect(r82).toContain("Kassaga yozildi");

    expect(norm((await rowOf(section, "79")).textContent)).toContain("Kassaga yozilmadiAsosiy kassa tarixini tekshiring");

    const r77 = await rowOf(section, "77");
    expect(norm(r77.textContent)).toContain("7 ta qarz qayta ochildi");
    expect(norm(r77.textContent)).toContain("Kassadan qaytarildi");
    expect(norm(r77.textContent)).toContain("«Summa xato: 500 000 o'rniga 5 000 000»");
    expect(within(r77).queryByRole("button", { name: /bekor qilish/ })).not.toBeInTheDocument();

    expect(norm((await rowOf(section, "61")).textContent)).toContain("Kassa: eski yozuv");
    expect(section.textContent).not.toMatch(/created_by|Shodiyor/);
    expect(remittanceCalls()[0]).toEqual({ page: 1, limit: 10 });
  });

  it("⭐ chiplar «Faol · Bekor qilingan · Barchasi» (o'z kaliti) — `status` yuboriladi, sahifa 1 ga", async () => {
    const { user, section } = await renderPanel();
    const group = within(section).getByRole("group", { name: "To'lov holati bo'yicha filtr" });
    expect(within(group).getByRole("button", { name: "Barchasi" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(group).getByRole("button", { name: "Bekor qilingan" }));
    await waitFor(() => expect(remittanceCalls().at(-1)).toEqual({ status: "cancelled", page: 1, limit: 10 }));
    await waitFor(() => expect(within(section).getAllByRole("row")).toHaveLength(2));
  });

  it("filtrsiz bo'sh — «Hali to'lov yozilmagan» (tashuvchi nomi bilan), «Filtrni tozalash» yo'q", async () => {
    rows = [];
    const { section } = await renderPanel();
    expect(await within(section).findByText("Hali to'lov yozilmagan")).toBeInTheDocument();
    expect(within(section).getByText(/Tez Yetkaz pul o'tkazganda/)).toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Filtrni tozalash" })).not.toBeInTheDocument();
  });

  it("⭐ filtr bo'yicha bo'sh — «Filtrni tozalash» filtrni tozalaydi", async () => {
    rows = ROWS.filter((r) => r.status === "active");
    const { user, section } = await renderPanel();
    await within(section).findByRole("table", { name: "Olingan to'lovlar" });
    await user.click(within(section).getByRole("button", { name: "Bekor qilingan" }));
    expect(await within(section).findByText("Bu filtrda to'lov yo'q")).toBeInTheDocument();
    await user.click(within(section).getByRole("button", { name: "Filtrni tozalash" }));
    await within(section).findByRole("table", { name: "Olingan to'lovlar" });
    expect(remittanceCalls().at(-1)).toEqual({ page: 1, limit: 10 });
  });

  it("xato — «Olingan to'lovlarni yuklab bo'lmadi» + «Qayta urinish» (xom matn yo'q)", async () => {
    remittancesFail = true;
    const { user, section } = await renderPanel();
    const alert = await within(section).findByRole("alert");
    expect(alert).toHaveTextContent("Olingan to'lovlarni yuklab bo'lmadi.");
    expect(alert).not.toHaveTextContent("Internal server error");
    remittancesFail = false;
    await user.click(within(alert).getByRole("button", { name: "Qayta urinish" }));
    await within(section).findByRole("table", { name: "Olingan to'lovlar" });
  });

  it("«Qarz yozuvlari» dagi «To'lov №82» — «Olingan to'lovlar» sarlavhasiga fokus", async () => {
    const { user } = await renderPanel();
    const debts = await screen.findByRole("table", { name: "Qarz yozuvlari" });
    await user.click(await within(debts).findByRole("button", { name: "To'lov №82" }));
    expect(document.querySelector("[data-remittances-head]")).toHaveFocus();
  });
});

describe("«To'lovni bekor qilish» oynasi", () => {
  it("⭐ oqibatlar, sabab majburiy, `POST …/82/cancel { reason }`, xabar «1 ta qarz qayta ochildi · kassadan … qaytarildi»", async () => {
    const { user, dialog } = await openCancel("82");
    expect(norm(dialog.textContent)).toContain("№82 · 1 500 000 so'm · ");
    const list = within(dialog).getByTestId("cancel-consequences");
    expect(norm(list.textContent)).toContain("1 ta qarz qaytadan «Kutilmoqda» bo'ladi — Tez Yetkaz qarzi 1 150 000 so'mga ortadi");
    expect(norm(list.textContent)).toContain("Asosiy kassadan 1 500 000 so'm teskari chiqim yoziladi");
    expect(norm(list.textContent)).toContain("Shu to'lovdan qolgan 350 000 so'm avans ham bekor bo'ladi");
    expect(norm(list.textContent)).toContain("«Bekor qilingan · Kassadan qaytarildi»");
    expect(within(dialog).getByRole("button", { name: "Orqaga" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    expect(await within(dialog).findByText("Sababni yozing")).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();

    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "  Summa ikki marta kiritilgan ");
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("integrations/7/remittances/82/cancel", { reason: "Summa ikki marta kiritilgan" }),
    );
    expect(await screen.findByText("To'lov bekor qilindi")).toBeInTheDocument();
    expect(norm((await screen.findByText(/qayta ochildi · kassadan/)).textContent)).toBe("1 ta qarz qayta ochildi · kassadan 1 500 000 so'm qaytarildi");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    // «Bekor qilish» tugmasi qatordan yo'qoladi — fokus bo'lim sarlavhasiga qaytadi.
    await waitFor(() => expect(document.querySelector("[data-remittances-head]")).toHaveFocus());
  });

  it("sabab 500 belgidan oshsa — yuborilmaydi", async () => {
    const { user, dialog } = await openCancel("82");
    const input = within(dialog).getByRole("textbox", { name: /Sabab/ });
    await user.click(input);
    await user.paste("x".repeat(501));
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    expect(await within(dialog).findByText("Sabab 500 belgidan oshmasin")).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("kassaga yozilmagan to'lov — «kassa o'zgarmaydi», `reverse_cashbox` yuborilmaydi", async () => {
    const { user, dialog } = await openCancel("79");
    expect(norm(dialog.textContent)).toContain("Bu to'lov kassaga yozilmagan edi — kassa o'zgarmaydi");
    expect(norm(dialog.textContent)).not.toContain("teskari chiqim yoziladi");
    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "Xato");
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith("integrations/7/remittances/79/cancel", { reason: "Xato" }));
  });

  it("⭐ eski yozuv — «kassaga kirim qilinganmi?» majburiy, tanlov `reverse_cashbox` bo'lib ketadi", async () => {
    const { user, dialog } = await openCancel("61");
    const group = within(dialog).getByRole("group", { name: /Bu to'lov asosiy kassaga kirim qilinganmi/ });
    expect(within(dialog).getByRole("link", { name: "Asosiy kassa" })).toHaveAttribute("href", "/payments/main-cashbox");
    // Tanlov saqlanmaydi (BD2-10) — maketdagi «Tanlov saqlanadi» va'dasi yo'q; ro'yxatda «Kassa: eski yozuv».
    expect(dialog.textContent).not.toContain("Tanlov saqlanadi");
    expect(norm(dialog.textContent)).toContain("«Bekor qilingan · Kassa: eski yozuv»");
    expect(norm(dialog.textContent)).toContain("9 ta qarz qaytadan «Kutilmoqda» bo'ladi — Tez Yetkaz qarzi ortadi");

    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "Pul kassaga kirgan");
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    expect(await within(dialog).findByText("Kassa bo'yicha javobni tanlang")).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();

    await user.click(within(group).getByRole("radio", { name: /Ha — kassadan 2 300 000 so'm teskari chiqim yozilsin/ }));
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("integrations/7/remittances/61/cancel", { reason: "Pul kassaga kirgan", reverse_cashbox: true }),
    );
  });

  it("⭐ oldindan: avans keyingi to'lovda ishlatilgan — «Hozir bekor qilib bo'lmaydi», tugma o'chiq", async () => {
    balance = { ...BALANCE, advance_balance: 210000 };
    rows = [
      { ...ROWS[0], id: 85, created_at: "2026-10-15T06:20:00.000Z", unapplied_amount: 0, advance_applied: 140000 },
      ...ROWS,
    ];
    const { dialog } = await openCancel("82");
    const alert = within(dialog).getByRole("alert");
    expect(alert).toHaveTextContent("Hozir bekor qilib bo'lmaydi");
    expect(norm(alert.textContent)).toContain("Bu to'lovdan qolgan avansning 140 000 so'mi keyingi to'lovda (№85) qarz yopishga ishlatilgan. Avval №85 ni bekor qiling, keyin buni.");
    expect(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" })).toBeDisabled();
    expect(within(dialog).queryByRole("textbox", { name: /Sabab/ })).not.toBeInTheDocument();
  });

  it("⭐ 409 (zaxira) — xom o'zbekcha matn emas, «Hozir bekor qilib bo'lmaydi»; ro'yxat qayta o'qiladi", async () => {
    apiPostMock.mockRejectedValueOnce(httpError(409, "Bu to'lovdan qolgan avansning 140000 so'mi … (#85) — RAW"));
    const { user, dialog } = await openCancel("82");
    const before = remittanceCalls().length;
    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "Xato");
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Hozir bekor qilib bo'lmaydi");
    expect(dialog.textContent).not.toContain("RAW");
    expect(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" })).toBeDisabled();
    await waitFor(() => expect(remittanceCalls().length).toBeGreaterThan(before));
  });

  it("⭐ 502 — «Kassadan chiqim yozib bo'lmadi», oyna ochiq, qayta urinish mumkin", async () => {
    apiPostMock.mockRejectedValueOnce(httpError(502, "Kassadan teskari chiqim yozilmadi — to'lov bekor qilinmadi: RAW"));
    const { user, dialog } = await openCancel("82");
    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "Xato");
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    const alert = await within(dialog).findByRole("alert");
    expect(norm(alert.textContent)).toContain("Kassadan chiqim yozib bo'lmadiTo'lov, qarzlar va kassa avvalgidek qoldi.");
    expect(dialog.textContent).not.toContain("RAW");
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiPostMock).toHaveBeenCalledTimes(2);
  });

  it("404 — oyna yopiladi, «To'lov topilmadi» xabari", async () => {
    apiPostMock.mockRejectedValueOnce(httpError(404, "Remittance not found"));
    const { user, dialog } = await openCancel("82");
    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "Xato");
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    expect(await screen.findByText("To'lov topilmadi")).toBeInTheDocument();
    expect(screen.queryByText("Remittance not found")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("idempotent javob — «To'lov allaqachon bekor qilingan»", async () => {
    apiPostMock.mockResolvedValueOnce({
      data: { statusCode: 200, message: "To'lov allaqachon bekor qilingan", data: { remittance_id: "82", amount: 1500000, status: "cancelled", idempotent: true } },
    });
    const { user, dialog } = await openCancel("82");
    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "Xato");
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    expect(await screen.findByText("To'lov allaqachon bekor qilingan")).toBeInTheDocument();
    expect(screen.getByText("Hech narsa o'zgarmadi — ro'yxat yangilandi.")).toBeInTheDocument();
  });

  it("tarmoq xatosi — umumiy «To'lovni bekor qilib bo'lmadi» (takror bosish xavfsiz)", async () => {
    apiPostMock.mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK", config, {}));
    const { user, dialog } = await openCancel("79");
    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "Xato");
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("To'lovni bekor qilib bo'lmadi");
  });
});

describe("«Olingan to'lovlar» — uz/ru/en kalitlari", () => {
  const flatten = (obj: Record<string, unknown>, prefix = ""): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === "object" ? flatten(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    );
  const base = (keys: string[]) => [...new Set(keys.map((k) => k.replace(/_(one|few|many|other)$/, "")))].sort();

  it("⭐ uchala tilda bir xil kalitlar (ko'plik shakllari bilan)", () => {
    const uz = base(flatten(uzLocale.remittances as Record<string, unknown>));
    expect(base(flatten(ruLocale.remittances as Record<string, unknown>))).toEqual(uz);
    expect(base(flatten(enLocale.remittances as Record<string, unknown>))).toEqual(uz);
  });

  it("ru ko'plik: 5 ta qarz — «5 долгов»", async () => {
    const i18n = createInstance();
    await i18n.init({ lng: "ru", resources: { ru: { integrations: ruLocale } }, interpolation: { escapeValue: false } });
    expect(i18n.t("integrations:remittances.debtsReopened", { count: 5 })).toBe("Снова открыто 5 долгов");
    expect(i18n.t("integrations:remittances.debts", { count: 2 })).toBe("2 долга");
  });
});

/* ───────────── Review tuzatishlari (IS-3) ───────────── */

/** Sahifalangan javob (backend `listRemittances`: status, page, limit → `{ items, pagination }`). */
const paginate = (all: Record<string, unknown>[], params?: Record<string, unknown>) => {
  const page = Number(params?.page ?? 1);
  const limit = Number(params?.limit ?? 10);
  const filtered = all.filter((r) => !params?.status || r.status === params.status);
  return {
    data: { statusCode: 200, data: { items: filtered.slice((page - 1) * limit, page * limit), pagination: { total: filtered.length, page, limit } } },
  };
};

/** Kassaga yozilmagan, avanssiz faol to'lovlar (bekor qilish to'sig'i yo'q). */
const many = (n: number, start: number) =>
  Array.from({ length: n }, (_, i) => ({ ...ROWS[1], id: start + i, reference: `REF-${start + i}` }));

const callsFor = (id: string) =>
  apiGetMock.mock.calls.filter(([url]) => String(url) === `integrations/${id}/remittances`).map(([, opts]) => opts?.params);

const asPhone = () => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("max-width: 767px"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
};

describe("review: sahifa va ulanish almashishi", () => {
  it("⭐ boshqa ulanishga o'tilganda sahifa / filtr yangidan — A ning 3-sahifasi B ga yuborilmaydi", async () => {
    const byId: Record<string, Record<string, unknown>[]> = { "7": many(25, 100), "8": many(5, 200) };
    apiGetMock.mockImplementation((url: string, opts?: { params?: Record<string, unknown> }) => {
      const path = String(url);
      if (path.includes("receivable-balance")) return Promise.resolve({ data: { statusCode: 200, data: BALANCE } });
      const m = /^integrations\/(\d+)\/remittances$/.exec(path);
      if (m) return Promise.resolve(paginate(byId[m[1]], opts?.params));
      return Promise.resolve({ data: { statusCode: 200, data: { items: [], pagination: { total: 0, page: 1, limit: 20 } } } });
    });
    const other = { ...carrier, uid: "integration:8", id: "8", name: "Boshqa" } as Connection;
    const Switcher = () => {
      const [c, setC] = useState(carrier);
      return (
        <>
          <button type="button" onClick={() => setC(other)}>
            switch
          </button>
          <ConnectionSettlement connection={c} />
        </>
      );
    };
    const user = userEvent.setup();
    renderWithProviders(<Switcher />);
    const section = await screen.findByRole("region", { name: "Olingan to'lovlar" });
    await within(section).findByRole("table", { name: "Olingan to'lovlar" });
    await user.click(within(section).getByRole("button", { name: "3" }));
    await waitFor(() => expect(callsFor("7").at(-1)).toEqual({ page: 3, limit: 10 }));

    await user.click(screen.getByRole("button", { name: "switch" }));
    await waitFor(() => expect(callsFor("8").length).toBeGreaterThan(0));
    expect(callsFor("8").every((p) => p.page === 1)).toBe(true);
    const fresh = await screen.findByRole("region", { name: "Olingan to'lovlar" });
    await waitFor(() => expect(within(fresh).getByRole("row", { name: /№200\b/ })).toBeInTheDocument());
    expect(within(fresh).queryByText(/Hali to'lov yozilmagan/)).not.toBeInTheDocument();
  });

  it("⭐ «Faol» da oxirgi sahifaning yagona qatori bekor qilinsa — oxirgi haqiqiy sahifaga, yolg'on «to'lov yo'q» emas", async () => {
    let all: Record<string, unknown>[] = many(11, 300);
    apiGetMock.mockImplementation((url: string, opts?: { params?: Record<string, unknown> }) => {
      const path = String(url);
      if (path.includes("receivable-balance")) return Promise.resolve({ data: { statusCode: 200, data: BALANCE } });
      if (path === "integrations/7/remittances") return Promise.resolve(paginate(all, opts?.params));
      return Promise.resolve({ data: { statusCode: 200, data: { items: [], pagination: { total: 0, page: 1, limit: 20 } } } });
    });
    apiPostMock.mockImplementation(() => {
      all = all.map((r) => (r.id === 310 ? { ...r, status: "cancelled", cancelled_at: "2026-10-20T10:00:00.000Z", cancel_reason: "Xato" } : r));
      return Promise.resolve({ data: { statusCode: 200, data: { remittance_id: "310", amount: 2000000, status: "cancelled", reopened_count: 6, cashbox_reversed: false } } });
    });
    const { user, section } = await renderPanel();
    await within(section).findByRole("table", { name: "Olingan to'lovlar" });
    await user.click(within(section).getByRole("button", { name: "Faol" }));
    await waitFor(() => expect(remittanceCalls().at(-1)).toEqual({ status: "active", page: 1, limit: 10 }));
    await user.click(within(section).getByRole("button", { name: "2" }));
    await user.click(await within(section).findByRole("button", { name: "№310 to'lovini bekor qilish" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "Xato");
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));

    await waitFor(() => expect(remittanceCalls().at(-1)).toEqual({ status: "active", page: 1, limit: 10 }));
    await waitFor(() => expect(within(section).getByRole("row", { name: /№300\b/ })).toBeInTheDocument());
    expect(within(section).queryByText("Bu filtrda to'lov yo'q")).not.toBeInTheDocument();
    expect(within(section).getByRole("navigation", { name: "To'lovlar sahifalari" })).toBeInTheDocument();
  });
});

describe("review: oflayn", () => {
  afterEach(() => onlineManager.setOnline(true));

  it("⭐ so'rov oflayn kutib tursa — «Internet aloqasi yo'q», «Hali to'lov yozilmagan» / «Qarz yozuvi yo'q» emas", async () => {
    onlineManager.setOnline(false);
    renderWithProviders(<ConnectionSettlement connection={carrier} />);
    const section = await screen.findByRole("region", { name: "Olingan to'lovlar" });
    expect(await within(section).findByText("Internet aloqasi yo'q")).toBeInTheDocument();
    expect(within(section).queryByText("Hali to'lov yozilmagan")).not.toBeInTheDocument();
    expect(screen.getAllByText("Internet aloqasi yo'q").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Qarz yozuvi yo'q")).not.toBeInTheDocument();
  });
});

describe("review: ko'rinish va matn", () => {
  afterEach(async () => {
    if (i18n.language !== "uz") await i18n.changeLanguage("uz");
  });

  it("⭐ summalar bo'linmaydi — oqibatdagi <strong>, «avansga o'tdi», sarlavhadagi summa (NBSP)", async () => {
    const { section, dialog } = await openCancel("82");
    const strong = within(within(dialog).getByTestId("cancel-consequences")).getByText((_, el) => el?.tagName === "STRONG" && norm(el.textContent) === "1 150 000 so'm");
    expect(strong).toHaveClass("whitespace-nowrap");
    expect(within(dialog).getByText(/^№82 · /).textContent).toContain("1 500 000 so'm");
    const adv = within(await rowOf(section, "82")).getAllByText((_, el) => norm(el?.textContent) === "350 000 so'm avansga o'tdi" && el?.tagName === "SPAN");
    adv.forEach((el) => expect(el).toHaveClass("whitespace-nowrap"));
  });

  it("oqibatlar ro'yxati — maketdagidek bitta ichki chekka + oraliq, bo'luvchi chiziqlarsiz", async () => {
    const { dialog } = await openCancel("82");
    const list = within(dialog).getByTestId("cancel-consequences");
    expect(list).toHaveClass("gap-2.5", "px-3.5", "py-3");
    list.querySelectorAll("li").forEach((li) => expect(li.className).not.toMatch(/border-t|py-2\.5/));
  });

  it("ikonkalar registrdan: CircleX / RotateCcw (Ban va Undo2 emas)", async () => {
    const { section, dialog } = await openCancel("82");
    expect(dialog.querySelector("svg.lucide-ban")).toBeNull();
    expect(dialog.querySelector("svg.lucide-undo-2")).toBeNull();
    expect(dialog.querySelector("svg.lucide-circle-x")).not.toBeNull();
    expect(section.querySelector("svg.lucide-undo-2")).toBeNull();
    expect((await rowOf(section, "77")).querySelector("svg.lucide-rotate-ccw")).not.toBeNull();
  });

  it("⭐ 409 dan keyin fokus «Orqaga» ga (forma o'rniga ogohlantirish — <body> ga tushmaydi)", async () => {
    apiPostMock.mockRejectedValueOnce(httpError(409, "RAW"));
    const { user, dialog } = await openCancel("82");
    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "Xato");
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    await within(dialog).findByText("Hozir bekor qilib bo'lmaydi");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Orqaga" })).toHaveFocus());
  });

  it("⭐ bir tikda ikki marta yuborish — bitta so'rov", async () => {
    const { user, dialog } = await openCancel("82");
    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "Xato");
    const form = dialog.querySelector("form") ?? dialog.closest("form");
    expect(form).not.toBeNull();
    act(() => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiPostMock).toHaveBeenCalledTimes(1);
  });

  it("⭐ tarmoq xatosi (natija noma'lum) — kassa keshi ham yangilanadi", async () => {
    apiPostMock.mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK", config, {}));
    const { user, dialog } = await openCancel("82");
    refreshCashbox.fn.mockClear();
    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "Xato");
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    await within(dialog).findByText("To'lovni bekor qilib bo'lmadi");
    expect(refreshCashbox.fn).toHaveBeenCalledTimes(1);
  });

  it("⭐ kassa rad etsa (400) — «Asosiy kassa» havolasi; 403 — kassa xatosi emas, umumiy xato", async () => {
    apiPostMock.mockRejectedValueOnce(httpError(400, "Insufficient cash balance")).mockRejectedValueOnce(httpError(403, "Forbidden"));
    const { user, dialog } = await openCancel("82");
    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "Xato");
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Kassadan chiqim yozib bo'lmadi");
    expect(within(alert).getByRole("link", { name: "Asosiy kassa" })).toHaveAttribute("href", "/payments/main-cashbox");
    expect(alert).not.toHaveTextContent("Insufficient");

    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("To'lovni bekor qilib bo'lmadi"));
    expect(within(dialog).getByRole("alert")).not.toHaveTextContent("Kassadan chiqim");
  });

  it("muvaffaqiyat xabari qarz qayta ochilmaganda ham bosh harf bilan — «Kassa o'zgarmadi»", async () => {
    apiPostMock.mockResolvedValueOnce({
      data: { statusCode: 200, data: { remittance_id: "79", amount: 2000000, status: "cancelled", reopened_count: 0, cashbox_reversed: false } },
    });
    const { user, dialog } = await openCancel("79");
    await user.type(within(dialog).getByRole("textbox", { name: /Sabab/ }), "Xato");
    await user.click(within(dialog).getByRole("button", { name: "To'lovni bekor qilish" }));
    expect(await screen.findByText("Kassa o'zgarmadi")).toBeInTheDocument();
  });

  it("jami son ekran o'quvchiga ham (nishon `aria-hidden`, bo'lim nomi o'zgarmaydi)", async () => {
    const { section } = await renderPanel();
    expect(await within(section).findByTestId("remittances-total")).toHaveTextContent("Jami 4 ta to'lov");
  });

  it("xato matni ogohlantirish tanasida (qalin sarlavha emas — maketdagidek)", async () => {
    remittancesFail = true;
    const { section } = await renderPanel();
    const alert = await within(section).findByRole("alert");
    expect(within(alert).getByText("Olingan to'lovlarni yuklab bo'lmadi.")).not.toHaveClass("font-bold");
  });

  it("⭐ en: sabab “…” qo'shtirnoqda, ingliz matnlarida «» yo'q", async () => {
    await i18n.changeLanguage("en");
    renderWithProviders(<ConnectionSettlement connection={carrier} />);
    const section = await screen.findByRole("region", { name: "Received payments" });
    const table = await within(section).findByRole("table", { name: "Received payments" });
    const r77 = within(table).getByRole("row", { name: /#77\b/ });
    expect(norm(r77.textContent)).toContain("“Summa xato: 500 000 o'rniga 5 000 000”");
    expect(JSON.stringify(enLocale.remittances)).not.toMatch(/[«»]/);
  });

  it("⭐ telefon kartasi: bekor qilinganda «qayta ochildi · Bekor qilindi · «sabab»» keyin raqam; holat va kassa bir qatorda", async () => {
    const restore = asPhone();
    try {
      const { section } = await renderPanel();
      await waitFor(() => expect(within(section).getAllByText(/№77/).length).toBeGreaterThan(0));
      const text = norm(section.textContent);
      const reopened = text.indexOf("7 ta qarz qayta ochildi · Bekor qilindi:");
      expect(reopened).toBeGreaterThan(-1);
      expect(text.indexOf("«Summa xato: 500 000 o'rniga 5 000 000»")).toBeGreaterThan(reopened);
      expect(text.indexOf("To'lov topshiriqnomasi №4497")).toBeGreaterThan(text.indexOf("«Summa xato"));
      const badges = within(section).getAllByText("Bekor qilingan").filter((el) => !el.closest("button"));
      expect(badges.length).toBeGreaterThan(0);
      // Holat nishoni va «Kassadan qaytarildi» bitta o'raluvchi qatorda (ustun emas).
      const row = badges[0].closest("span.flex-wrap");
      expect(row).not.toBeNull();
      expect(row).toHaveTextContent("Kassadan qaytarildi");
      expect(row).not.toHaveClass("flex-col");
    } finally {
      restore();
    }
  });

  it("filtr chiplari telefonda kamida 44 px keng («All» 43 px edi)", async () => {
    const { section } = await renderPanel();
    within(within(section).getByRole("group", { name: "To'lov holati bo'yicha filtr" }))
      .getAllByRole("button")
      .forEach((chip) => expect(chip).toHaveClass("max-md:min-w-11"));
  });
});
