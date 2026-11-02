import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import LogisticsOpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { expectNoRawBackendText, expectRequestBody, mockEnvelope, mockRejection } from "../../test/mockEnvelope";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGetMock(...a),
    post: (...a: unknown[]) => apiPostMock(...a),
  },
}));

describe("LogisticsOps page", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    // Haqiqiy konvert: `GET post/return-requests/list` → `{ statusCode, message, data: { total, scope, groups } }`.
    apiGetMock.mockResolvedValue(mockEnvelope({ total: 0, scope: { type: "HQ" }, groups: [] }));
    apiPostMock.mockResolvedValue(mockEnvelope({ approved: 0, order_ids: [], skipped_order_ids: [] }));
  });

  it("renders header \"Logistika — qaytarish so'rovlari\"", () => {
    renderWithProviders(<LogisticsOpsPage />);
    expect(
      screen.getByText("Logistika — qaytarish so'rovlari"),
    ).toBeInTheDocument();
  });

  it("calls api.get with \"post/return-requests/list\" on mount", async () => {
    renderWithProviders(<LogisticsOpsPage />);
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith(
        "post/return-requests/list",
        expect.anything(),
      ),
    );
  });

  it("calls api.post with \"post/return-requests/approve\" and {order_ids} of the selected rows — fix3b CODE-09", async () => {
    const user = userEvent.setup();
    apiGetMock.mockResolvedValue(
      mockEnvelope({
        total: 1,
        groups: [{ courier_id: "56", courier: { id: "56", name: "Kuryer Ali" }, orders: [{ id: "9001", status: "waiting" }] }],
      }),
    );
    renderWithProviders(<LogisticsOpsPage />);

    await screen.findByText("Kuryer Ali");
    // [0] — "hammasini tanlash", [1] — 9001 qatori.
    await user.click(screen.getAllByRole("checkbox")[1]);
    await user.click(screen.getByRole("button", { name: "Tasdiqlash — 1 ta" }));
    // OS-3: avval tasdiq oynasi — oynasiz so'rov ketmaydi.
    const dialog = await screen.findByRole("alertdialog", { name: "Qaytarish so'rovlarini tasdiqlang" });
    expect(apiPostMock).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "1 tasini tasdiqlash" }));

    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(1));
    // Tana aynan `{ order_ids }` (`ReturnRequestsActionRequestDto`) — faqat URL emas.
    expectRequestBody(apiPostMock, "post/return-requests/approve", { order_ids: ["9001"] });
  });

  it("renders return requests grouped by courier (data.groups[].orders) — fix3 CODE-09", async () => {
    apiGetMock.mockResolvedValue(
      mockEnvelope({
        total: 2,
        groups: [
          { courier_id: "56", courier: { id: "56", name: "Kuryer Ali" }, orders: [{ id: "9001", status: "waiting" }] },
          { courier_id: null, courier: null, orders: [{ id: "9002", status: "waiting" }] },
        ],
      }),
    );
    renderWithProviders(<LogisticsOpsPage />);

    expect(await screen.findAllByText("9001")).not.toHaveLength(0);
    expect(screen.getAllByText("9002")).not.toHaveLength(0);
    expect(screen.getByText("Kuryer Ali")).toBeInTheDocument();
  });

  it("v2: `/returns` ichida — o'z sarlavhasi yo'q; holat yorliqlari (maket), tanlov paneli va «Tanlovni bekor qilish»", async () => {
    const user = userEvent.setup();
    apiGetMock.mockResolvedValue(
      mockEnvelope({
        total: 2,
        groups: [
          {
            courier_id: "56",
            courier: { id: "56", name: "Kuryer Ali" },
            orders: [
              { id: "9001", status: "waiting" },
              { id: "9002", status: "on the road" },
            ],
          },
        ],
      }),
    );
    renderWithProviders(<LogisticsOpsPage />);

    expect(screen.queryByRole("link", { name: /Ops vositalari/ })).toBeNull();
    expect(await screen.findByText("Kuryer qabul qilmagan")).toBeInTheDocument();
    expect(screen.getByText("Kuryer qo'lida")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "№9001" })).toHaveAttribute("href", "/orders/edit/9001");

    await user.click(screen.getByRole("checkbox", { name: "So'rov 9001 ni tanlash" }));
    const region = screen.getByRole("region", { name: "Tanlangan so'rovlar" });
    expect(region).toHaveTextContent("1 ta so'rov tanlandi");
    await user.click(screen.getByRole("button", { name: "Tanlovni bekor qilish" }));
    expect(screen.getByRole("checkbox", { name: "So'rov 9001 ni tanlash" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Tasdiqlash — 0 ta" })).toBeDisabled();
  });

  it("so'rov rad etildi (ro'yxat 400) — xato holati i18n matni bilan, xom backend matni yo'q", async () => {
    apiGetMock.mockRejectedValue(mockRejection(400));
    renderWithProviders(<LogisticsOpsPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Qaytarish so'rovlarini yuklab bo'lmadi");
    expect(alert).toHaveTextContent("So'rov bajarilmadi (400).");
    expectNoRawBackendText();
  });
});
