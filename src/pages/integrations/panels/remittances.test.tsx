import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { createInstance } from "i18next";
import uzLocale from "../../../locales/uz/integrations.json";
import ruLocale from "../../../locales/ru/integrations.json";
import enLocale from "../../../locales/en/integrations.json";
import ConnectionSettlement from "./ConnectionSettlement";
import { renderWithProviders } from "../../../test/test-utils";
import type { Connection } from "../useConnections";

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
