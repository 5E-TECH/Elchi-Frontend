import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { aiApiGet } from "../../../test/aiOrderFixtures";

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({
  api: { post: mocks.post, get: mocks.get, patch: vi.fn(), delete: vi.fn() },
}));

import OrderCreate from "./index";

/**
 * /new-orders/create — BUGUNGI QABUL VAQTI (2026-11-08): qabul yopiq bo'lsa ogohlantirish, qo'lda va AI bilan
 * yaratish to'siladi; cheklov bor, lekin ochiq — ma'lumot. Backend endpointi yo'q (404) — sahifa avvalgidek.
 */
const marketState = {
  role: { id: "7", role: "market", region: null, name: "Test market" },
} as never;

const intakeResponse = (data: Record<string, unknown>) =>
  Promise.resolve({ data: { statusCode: 200, data } });
const withIntake = (intake: () => Promise<unknown>) => (url: string) =>
  url === "orders/intake-settings" ? intake() : aiApiGet(url);

const CLOSED = {
  cutoff_time: "10:00",
  is_open: false,
  closes_at: "2026-11-08T05:00:00.000Z",
  reopens_at: "2099-11-08T19:00:00.000Z",
};

const pickOption = async (
  user: ReturnType<typeof userEvent.setup>,
  comboboxId: string,
  option: string,
) => {
  const combobox = document.getElementById(comboboxId) as HTMLElement;
  await waitFor(() => expect(combobox).toBeEnabled());
  await user.click(combobox);
  await user.click(await screen.findByRole("option", { name: option }));
};

/** Market: 2-qadam formasini to'ldiradi (xulosa «tayyor» bo'ladigan holat). */
const fillOrder = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole("combobox", { name: /^Telefon/ }), "901234567");
  await user.type(screen.getByLabelText(/^Mijoz ismi/), "Aliyev Vali");
  await pickOption(user, "customer.region_id", "Toshkent shahri • 1726");
  await pickOption(user, "customer.district_id", "Chilonzor • 1726269");
  await user.click(await screen.findByRole("button", { name: /Telefon ushlagich/ }));
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  mocks.get.mockReset();
  mocks.post.mockReset();
  mocks.post.mockResolvedValue({ data: { statusCode: 201, data: { id: "o1" } } });
});

describe("OrderCreate — bugungi qabul vaqti", () => {
  it("⭐ qabul yopiq — «Bugungi qabul yopildi» (10:00, kun almashgach), to'liq forma bilan ham «Buyurtma yaratish» o'chiq, POST yo'q", async () => {
    mocks.get.mockImplementation(withIntake(() => intakeResponse(CLOSED)));
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    const alert = await screen.findByTestId("intake-closed");
    expect(alert).toHaveTextContent("Bugungi qabul yopildi");
    expect(alert).toHaveTextContent("Qabul 10:00 da yopilgan. Yangi buyurtmani kun almashgach");

    await fillOrder(user);
    const aside = screen.getByRole("complementary", { name: "Buyurtma xulosasi" });
    const submit = within(aside).getByRole("button", { name: "Buyurtma yaratish" });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("cheklov bor, hali ochiq — ma'lumot «Bugungi qabul 10:00 gacha …», yaratish ishlaydi", async () => {
    mocks.get.mockImplementation(
      withIntake(() =>
        intakeResponse({
          cutoff_time: "10:00",
          is_open: true,
          closes_at: "2099-11-08T05:00:00.000Z",
          reopens_at: "2099-11-08T19:00:00.000Z",
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    expect(await screen.findByTestId("intake-until")).toHaveTextContent(
      "Bugungi qabul 10:00 gacha — shundan keyin kun almashguncha yangi buyurtma yaratib bo'lmaydi.",
    );
    expect(screen.queryByTestId("intake-closed")).toBeNull();
    await fillOrder(user);
    await user.click(screen.getByRole("button", { name: "Buyurtma yaratish" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("orders", expect.anything(), expect.anything()),
    );
  });

  it("backend endpointi yo'q (404) — ogohlantirish yo'q, yaratish avvalgidek", async () => {
    mocks.get.mockImplementation(
      withIntake(() =>
        Promise.reject(Object.assign(new Error("Not Found"), { response: { status: 404 } })),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await fillOrder(user);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("orders/intake-settings"));
    expect(screen.queryByTestId("intake-closed")).toBeNull();
    expect(screen.queryByTestId("intake-until")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Buyurtma yaratish" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("orders", expect.anything(), expect.anything()),
    );
  });

  it("⭐ shu orada yopildi — `409 ORDER_INTAKE_CLOSED`: «Bugungi qabul yopildi» xato va holat qayta so'raladi", async () => {
    let intakeCalls = 0;
    mocks.get.mockImplementation(
      withIntake(() => {
        intakeCalls += 1;
        return intakeResponse(intakeCalls === 1 ? { cutoff_time: null, is_open: true } : CLOSED);
      }),
    );
    mocks.post.mockRejectedValue({
      response: {
        status: 409,
        data: { statusCode: 409, code: "ORDER_INTAKE_CLOSED", message: "Order intake is closed" },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await fillOrder(user);
    await user.click(screen.getByRole("button", { name: "Buyurtma yaratish" }));

    const alert = await within(screen.getByTestId("manual-mode-panel")).findByRole("alert");
    expect(alert).toHaveTextContent("Bugungi qabul yopildi");
    expect(alert).not.toHaveTextContent("Order intake is closed");
    expect(await screen.findByTestId("intake-closed")).toBeInTheDocument();
    expect(intakeCalls).toBeGreaterThanOrEqual(2);
  });
});
