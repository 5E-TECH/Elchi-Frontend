import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import uzLocale from "../../../locales/uz/integrations.json";
import ruLocale from "../../../locales/ru/integrations.json";
import enLocale from "../../../locales/en/integrations.json";
import ConnectionSettlement from "./ConnectionSettlement";
import { renderWithProviders } from "../../../test/test-utils";
import type { Connection } from "../useConnections";

/**
 * IS-1 (N3yNa6rO): «To'lov olindi» summasi ASOSIY KASSAGA o'zi yoziladi — panel eski «Bu ekran kassa emas» matnini
 * aytmaydi, «Qoldiq» bloki `payable_amount` / `advance_balance` ni ko'rsatadi, oyna «to'lanishi kerak» bilan.
 *
 * Hisob-kitob → «Tashuvchidan olingan to'lov» oynasi (maket `*-settlement-pay-dialog`, spec §9 «to'lov dialogi
 * validatsiyasi»): bo'sh / 0 summa yuborilmaydi; to'g'ri summa — `POST integrations/:id/remittances`
 * `{ amount, reference?, note? }` (bo'sh matnlar yuborilmaydi), so'ng qoldiq va ro'yxat qayta o'qiladi;
 * server rad etsa oyna ochiq qoladi.
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
  name: "Elchi",
  role: "carrier",
  category: "cargo",
  is_active: true,
  subtitle: "",
  raw: { slug: "elchi", base_url: "https://api.elchi.uz", auth_type: "api_key", last_sync_at: null },
} as unknown as Connection;

const BALANCE = {
  integration_id: "7",
  outstanding_amount: "4860000.00",
  outstanding_count: 23,
  advance_balance: 350000,
  payable_amount: 4510000,
};
let balance: Record<string, unknown> = BALANCE;
let receivables: Record<string, unknown>[] = [];

/** Qarzga aniq tushgan va kassaga yozilgan to'lov (backend `createRemittance` javobi). */
const EXACT = {
  remittance_id: 82,
  integration_id: "7",
  remitted_amount: 1_500_000,
  settled_amount: 1_500_000,
  settled_count: 6,
  unapplied_amount: 0,
  advance_applied: 0,
  advance_balance: 350_000,
  cashbox_posted: true,
};
/** Maket `*-pay-result-dialog`: 5 000 000 olindi, 23 ta qarz (4 860 000) yopildi, ortig'i avansga. */
const OVERPAID = {
  remittance_id: 84,
  integration_id: "7",
  remitted_amount: 5_000_000,
  settled_amount: 4_860_000,
  settled_count: 23,
  unapplied_amount: 140_000,
  advance_applied: 0,
  advance_balance: 490_000,
  warning: "To'lovning 140000 so'mi hech bir qarz qatoriga sig'madi (xom backend matni)",
  cashbox_posted: true,
};
const postReturns = (data: Record<string, unknown>) =>
  apiPostMock.mockResolvedValueOnce({ data: { statusCode: 201, message: "Remittance recorded", data } });

/** Pul matnidagi bo'linmas bo'sh joylarni oddiyga keltiradi. */
const norm = (value: string | null | undefined) => (value ?? "").replace(/\s/g, " ");

beforeEach(() => {
  balance = BALANCE;
  receivables = [];
  apiGetMock.mockReset().mockImplementation((url: string) =>
    Promise.resolve(
      String(url).includes("receivable-balance")
        ? { data: { statusCode: 200, data: balance } }
        : {
            data: {
              statusCode: 200,
              data: { items: receivables, pagination: { total: receivables.length, page: 1, limit: 20 } },
            },
          },
    ),
  );
  apiPostMock.mockReset().mockResolvedValue({ data: { statusCode: 201, data: EXACT } });
});

