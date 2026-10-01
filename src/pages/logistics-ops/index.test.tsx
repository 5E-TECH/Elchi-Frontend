import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import LogisticsOpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

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
    apiGetMock.mockResolvedValue({ data: [] });
    apiPostMock.mockResolvedValue({ data: {} });
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
    apiGetMock.mockResolvedValue({
      data: {
        statusCode: 200,
        data: { total: 1, groups: [{ courier_id: "56", courier: { id: "56", name: "Kuryer Ali" }, orders: [{ id: "9001", status: "waiting" }] }] },
      },
    });
    renderWithProviders(<LogisticsOpsPage />);

    await screen.findByText("Kuryer Ali");
    // [0] — "hammasini tanlash", [1] — 9001 qatori.
    await user.click(screen.getAllByRole("checkbox")[1]);
    await user.click(screen.getByRole("button", { name: "Tasdiqlash (1)" }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith("post/return-requests/approve", { order_ids: ["9001"] });
    });
  });

  it("renders return requests grouped by courier (data.groups[].orders) — fix3 CODE-09", async () => {
    apiGetMock.mockResolvedValue({
      data: {
        statusCode: 200,
        data: {
          total: 2,
          groups: [
            { courier_id: "56", courier: { id: "56", name: "Kuryer Ali" }, orders: [{ id: "9001", status: "waiting" }] },
            { courier_id: null, courier: null, orders: [{ id: "9002", status: "waiting" }] },
          ],
        },
      },
    });
    renderWithProviders(<LogisticsOpsPage />);

    expect(await screen.findAllByText("9001")).not.toHaveLength(0);
    expect(screen.getAllByText("9002")).not.toHaveLength(0);
    expect(screen.getByText("Kuryer Ali")).toBeInTheDocument();
  });
});
