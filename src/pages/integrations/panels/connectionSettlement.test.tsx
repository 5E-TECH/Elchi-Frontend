import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConnectionSettlement from "./ConnectionSettlement";
import { renderWithProviders } from "../../../test/test-utils";
import type { Connection } from "../useConnections";

/**
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

const BALANCE = { integration_id: "7", outstanding_amount: "5000000.00", outstanding_count: 3 };

beforeEach(() => {
  apiGetMock.mockReset().mockImplementation((url: string) =>
    Promise.resolve(
      String(url).includes("receivable-balance")
        ? { data: { statusCode: 200, data: BALANCE } }
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

describe("ConnectionSettlement — to'lov oynasi", () => {
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
    await user.type(within(dialog).getByRole("textbox", { name: /Havola/ }), "  TXN-1  ");
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

  it("server rad etsa — oyna ochiq, kiritilgan summa saqlanadi, backend matni xabarda", async () => {
    apiPostMock.mockRejectedValueOnce(
      Object.assign(new Error("x"), { response: { status: 400, data: { message: "Qarz topilmadi" } } }),
    );
    const { user, dialog } = await openPayDialog();

    const amount = within(dialog).getByRole("textbox", { name: /Summa/ });
    await user.type(amount, "250000");
    await user.click(within(dialog).getByRole("button", { name: "Yozish" }));

    expect(await screen.findByText("Qarz topilmadi")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Tashuvchidan olingan to'lov" })).toBeInTheDocument();
    expect(amount).toHaveValue("250 000");
    expect(apiPostMock).toHaveBeenCalledTimes(1);
  });
});