const openPayDialog = async () => {
  const user = userEvent.setup();
  renderWithProviders(<ConnectionSettlement connection={carrier} />);
  await user.click(await screen.findByRole("button", { name: "To'lov olindi" }));
  const dialog = await screen.findByRole("dialog", { name: "Tashuvchidan olingan to'lov" });
  return { user, dialog };
};

const balanceCalls = () => apiGetMock.mock.calls.filter(([url]) => String(url).includes("receivable-balance")).length;

describe("ConnectionSettlement — kassa matni va «Qoldiq»", () => {
  it("⭐ «To'lov asosiy kassaga o'zi yoziladi» — Asosiy kassa havolasi bilan; eski «kassa emas» matni yo'q", async () => {
    renderWithProviders(<ConnectionSettlement connection={carrier} />);
    const alert = await screen.findByText("To'lov asosiy kassaga o'zi yoziladi");
    const box = alert.closest("[data-tone]") as HTMLElement;
    expect(within(box).getByRole("link", { name: "Asosiy kassaga" })).toHaveAttribute("href", "/payments/main-cashbox");
    expect(within(box).getByText("qo'lda qayta kiritmang").tagName).toBe("STRONG");
    expect(screen.queryByText(/kassa emas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kassaga yozilmaydi/)).not.toBeInTheDocument();
  });

  it("⭐ to'lanishi kerak, yopilmagan qarz, hamkor avansi «−N» va formula", async () => {
    renderWithProviders(<ConnectionSettlement connection={carrier} />);
    const section = await screen.findByRole("region", { name: "Qoldiq" });
    await within(section).findByText("To'lanishi kerak");
    const text = norm(section.textContent);
    expect(text).toContain("4 510 000");
    expect(text).toContain("23 ta yozuv kutilmoqda");
    expect(text).toContain("Yopilmagan qarz4 860 000 so'm");
    expect(text).toContain("Hamkor avansi−350 000 so'moldingi to'lovdan ortib qolgan");
    expect(text).toContain("To'lanishi kerak = yopilmagan qarz − hamkor avansi");
    expect(within(section).queryByText("Qarz yo'q")).not.toBeInTheDocument();
  });

  it("qarz yo'q (ortiqcha to'lovdan keyin) — «Qarz yo'q», avans ishorasiz, formula yo'q", async () => {
    balance = { integration_id: "7", outstanding_amount: 0, outstanding_count: 0, advance_balance: 490000, payable_amount: 0 };
    renderWithProviders(<ConnectionSettlement connection={carrier} />);
    const section = await screen.findByRole("region", { name: "Qoldiq" });
    expect(await within(section).findByText("Qarz yo'q")).toBeInTheDocument();
    const text = norm(section.textContent);
    expect(text).toContain("Hamkor avansi490 000 so'mkeyingi qarzlarga o'zi qo'llanadi");
    expect(text).not.toContain("−490 000");
    expect(text).not.toContain("To'lanishi kerak = ");
  });

  it("eski backend (avanssiz) — to'lanishi kerak = yopilmagan qarz, avans 0", async () => {
    balance = { integration_id: "7", outstanding_amount: "5000000.00", outstanding_count: 3 };
    renderWithProviders(<ConnectionSettlement connection={carrier} />);
    const section = await screen.findByRole("region", { name: "Qoldiq" });
    await within(section).findByText("3 ta yozuv kutilmoqda");
    const text = norm(section.textContent);
    expect(text).toContain("To'lanishi kerak5 000 000");
    expect(text).toContain("Hamkor avansi0 so'm");
  });
});

