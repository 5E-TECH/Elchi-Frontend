import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginForm from "./LoginForm";
import { renderWithProviders } from "../../../test/test-utils";
import { clearLoginNotice, peekLoginNotice, rememberLoginNotice } from "../../../auth/loginNotice";
import i18n from "../../../i18n";

/**
 * fix3b RBAC-09 — o'z parolini o'zgartirib chiqarilgan foydalanuvchiga login
 * sahifasida sabab BIR MARTA ko'rsatiladi (chiqish sahifani qayta yuklaydi —
 * bildirishnoma yo'qoladi, sabab sessionStorage orqali o'tadi).
 */

vi.mock("../api/login", () => ({
  useLogin: () => ({ signinUser: { mutate: vi.fn(), isPending: false } }),
}));

describe("LoginForm — 'Parol o'zgardi' xabari (fix3b RBAC-09)", () => {
  afterEach(async () => {
    clearLoginNotice();
    await i18n.changeLanguage("uz");
  });

  it("parol o'zgargandan keyingi chiqishda xabar ko'rinadi va bir martalik", () => {
    rememberLoginNotice("passwordChanged");
    const first = renderWithProviders(<LoginForm />);

    expect(screen.getByRole("status")).toHaveTextContent("Parol o'zgardi — qayta kiring");
    expect(peekLoginNotice()).toBeNull();

    first.unmount();
    renderWithProviders(<LoginForm />);
    expect(screen.queryByText("Parol o'zgardi — qayta kiring")).not.toBeInTheDocument();
  });

  it("oddiy kirishda xabar yo'q", () => {
    renderWithProviders(<LoginForm />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("rus tilida ham ko'rinadi", async () => {
    await i18n.changeLanguage("ru");
    rememberLoginNotice("passwordChanged");
    renderWithProviders(<LoginForm />);

    expect(screen.getByRole("status")).toHaveTextContent("Пароль изменён — войдите снова");
  });
});
