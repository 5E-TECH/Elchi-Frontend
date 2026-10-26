import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
  refreshAccessToken: vi.fn(),
}));
vi.mock("../../shared/api/api", () => ({
  api: { get: mocks.get, patch: mocks.patch, post: mocks.post, delete: mocks.delete },
}));
vi.mock("../../auth/authService", () => ({ refreshAccessToken: mocks.refreshAccessToken }));

import PasswordChangePrompt from "./PasswordChangePrompt";
import {
  clearPasswordChangeFlag,
  isPasswordChangePromptOpen,
  syncPasswordChangeFlag,
} from "../../auth/passwordChange";

const authed = (role: string) =>
  ({
    user: {
      user: { id: "1", name: "Jasur Kuryer", phone_number: "+998901112233", role },
      accessToken: "tok",
      isAuthenticated: true,
      loading: false,
      error: null,
      isAppInitializing: false,
    },
    role: { id: "1", role, region: null, name: "Jasur Kuryer" },
  }) as never;

const passwordPatches = () =>
  mocks.patch.mock.calls.filter(([url]) => url === "auth/my-profile").map(([, body]) => body);

describe("«Yangi parol o'rnating» (NDmZMzCP must_change_password)", () => {
  beforeEach(() => {
    clearPasswordChangeFlag();
    window.sessionStorage.clear();
    mocks.get.mockReset().mockResolvedValue({ data: { data: [] } });
    mocks.patch.mockReset().mockResolvedValue({
      data: { statusCode: 200, data: { id: "1", name: "Jasur Kuryer", phone_number: "+998901112233", role: "market" } },
    });
    mocks.refreshAccessToken.mockReset().mockResolvedValue("new-token");
  });

  afterEach(() => clearPasswordChangeFlag());

  it("bayroqsiz hech narsa chizilmaydi", () => {
    renderWithProviders(<PasswordChangePrompt />, { preloadedState: authed("courier") });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("bayroq bilan oyna; kuryer uchun 10 belgi qoidasi; «Keyinroq» — yopiladi va qayta chiqmaydi", async () => {
    act(() => syncPasswordChangeFlag({ must_change_password: true }));
    renderWithProviders(<PasswordChangePrompt />, { preloadedState: authed("courier") });

    const dialog = await screen.findByRole("dialog", { name: "Yangi parol o'rnating" });
    expect(
      within(dialog).getByText(/Joriy parolingiz yangi xavfsizlik talablariga mos emas/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Kamida 10 ta belgi\. Oddiy/)).toBeInTheDocument();

    const [first, second] = within(dialog).getAllByPlaceholderText(/parol/i);
    await userEvent.type(first, "Namuna123");
    await userEvent.type(second, "Namuna123");
    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));
    expect(within(dialog).getByText("Parol kamida 10 ta belgidan iborat bo'lsin")).toBeInTheDocument();
    expect(passwordPatches()).toEqual([]);

    await userEvent.click(within(dialog).getByRole("button", { name: "Keyinroq" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    act(() => syncPasswordChangeFlag({ must_change_password: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("saqlansa: PATCH auth/my-profile { password } → POST auth/refresh → bayroq tozalanadi, oyna yopiladi", async () => {
    act(() => syncPasswordChangeFlag({ must_change_password: true }));
    renderWithProviders(<PasswordChangePrompt />, { preloadedState: authed("market") });

    const dialog = await screen.findByRole("dialog", { name: "Yangi parol o'rnating" });
    expect(within(dialog).getByText(/Kamida 8 ta belgi\. Oddiy/)).toBeInTheDocument();
    const [first, second] = within(dialog).getAllByPlaceholderText(/parol/i);
    await userEvent.type(first, "Bozor-2026x");
    await userEvent.type(second, "Bozor-2026x");
    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));

    await waitFor(() => expect(passwordPatches()).toEqual([{ password: "Bozor-2026x" }]));
    await waitFor(() => expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(isPasswordChangePromptOpen()).toBe(false);
    expect(await screen.findByText("Yangi parol o'rnatildi")).toBeInTheDocument();
  });

  it("server siyosat bo'yicha rad etsa (400) — o'zbekcha matn maydon ostida, oyna ochiq qoladi", async () => {
    mocks.patch.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { statusCode: 400, message: ["Parol juda oddiy — boshqa parol tanlang"] } },
    });
    act(() => syncPasswordChangeFlag({ must_change_password: true }));
    renderWithProviders(<PasswordChangePrompt />, { preloadedState: authed("market") });

    const dialog = await screen.findByRole("dialog", { name: "Yangi parol o'rnating" });
    const [first, second] = within(dialog).getAllByPlaceholderText(/parol/i);
    await userEvent.type(first, "qwerty123");
    await userEvent.type(second, "qwerty123");
    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));

    expect(await within(dialog).findAllByText("Parol juda oddiy — boshqa parol tanlang")).not.toHaveLength(0);
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
    expect(isPasswordChangePromptOpen()).toBe(true);
  });
});