describe("ConnectionSettlement — to'lov oynasi", () => {
  it("⭐ «to'lanishi kerak» sarlavhasi, kassaga kirim haqida info, qoldiq tafsiloti, «Orqaga»", async () => {
    const { dialog } = await openPayDialog();
    await waitFor(() => expect(norm(dialog.textContent)).toContain("Elchi · to'lanishi kerak 4 510 000 so'm"));
    const info = within(dialog).getByText("Summa asosiy kassaga kirim bo'ladi").closest("[data-tone]") as HTMLElement;
    expect(info).toHaveAttribute("data-tone", "info");
    expect(within(dialog).queryByText("Kassaga yozilmaydi")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: /To'lov raqami yoki chek/ })).toBeInTheDocument();
    const text = norm(dialog.textContent);
    expect(text).toContain("Yopilmagan qarz4 860 000 so'm23 ta yozuv");
    expect(text).toContain("Hamkor avansi−350 000 so'm");
    expect(text).toContain("To'lanishi kerak4 510 000 so'm");
    expect(text).toContain("Qarzlar eng eskisidan boshlab yopiladi, hamkor avansi ham hisobga olinadi.");
    expect(within(dialog).getByRole("button", { name: "Orqaga" })).toBeInTheDocument();
  });

  it("qarz yo'q — oynada ham avans ishorasiz (panel bilan bir xil)", async () => {
    balance = { integration_id: "7", outstanding_amount: 0, outstanding_count: 0, advance_balance: 490000, payable_amount: 0 };
    const { dialog } = await openPayDialog();
    await waitFor(() => expect(norm(dialog.textContent)).toContain("Hamkor avansi490 000 so'm"));
    expect(norm(dialog.textContent)).not.toContain("−490 000");
  });

  it("yozuvlar soni ko'plik shakli bilan (en «1 record», ru «2 записи»)", async () => {
    const resources = Object.fromEntries(
      Object.entries({ uz: uzLocale, ru: ruLocale, en: enLocale }).map(([lng, ns]) => [lng, { integrations: ns }]),
    );
    const i18n = createInstance();
    await i18n.init({ resources, lng: "en", ns: ["integrations"], defaultNS: "integrations", interpolation: { escapeValue: false } });
    const tr = (lng: string, key: string, count: number) => i18n.getFixedT(lng)(key, { count });
    expect(tr("en", "stlPayRecords", 1)).toBe("1 record");
    expect(tr("en", "console.pendingRecords", 5)).toBe("5 records pending");
    expect(tr("ru", "stlPayRecords", 2)).toBe("2 записи");
    expect(tr("ru", "stlPayRecords", 5)).toBe("5 записей");
    expect(tr("ru", "console.pendingRecords", 1)).toBe("1 запись ожидает");
    expect(tr("uz", "stlPayRecords", 3)).toBe("3 ta yozuv");
  });

  it("qoldiq o'qilmasa — oynada «0 so'm» emas «—», tafsilot yo'q; panelda xato matni", async () => {
    apiGetMock.mockImplementation((url: string) =>
      String(url).includes("receivable-balance")
        ? Promise.reject(Object.assign(new Error("x"), { response: { status: 500, data: {} } }))
        : Promise.resolve({ data: { statusCode: 200, data: { items: [], pagination: { total: 0, page: 1, limit: 20 } } } }),
    );
    const { dialog } = await openPayDialog();
    expect(await screen.findByText(/Qarz qoldig'ini yuklab bo'lmadi/)).toBeInTheDocument();
    expect(norm(dialog.textContent)).toContain("Elchi · to'lanishi kerak —");
    expect(within(dialog).queryByText("Hamkor avansi")).not.toBeInTheDocument();
  });

  it("bo'sh va 0 summa yuborilmaydi — maydon ostida xato", async () => {
    const { user, dialog } = await openPayDialog();

    await user.click(within(dialog).getByRole("button", { name: "Yozish" }));
    expect(await within(dialog).findByText("Summa kiritilishi shart")).toBeInTheDocument();

    await user.type(within(dialog).getByRole("textbox", { name: /Summa/ }), "0");
    await user.click(within(dialog).getByRole("button", { name: "Yozish" }));
    expect(await within(dialog).findByText("Summa noldan katta bo'lishi kerak")).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("⭐ aniq tushdi va kassaga yozildi — POST remittances (bo'sh havola/izohsiz), xabar, oyna yopiladi, qoldiq qayta o'qiladi", async () => {
    const { user, dialog } = await openPayDialog();
    await waitFor(() => expect(balanceCalls()).toBeGreaterThan(0));
    const before = balanceCalls();

    await user.type(within(dialog).getByRole("textbox", { name: /Summa/ }), "1500000");
    await user.type(within(dialog).getByRole("textbox", { name: /To'lov raqami yoki chek/ }), "  TXN-1  ");
    await user.click(within(dialog).getByRole("button", { name: "Yozish" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("integrations/7/remittances", { amount: 1_500_000, reference: "TXN-1" }),
    );
    expect(await screen.findByText("To'lov yozildi")).toBeInTheDocument();
    expect(norm(screen.getByText(/ta qarz yopildi/).textContent)).toBe("6 ta qarz yopildi · Asosiy kassaga 1 500 000 so'm kirim");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Tashuvchidan olingan to'lov" })).not.toBeInTheDocument(),
    );
    // Aniq tushgan to'lovda natija oynasi yo'q — faqat xabar.
    expect(screen.queryByRole("dialog", { name: "To'lov yozildi" })).not.toBeInTheDocument();
    await waitFor(() => expect(balanceCalls()).toBeGreaterThan(before));
  });

  it("⭐ kesh: hisob-kitob + kassa, moliya tarixi, bosh sahifa, daromad, KPI, marketlar kalitlari yangilanadi", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<ConnectionSettlement connection={carrier} />);
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    await user.click(await screen.findByRole("button", { name: "To'lov olindi" }));
    const dialog = await screen.findByRole("dialog", { name: "Tashuvchidan olingan to'lov" });
    await user.type(within(dialog).getByRole("textbox", { name: /Summa/ }), "1500000");
    await user.click(within(dialog).getByRole("button", { name: "Yozish" }));
    await screen.findByText("To'lov yozildi");
    const keys = spy.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey[0]);
    expect(keys).toEqual(
      expect.arrayContaining(["integration-settlement", "cashbox", "finance-history", "dashboard", "revenue", "kpi", "markets"]),
    );
  });

  it("server rad etsa — oyna ochiq, kiritilgan summa saqlanadi, xom backend matni EMAS, i18n xabar", async () => {
    apiPostMock.mockRejectedValueOnce(
      Object.assign(new Error("x"), { response: { status: 400, data: { message: "Qarz topilmadi" } } }),
    );
    const { user, dialog } = await openPayDialog();

    const amount = within(dialog).getByRole("textbox", { name: /Summa/ });
    await user.type(amount, "250000");
    await user.click(within(dialog).getByRole("button", { name: "Yozish" }));

    expect(await screen.findByText("To'lovni yozib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Summa yozilmadi. Qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.queryByText("Qarz topilmadi")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Tashuvchidan olingan to'lov" })).toBeInTheDocument();
    expect(amount).toHaveValue("250 000");
    expect(apiPostMock).toHaveBeenCalledTimes(1);
  });
});

describe("ConnectionSettlement — ortiqcha summa (IS-2, ega S2)", () => {
  it("⭐ summa to'lanishi kerakdan katta — «… ortiq», «Ortig'i hamkor avansiga o'tadi», «Yozish» bloklanmaydi", async () => {
    const { user, dialog } = await openPayDialog();
    await waitFor(() => expect(norm(dialog.textContent)).toContain("to'lanishi kerak 4 510 000 so'm"));
    await user.type(within(dialog).getByRole("textbox", { name: /Summa/ }), "5000000");

    expect(norm(within(dialog).getByText(/bo'lgandan .* ortiq/).textContent)).toBe(
      "To'lanishi kerak bo'lgandan 490 000 so'm ortiq",
    );
    const warning = within(dialog).getByText("Ortig'i hamkor avansiga o'tadi").closest("[data-tone]") as HTMLElement;
    expect(warning).toHaveAttribute("data-tone", "warning");
    expect(norm(warning.textContent)).toContain(
      "Barcha 23 ta qarz yopiladi, Elchi avansi 490 000 so'm bo'ladi va keyingi to'lovda qarzlarga o'zi qo'llanadi. Asosiy kassaga to'liq 5 000 000 so'm yoziladi.",
    );
    // Maket: ortiqcha holatda kassaga kirim info'si va qoldiq tafsiloti o'rnida ogohlantirish.
    expect(within(dialog).queryByText("Summa asosiy kassaga kirim bo'ladi")).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/eng eskisidan/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Yozish" })).toBeEnabled();
  });

  it("«Summani … ga tenglash» — summa to'lanishi kerakka tenglanadi, ogohlantirish yo'qoladi", async () => {
    const { user, dialog } = await openPayDialog();
    await waitFor(() => expect(norm(dialog.textContent)).toContain("to'lanishi kerak 4 510 000 so'm"));
    const amount = within(dialog).getByRole("textbox", { name: /Summa/ });
    await user.type(amount, "5000000");
    await user.click(within(dialog).getByRole("button", { name: /^Summani 4\s510\s000 so'mga tenglash$/ }));
    expect(amount).toHaveValue("4 510 000");
    expect(within(dialog).queryByText("Ortig'i hamkor avansiga o'tadi")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Summa asosiy kassaga kirim bo'ladi")).toBeInTheDocument();
  });

  it("qarz yo'q (to'lanishi kerak = 0) — «yopilmagan qarz yo'q» matni, tenglash tugmasi yo'q", async () => {
    balance = { integration_id: "7", outstanding_amount: 0, outstanding_count: 0, advance_balance: 490000, payable_amount: 0 };
    const { user, dialog } = await openPayDialog();
    await waitFor(() => expect(norm(dialog.textContent)).toContain("to'lanishi kerak 0 so'm"));
    await user.type(within(dialog).getByRole("textbox", { name: /Summa/ }), "100000");
    const warning = within(dialog).getByText("Ortig'i hamkor avansiga o'tadi").closest("[data-tone]") as HTMLElement;
    expect(norm(warning.textContent)).toContain("Yopilmagan qarz yo'q — Elchi avansi 590 000 so'm bo'ladi");
    expect(within(dialog).queryByRole("button", { name: /tenglash/ })).not.toBeInTheDocument();
  });

  it("qoldiq o'qilmagan — ortiqcha summa oldindan aytilmaydi", async () => {
    apiGetMock.mockImplementation((url: string) =>
      String(url).includes("receivable-balance")
        ? Promise.reject(Object.assign(new Error("x"), { response: { status: 500, data: {} } }))
        : Promise.resolve({ data: { statusCode: 200, data: { items: [], pagination: { total: 0, page: 1, limit: 20 } } } }),
    );
    const { user, dialog } = await openPayDialog();
    await screen.findByText(/Qarz qoldig'ini yuklab bo'lmadi/);
    await user.type(within(dialog).getByRole("textbox", { name: /Summa/ }), "99000000");
    expect(within(dialog).queryByText("Ortig'i hamkor avansiga o'tadi")).not.toBeInTheDocument();
  });
});

describe("ConnectionSettlement — «To'lov yozildi» natija oynasi (IS-2)", () => {
  const payAndOpenResult = async (response: Record<string, unknown>, typed = "5000000", reference?: string) => {
    postReturns(response);
    const { user, dialog } = await openPayDialog();
    await waitFor(() => expect(norm(dialog.textContent)).toContain("to'lanishi kerak 4 510 000 so'm"));
    await user.type(within(dialog).getByRole("textbox", { name: /Summa/ }), typed);
    if (reference) await user.type(within(dialog).getByRole("textbox", { name: /To'lov raqami yoki chek/ }), reference);
    await user.click(within(dialog).getByRole("button", { name: "Yozish" }));
    const result = await screen.findByRole("dialog", { name: "To'lov yozildi" });
    return { user, result };
  };

  it("⭐ ortiqcha to'lov — avansga o'tdi, tafsilot, «Kirim yozildi», «Asosiy kassani ochish», «Tayyor»", async () => {
    const { user, result } = await payAndOpenResult(OVERPAID, "5000000", "To'lov topshiriqnomasi №4531");
    expect(norm(result.textContent)).toMatch(/Elchi · №84 · Bugun, \d{2}:\d{2}/);
    const info = within(result).getByText("140 000 so'm avansga o'tdi").closest("[data-tone]") as HTMLElement;
    expect(info).toHaveAttribute("data-tone", "info");
    expect(norm(info.textContent)).toContain("To'lov qarzdan ortiq edi — ortig'i Elchi avansi bo'ldi");
    const text = norm(result.textContent);
    expect(text).toContain("To'lov raqamiTo'lov topshiriqnomasi №4531");
    expect(text).toContain("Olingan summa5 000 000 so'm");
    expect(text).not.toContain("Avvalgi avansdan ishlatildi");
    expect(text).toContain("Yopilgan qarzlar4 860 000 so'm23 ta yozuv — hammasi");
    expect(text).toContain("Avansga o'tdi140 000 so'mkeyingi to'lovda o'zi qo'llanadi");
    expect(text).toContain("Hamkor avansi endi490 000 so'm");
    expect(text).toContain("Kirim yozildi · 5 000 000 so'm");
    // Xom backend `warning` matni ko'rsatilmaydi.
    expect(text).not.toContain("xom backend matni");
    expect(within(result).queryByText("Summa asosiy kassaga tushmadi")).not.toBeInTheDocument();
    expect(within(result).getByRole("link", { name: "Asosiy kassani ochish" })).toHaveAttribute("href", "/payments/main-cashbox");

    await user.click(within(result).getByRole("button", { name: "Tayyor" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "To'lov yozildi" })).not.toBeInTheDocument());
    expect(apiPostMock).toHaveBeenCalledWith("integrations/7/remittances", {
      amount: 5_000_000,
      reference: "To'lov topshiriqnomasi №4531",
    });
  });

  it("⭐ kassaga yozilmadi — «Kassaga yozilmadi» va «Summa asosiy kassaga tushmadi» (Asosiy kassa tarixi havolasi)", async () => {
    const { result } = await payAndOpenResult({ ...EXACT, cashbox_posted: false }, "1500000");
    expect(within(result).getByText("Kassaga yozilmadi")).toBeInTheDocument();
    const alert = within(result).getByRole("alert");
    expect(alert).toHaveTextContent("Summa asosiy kassaga tushmadi");
    expect(within(alert).getByRole("link", { name: "Asosiy kassa" })).toHaveAttribute("href", "/payments/main-cashbox");
    expect(within(result).queryByText(/avansga o'tdi/)).not.toBeInTheDocument();
    expect(norm(result.textContent)).toContain("Yopilgan qarzlar1 500 000 so'm6 ta yozuv");
    expect(norm(result.textContent)).not.toContain("hammasi");
  });

  it("avansdan ishlatildi (to'lov qarzdan kam) — «Avvalgi avansdan ishlatildi», «Hamkor avansi endi 0»", async () => {
    const { result } = await payAndOpenResult(
      {
        remittance_id: 85,
        remitted_amount: 4_300_000,
        settled_amount: 4_650_000,
        settled_count: 21,
        unapplied_amount: 0,
        advance_applied: 350_000,
        advance_balance: 0,
        cashbox_posted: true,
      },
      "4300000",
    );
    const text = norm(result.textContent);
    expect(text).toContain("Olingan summa4 300 000 so'm");
    expect(text).toContain("Avvalgi avansdan ishlatildi350 000 so'm");
    expect(text).toContain("Yopilgan qarzlar4 650 000 so'm21 ta yozuv");
    expect(text).toContain("Hamkor avansi endi0 so'm");
    expect(text).not.toContain("Avansga o'tdi");
    expect(within(result).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("qarz yozuviga to'liq yetmagan qoldiq — boshqa izoh (ortiqcha to'lov emas)", async () => {
    const { result } = await payAndOpenResult(
      { remittance_id: 86, remitted_amount: 500_000, settled_amount: 410_000, settled_count: 1, unapplied_amount: 90_000, advance_applied: 0, advance_balance: 440_000, cashbox_posted: true },
      "500000",
    );
    expect(within(result).getByText("90 000 so'm avansga o'tdi")).toBeInTheDocument();
    expect(norm(result.textContent)).toContain("To'lovning qarz yozuvlariga sig'magan qismi Elchi avansi bo'ldi");
    expect(norm(result.textContent)).not.toContain("qarzdan ortiq edi");
  });
});

describe("ConnectionSettlement — «Qarz yozuvlari» da «To'lov» ustuni (IS-2)", () => {
  it("⭐ yopilgan qarzda «To'lov №82», kutilayotganda «—»", async () => {
    receivables = [
      { id: 1, order_id: "10209", integration_id: "7", provider_slug: "ty", external_ref: "TY-447738", amount: "1150000.00", status: "settled", remittance_id: "82", settled_at: "2026-10-14T05:30:00.000Z" },
      { id: 2, order_id: "10233", integration_id: "7", provider_slug: "ty", external_ref: "TY-448097", amount: "410000.00", status: "pending", remittance_id: null, settled_at: null },
    ];
    renderWithProviders(<ConnectionSettlement connection={carrier} />);
    const table = await screen.findByRole("table", { name: "Qarz yozuvlari" });
    expect(within(table).getByRole("columnheader", { name: "To'lov" })).toBeInTheDocument();
    const settled = within(table).getByText("№10209").closest("tr") as HTMLElement;
    expect(within(settled).getByText("To'lov №82")).toBeInTheDocument();
    const pending = within(table).getByText("№10233").closest("tr") as HTMLElement;
    expect(norm(pending.textContent)).toContain("Kutilmoqda—");
  });
});

describe("IS-2 matnlari — ko'plik shakli (ru/en)", () => {
  it("xabar va ortiqcha summa ogohlantirishi", async () => {
    const resources = Object.fromEntries(
      Object.entries({ uz: uzLocale, ru: ruLocale, en: enLocale }).map(([lng, ns]) => [lng, { integrations: ns }]),
    );
    const i18n = createInstance();
    await i18n.init({ resources, lng: "en", ns: ["integrations"], defaultNS: "integrations", interpolation: { escapeValue: false } });
    const tr = (lng: string, key: string, options: Record<string, unknown>) => i18n.getFixedT(lng)(key, options);
    expect(tr("uz", "settlementPay.toastDesc", { count: 6, amount: "X" })).toBe("6 ta qarz yopildi · Asosiy kassaga X kirim");
    expect(tr("ru", "settlementPay.toastDesc", { count: 1, amount: "X" })).toBe("Закрыт 1 долг · Приход в основную кассу: X");
    expect(tr("ru", "settlementPay.toastDesc", { count: 6, amount: "X" })).toBe("Закрыто 6 долгов · Приход в основную кассу: X");
    expect(tr("en", "settlementPay.toastDesc", { count: 1, amount: "X" })).toBe("1 debt closed · X posted to the main cashbox");
    expect(tr("ru", "settlementPay.overpayDesc", { count: 23, name: "N", advance: "A", amount: "S" })).toMatch(/^Будут закрыты все 23 долга,/);
    expect(tr("en", "settlementPay.overpayDesc", { count: 23, name: "N", advance: "A", amount: "S" })).toMatch(/^All 23 debts will be closed,/);
  });
});
