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
  logoutAndRedirect: vi.fn(),
}));
vi.mock("../../shared/api/api", () => ({
  api: { get: mocks.get, patch: mocks.patch, post: mocks.post, delete: mocks.delete },
}));
vi.mock("../../auth/authService", () => ({
  refreshAccessToken: mocks.refreshAccessToken,
  logoutAndRedirect: mocks.logoutAndRedirect,
}));

import PasswordChangePrompt from "./PasswordChangePrompt";
import {
  clearPasswordChangeFlag,
  isPasswordChangePromptOpen,
  requirePasswordChange,
  syncPasswordChangeFlag,
} from "../../auth/passwordChange";

/** Imzosiz soxta JWT (faqat payload o'qiladi). */
const fakeJwt = (payload: Record<string, unknown>) =>
  `x.${window.btoa(JSON.stringify(payload)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")}.y`;

/** aidsxJ2H: «Joriy parol» · «Yangi parol» · «Yangi parolni takrorlang». */
const passwordFields = (dialog: HTMLElement) => ({
  current: within(dialog).getByPlaceholderText("Joriy parolni kiriting"),
  first: within(dialog).getByPlaceholderText("Yangi parolni kiriting"),
  second: within(dialog).getByPlaceholderText("Parolni yana bir bor kiriting"),
});

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
    mocks.logoutAndRedirect.mockReset().mockResolvedValue(undefined);
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

    const { current, first, second } = passwordFields(dialog);
    await userEvent.type(current, "Eski-parol1");
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

  it("saqlansa: PATCH auth/my-profile { old_password, password } → POST auth/refresh → bayroq tozalanadi, oyna yopiladi", async () => {
    act(() => syncPasswordChangeFlag({ must_change_password: true }));
    renderWithProviders(<PasswordChangePrompt />, { preloadedState: authed("market") });

    const dialog = await screen.findByRole("dialog", { name: "Yangi parol o'rnating" });
    expect(within(dialog).getByText(/Kamida 8 ta belgi\. Oddiy/)).toBeInTheDocument();
    const { current, first, second } = passwordFields(dialog);
    await userEvent.type(current, "Eski-parol1");
    await userEvent.type(first, "Bozor-2026x");
    await userEvent.type(second, "Bozor-2026x");
    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));

    await waitFor(() => expect(passwordPatches()).toEqual([{ old_password: "Eski-parol1", password: "Bozor-2026x" }]));
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
    const { current, first, second } = passwordFields(dialog);
    await userEvent.type(current, "Eski-parol1");
    await userEvent.type(first, "qwerty123");
    await userEvent.type(second, "qwerty123");
    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));

    expect(await within(dialog).findAllByText("Parol juda oddiy — boshqa parol tanlang")).not.toHaveLength(0);
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
    expect(isPasswordChangePromptOpen()).toBe(true);
  });
  describe("aidsxJ2H — majburiy rejim (parolni admin / tizim bergan)", () => {
    it("token `pwd_forced` — oyna bloklovchi: «Keyinroq» / «Yopish» yo'q, Esc yopmaydi; «Chiqish» — logout", async () => {
      act(() =>
        syncPasswordChangeFlag({
          must_change_password: true,
          accessToken: fakeJwt({ id: "1", role: "courier", pwd_change: true, pwd_forced: true }),
        }),
      );
      renderWithProviders(<PasswordChangePrompt />, { preloadedState: authed("courier") });

      const dialog = await screen.findByRole("dialog", { name: "Yangi parol o'rnating" });
      expect(within(dialog).getByText(/vaqtinchalik parol bilan kirdingiz/)).toBeInTheDocument();
      expect(within(dialog).getByText("Joriy (vaqtinchalik) parol")).toBeInTheDocument();
      expect(within(dialog).getByText("SMS orqali kelgan yoki administrator bergan parol")).toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Keyinroq" })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Yopish" })).not.toBeInTheDocument();

      await userEvent.keyboard("{Escape}");
      expect(screen.getByRole("dialog", { name: "Yangi parol o'rnating" })).toBeInTheDocument();
      expect(isPasswordChangePromptOpen()).toBe(true);

      await userEvent.click(within(dialog).getByRole("button", { name: "Chiqish" }));
      await waitFor(() => expect(mocks.logoutAndRedirect).toHaveBeenCalledTimes(1));
    });

    it("403 PASSWORD_CHANGE_REQUIRED ham majburiy: saqlansa { old_password, password } → refresh → oyna yopiladi", async () => {
      act(() => requirePasswordChange());
      renderWithProviders(<PasswordChangePrompt />, { preloadedState: authed("courier") });

      const dialog = await screen.findByRole("dialog", { name: "Yangi parol o'rnating" });
      expect(within(dialog).queryByRole("button", { name: "Keyinroq" })).not.toBeInTheDocument();
      const { current, first, second } = passwordFields(dialog);
      await userEvent.type(current, "Vaqtinchalik9");
      await userEvent.type(first, "Ozimniki-2026");
      await userEvent.type(second, "Ozimniki-2026");
      await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));

      await waitFor(() =>
        expect(passwordPatches()).toEqual([{ old_password: "Vaqtinchalik9", password: "Ozimniki-2026" }]),
      );
      await waitFor(() => expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(isPasswordChangePromptOpen()).toBe(false);
      expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();
    });

    it("400 OLD_PASSWORD_INVALID — «Joriy parol» ostida, oyna ochiq, chiqarilmaydi", async () => {
      mocks.patch.mockRejectedValue({
        isAxiosError: true,
        response: { status: 400, data: { statusCode: 400, message: "Joriy parol noto'g'ri", code: "OLD_PASSWORD_INVALID" } },
      });
      act(() => requirePasswordChange());
      renderWithProviders(<PasswordChangePrompt />, { preloadedState: authed("market") });

      const dialog = await screen.findByRole("dialog", { name: "Yangi parol o'rnating" });
      const { current, first, second } = passwordFields(dialog);
      await userEvent.type(current, "Notogri-parol");
      await userEvent.type(first, "Bozor-2026x");
      await userEvent.type(second, "Bozor-2026x");
      await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));

      expect(await within(dialog).findByText("Joriy parol noto'g'ri")).toBeInTheDocument();
      expect(current).toHaveAttribute("aria-invalid", "true");
      expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
      expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();
      expect(isPasswordChangePromptOpen()).toBe(true);
    });
  });
});
