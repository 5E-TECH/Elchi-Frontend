import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/test-utils";
import AssignOperatorDialog from "./AssignOperatorDialog";

/**
 * 2026-11-16 «Operator biriktirish» oynasi: ro'yxat — `GET /market-operators/selectable` (buyurtma marketi; market
 * rolida — o'zi), tanlansa `PUT orders/:id/operator { operator_id }`. Bo'sh ro'yxat — tushuntirish, tugma o'chiq;
 * backend xatosi oynada qoladi.
 */
const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, put: mocks.put, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const SELECTABLE = "market-operators/selectable";
const ok = (data: unknown) => Promise.resolve({ data: { statusCode: 200, message: "ok", data } });
const OPERATORS = [
  { id: "412", name: "Aziza Karimova" },
  { id: "413", name: "Dilnoza Rahimova" },
];

const conflict = (message: string, code: string) =>
  Object.assign(new Error(message), { isAxiosError: true, response: { status: 409, data: { message, code } } });

const renderDialog = (props: Partial<Parameters<typeof AssignOperatorDialog>[0]> = {}) => {
  const onClose = vi.fn();
  const onDone = vi.fn();
  renderWithProviders(
    <AssignOperatorDialog
      open
      orderId="95"
      orderNumber="EL-100095"
      marketId="37"
      role="admin"
      onClose={onClose}
      onDone={onDone}
      {...props}
    />,
  );
  return { onClose, onDone };
};

const pick = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  const combobox = await screen.findByRole("combobox", { name: "Operator" });
  await waitFor(() => expect(combobox).toBeEnabled());
  await user.click(combobox);
  await user.click(await screen.findByRole("option", { name }));
};

describe("AssignOperatorDialog", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.put.mockReset();
    mocks.get.mockImplementation((url: string) => (url === SELECTABLE ? ok({ items: OPERATORS }) : ok(null)));
  });

  it("⭐ xodim: buyurtma marketi operatorlari, tanlab biriktiradi — PUT, onDone, yopiladi", async () => {
    mocks.put.mockReturnValue(
      ok({ id: "95", operator_id: "412", operator: "Aziza Karimova", earning_recorded: false }),
    );
    const user = userEvent.setup();
    const { onClose, onDone } = renderDialog();

    expect(screen.getByTestId("assign-operator-dialog")).toHaveTextContent("#EL-100095");
    await pick(user, "Aziza Karimova");
    await user.click(screen.getByTestId("assign-operator-submit"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(mocks.put).toHaveBeenCalledWith("orders/95/operator", { operator_id: "412" });
    expect(mocks.get).toHaveBeenCalledWith(SELECTABLE, { params: { market_id: "37" } });
  });

  it("market roli — ro'yxat o'z tokenidan (`market_id` yuborilmaydi)", async () => {
    renderDialog({ role: "market" });
    await screen.findByRole("combobox", { name: "Operator" });
    await waitFor(() => expect(mocks.get).toHaveBeenCalled());
    const [url, config] = mocks.get.mock.calls[0] as [string, { params?: Record<string, unknown> } | undefined];
    expect(url).toBe(SELECTABLE);
    expect(config?.params?.market_id).toBeUndefined();
  });

  it("tanlanmaguncha tugma o'chiq, so'rov ketmaydi", async () => {
    renderDialog();
    await screen.findByRole("combobox", { name: "Operator" });
    expect(screen.getByTestId("assign-operator-submit")).toBeDisabled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("⭐ marketda faol operator yo'q — tushuntirish, tugma o'chiq", async () => {
    mocks.get.mockImplementation(() => ok({ items: [] }));
    renderDialog();
    expect(await screen.findByTestId("assign-operator-empty")).toHaveTextContent("faol operator yo'q");
    expect(screen.getByTestId("assign-operator-submit")).toBeDisabled();
  });

  it("409 (operator allaqachon bor) — xabar oynada, oyna ochiq", async () => {
    mocks.put.mockRejectedValue(
      conflict("Bu buyurtmaga operator allaqachon biriktirilgan", "ORDER_OPERATOR_ALREADY_ASSIGNED"),
    );
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await pick(user, "Dilnoza Rahimova");
    await user.click(screen.getByTestId("assign-operator-submit"));

    expect(await screen.findByTestId("assign-operator-error")).toHaveTextContent(
      "Bu buyurtmaga operator allaqachon biriktirilgan",
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
