import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LogisticsOpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";
import i18n from "../../i18n";

/**
 * fix3b CODE-09 / C13 — /logistics-ops: tasdiqlash erkin JSON emas, tanlangan
 * qatorlarning `{ order_ids }` ini yuboradi (`ReturnRequestsActionRequestDto`);
 * ro'yxat xatosi ko'rinadi; ustun sarlavhalari tarjima qilingan.
 */

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGetMock(...a),
    post: (...a: unknown[]) => apiPostMock(...a),
  },
}));

const groupsResponse = {
  data: {
    statusCode: 200,
    data: {
      total: 3,
      groups: [
        {
          courier_id: "56",
          courier: { id: "56", name: "Kuryer Ali" },
          orders: [
            { id: "9001", status: "waiting" },
            { id: "9002", status: "waiting" },
          ],
        },
        { courier_id: "57", courier: { id: "57", name: "Kuryer Vali" }, orders: [{ id: "9003", status: "waiting" }] },
      ],
    },
  },
};

describe("LogisticsOps — qaytarish so'rovlarini tasdiqlash (fix3b)", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiGetMock.mockResolvedValue(groupsResponse);
    apiPostMock.mockResolvedValue({ data: { statusCode: 200, data: { approved: 2 } } });
  });

  afterEach(async () => {
    await i18n.changeLanguage("uz");
  });

  it("hech narsa tanlanmagan bo'lsa tasdiqlash o'chiq, erkin JSON maydoni yo'q", async () => {
    renderWithProviders(<LogisticsOpsPage />);
    await screen.findByText("Kuryer Vali");

    expect(screen.getByRole("button", { name: "Tasdiqlash — 0 ta" })).toBeDisabled();
    expect(screen.queryByLabelText("approve-payload")).not.toBeInTheDocument();
    expect(screen.getByText("Tasdiqlash uchun ro'yxatdan buyurtmalarni tanlang.")).toBeInTheDocument();
  });

  it("bir nechta qator tanlansa — faqat ularning buyurtma id lari yuboriladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LogisticsOpsPage />);
    await screen.findByText("Kuryer Vali");

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]); // 9001
    await user.click(checkboxes[3]); // 9003
    await user.click(screen.getByRole("button", { name: "Tasdiqlash — 2 ta" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Qaytarish so'rovlarini tasdiqlang" });
    await user.click(within(dialog).getByRole("button", { name: "2 tasini tasdiqlash" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("post/return-requests/approve", { order_ids: ["9001", "9003"] }),
    );
    // OS-3 (S5): natija — xabar (inline OpsAlert emas).
    expect(await screen.findByText("2 ta tasdiqlandi")).toBeInTheDocument();
    expect(screen.getByText("2 ta buyurtma omborga qaytarildi.")).toBeInTheDocument();
  });

  it("tasdiqlash rad etilsa — oyna ochiq, i18n sabab (xom backend matni emas)", async () => {
    const user = userEvent.setup();
    apiPostMock.mockRejectedValue({ response: { status: 403, data: { message: "Bu kuryer sizning filialingizga tegishli emas" } } });
    renderWithProviders(<LogisticsOpsPage />);
    await screen.findByText("Kuryer Vali");

    await user.click(screen.getAllByRole("checkbox")[1]);
    await user.click(screen.getByRole("button", { name: "Tasdiqlash — 1 ta" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Qaytarish so'rovlarini tasdiqlang" });
    await user.click(within(dialog).getByRole("button", { name: "1 tasini tasdiqlash" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Ayrim buyurtmalar boshqa filial kuryerida — ularni o'sha filial ko'rib chiqadi. Ro'yxat yangilandi.",
    );
    expect(screen.getByRole("alertdialog", { name: "Qaytarish so'rovlarini tasdiqlang" })).toBeInTheDocument();
    expect(screen.queryByText("Bu kuryer sizning filialingizga tegishli emas")).not.toBeInTheDocument();
  });

  it("ro'yxat yuklanmasa — xato holati va qayta urinish", async () => {
    const user = userEvent.setup();
    apiGetMock.mockRejectedValueOnce({ response: { status: 500, data: { message: "boom" } } });
    renderWithProviders(<LogisticsOpsPage />);

    expect(await screen.findByText("Qaytarish so'rovlarini yuklab bo'lmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Qayta urinish/ }));

    expect(await screen.findByText("Kuryer Vali")).toBeInTheDocument();
  });

  it("ustun sarlavhalari tanlangan tilda (ru)", async () => {
    await i18n.changeLanguage("ru");
    renderWithProviders(<LogisticsOpsPage />);

    expect(await screen.findByText("Логистика — запросы на возврат")).toBeInTheDocument();
    const headers = (await screen.findAllByRole("columnheader")).map((cell) => cell.textContent?.trim());
    expect(headers).toEqual(expect.arrayContaining(["Заказ", "Статус", "Курьер"]));
  });
});
