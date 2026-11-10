import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import NewOrdersHeader from "./NewOrdersHeader";

/**
 * «Qabul va yaratish» sarlavhasi — BUGUNGI QABUL VAQTI (2026-11-08): superadmin uchun Ops → «Kun tartibi» havolasi
 * (2026-11-10; vaqtni qo'yish, kun almashishi — o'sha tabda, testlari `pages/daily-schedule`), boshqa rollar (admin
 * ham) holatni ko'radi. Backend endpointi yo'q (404) — hech narsa ko'rinmaydi.
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

  it("⭐ superadmin (2026-11-10): oyna emas — Ops → «Kun tartibi» havolasi, yorliq holatga qarab", async () => {
    mocks.get.mockResolvedValue(intake(null));
    const first = renderHeader("superadmin");
    const unlimited = await screen.findByRole("link", { name: /Bugungi qabul: cheklovsiz/ });
    expect(unlimited).toHaveAttribute("href", "/ops?tab=daily-schedule");
    expect(unlimited).toHaveAttribute("data-testid", "order-intake-control");
    first.unmount();

    mocks.get.mockResolvedValue(intake("10:00"));
    const second = renderHeader("superadmin");
    expect(await screen.findByRole("link", { name: /Bugungi qabul: 10:00 gacha/ })).toHaveAttribute(
      "href",
      "/ops?tab=daily-schedule",
    );
    second.unmount();

    mocks.get.mockResolvedValue(intake("10:00", { is_open: false }));
    renderHeader("superadmin");
    expect(await screen.findByRole("link", { name: /Bugungi qabul yopildi/ })).toBeInTheDocument();
    // Sarlavhada tahrirlash yo'q: oyna ochilmaydi, PATCH ketmaydi.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.patch).not.toHaveBeenCalled();
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

  it("⭐ admin (2026-11-09): o'zgartira olmaydi — tugma yo'q, faqat holat belgisi; cheklovsiz — hech narsa", async () => {
    mocks.get.mockResolvedValue(intake("10:00"));
    const first = renderHeader("admin");
    expect(await screen.findByTestId("order-intake-status")).toHaveTextContent(
      "Bugungi qabul: 10:00 gacha",
    );
    expect(screen.queryByTestId("order-intake-control")).toBeNull();
    expect(screen.queryByRole("button", { name: /Bugungi qabul/ })).toBeNull();
    first.unmount();

    mocks.get.mockResolvedValue(intake(null));
    renderHeader("admin");
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("order-intake-control")).toBeNull();
    expect(screen.queryByTestId("order-intake-status")).toBeNull();
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});
