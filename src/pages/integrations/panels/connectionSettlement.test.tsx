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

/** Pul matnidagi bo'linmas bo'sh joylarni oddiyga keltiradi. */
const norm = (value: string | null | undefined) => (value ?? "").replace(/\s/g, " ");

beforeEach(() => {
  balance = BALANCE;
  apiGetMock.mockReset().mockImplementation((url: string) =>
    Promise.resolve(
      String(url).includes("receivable-balance")
        ? { data: { statusCode: 200, data: balance } }
        : { data: { statusCode: 200, data: { items: [], pagination: { total: 0, page: 1, limit: 20 } } } },
    ),
  );
  apiPostMock.mockReset().mockResolvedValue({ data: { statusCode: 201, data: { id: "r1" } } });
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

  it("to'g'ri summa — POST remittances (bo'sh havola/izohsiz), xabar, oyna yopiladi, qoldiq qayta o'qiladi", async () => {
    const { user, dialog } = await openPayDialog();
    await waitFor(() => expect(balanceCalls()).toBeGreaterThan(0));
    const before = balanceCalls();

    await user.type(within(dialog).getByRole("textbox", { name: /Summa/ }), "1500000");
    await user.type(within(dialog).getByRole("textbox", { name: /To'lov raqami yoki chek/ }), "  TXN-1  ");
    await user.click(within(dialog).getByRole("button", { name: "Yozish" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("integrations/7/remittances", { amount: 1_500_000, reference: "TXN-1" }),
    );
    expect(await screen.findByText("To'lov yozildi va qarzlar yopildi")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Tashuvchidan olingan to'lov" })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(balanceCalls()).toBeGreaterThan(before));
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
