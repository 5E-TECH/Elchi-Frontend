import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import NewOrdersHeader from "./NewOrdersHeader";

/**
 * «Qabul va yaratish» sarlavhasi — BUGUNGI QABUL VAQTI (2026-11-08): admin vaqtni qo'yadi / olib tashlaydi,
 * boshqa rollar holatni ko'radi. Backend endpointi hali yo'q (404) — hech narsa ko'rinmaydi.
 */
const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: { get: mocks.get, patch: mocks.patch } }));

const intake = (cutoff: string | null, extra: Record<string, unknown> = {}) => ({
  data: {
    statusCode: 200,
    data: {
      cutoff_time: cutoff,
      is_open: true,
      closes_at: cutoff ? "2099-01-01T05:00:00.000Z" : null,
      reopens_at: cutoff ? "2099-01-01T19:00:00.000Z" : null,
      ...extra,
    },
  },
});
const notFound = () =>
  Object.assign(new Error("Not Found"), { response: { status: 404, data: {} } });

const renderHeader = (role: string) =>
  renderWithProviders(<NewOrdersHeader />, {
    route: "/new-orders",
    preloadedState: { role: { id: "1", role, region: null, name: role } } as never,
  });

beforeEach(() => {
  mocks.get.mockReset();
  mocks.patch.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("Bugungi qabul vaqti — sarlavha", () => {
  it("⭐ backend endpointi yo'q (404) — boshqaruv ham, belgi ham yo'q; «Buyurtma yaratish» avvalgidek", async () => {
    mocks.get.mockRejectedValue(notFound());
    renderHeader("superadmin");

    expect(await screen.findByRole("link", { name: /Buyurtma yaratish/ })).toBeInTheDocument();
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("orders/intake-settings"));
    expect(screen.queryByTestId("order-intake-control")).toBeNull();
    expect(screen.queryByText(/Bugungi qabul/)).toBeNull();
  });

  it('⭐ superadmin: «cheklovsiz» → oyna → «1000» → «10:00» → Saqlash → `PATCH { cutoff_time: "10:00" }`, yorliq yangilanadi', async () => {
    const user = userEvent.setup();
    mocks.get.mockResolvedValue(intake(null));
    mocks.patch.mockResolvedValue(intake("10:00"));
    renderHeader("superadmin");

    await user.click(await screen.findByRole("button", { name: /Bugungi qabul: cheklovsiz/ }));
    const dialog = await screen.findByRole("dialog", { name: "Bugungi qabul vaqti" });
    expect(dialog).toHaveTextContent(
      "barcha rollar uchun: qo'lda, AI bilan va integratsiyalar orqali",
    );
    const field = within(dialog).getByRole("textbox", { name: /Qabul tugaydigan vaqt/ });
    await user.type(field, "1000");
    expect(field).toHaveValue("10:00");
    // Cheklov yo'q — «Cheklovni olib tashlash» ham yo'q.
    expect(within(dialog).queryByRole("button", { name: "Cheklovni olib tashlash" })).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("orders/intake-settings", { cutoff_time: "10:00" }),
    );
    expect(await screen.findByText("Bugungi qabul 10:00 gacha")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /Bugungi qabul: 10:00 gacha/ })).toBeInTheDocument();
  });

  it("noto'g'ri vaqt — maydon ostida xato, so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    mocks.get.mockResolvedValue(intake(null));
    renderHeader("admin");

    await user.click(await screen.findByRole("button", { name: /Bugungi qabul: cheklovsiz/ }));
    const dialog = await screen.findByRole("dialog", { name: "Bugungi qabul vaqti" });
    await user.type(within(dialog).getByRole("textbox", { name: /Qabul tugaydigan vaqt/ }), "99");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    expect(
      await within(dialog).findByText("Vaqtni 00:00–23:59 ko'rinishida kiriting"),
    ).toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("cheklov bor — «Cheklovni olib tashlash» → `PATCH { cutoff_time: null }`", async () => {
    const user = userEvent.setup();
    mocks.get.mockResolvedValue(intake("10:00"));
    mocks.patch.mockResolvedValue(intake(null));
    renderHeader("superadmin");

    await user.click(await screen.findByRole("button", { name: /Bugungi qabul: 10:00 gacha/ }));
    const dialog = await screen.findByRole("dialog", { name: "Bugungi qabul vaqti" });
    expect(within(dialog).getByRole("textbox", { name: /Qabul tugaydigan vaqt/ })).toHaveValue(
      "10:00",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cheklovni olib tashlash" }));

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("orders/intake-settings", { cutoff_time: null }),
    );
    expect(await screen.findByText("Bugungi qabul cheklovi olib tashlandi")).toBeInTheDocument();
  });

  it("market: cheklov bor — faqat holat belgisi («… gacha» / «yopildi»), tugma yo'q; cheklovsiz — hech narsa", async () => {
    mocks.get.mockResolvedValue(intake("10:00"));
    const first = renderHeader("market");
    expect(await screen.findByTestId("order-intake-status")).toHaveTextContent(
      "Bugungi qabul: 10:00 gacha",
    );
    expect(screen.queryByTestId("order-intake-control")).toBeNull();
    first.unmount();

    mocks.get.mockResolvedValue(intake("10:00", { is_open: false }));
    const second = renderHeader("market");
    expect(await screen.findByTestId("order-intake-status")).toHaveTextContent(
      "Bugungi qabul yopildi",
    );
    second.unmount();

    mocks.get.mockResolvedValue(intake(null));
    renderHeader("manager");
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(3));
    expect(screen.queryByTestId("order-intake-status")).toBeNull();
  });
});
