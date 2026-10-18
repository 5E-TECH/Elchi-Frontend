import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Login from "../index";
import SessionExpiredScreen from "./SessionExpiredScreen";
import { renderWithProviders } from "../../../test/test-utils";
import { clearLoginNotice, peekLoginNotice, rememberLoginNotice } from "../../../auth/loginNotice";
import i18n from "../../../i18n";

vi.mock("../api/login", () => ({
  useLogin: () => ({ signinUser: { mutate: vi.fn(), isPending: false } }),
}));

/** Bugun 14:15 (mahalliy vaqt) — `formatDateTimeLocalized` «Bugun, 14:15» beradi. */
const todayAt1415 = () => {
  const date = new Date();
  date.setHours(14, 15, 0, 0);
  return date.getTime();
};

describe("SessionExpiredScreen (dizayn v2: common-session-expired)", () => {
  afterEach(async () => {
    // Avval o'chiriladi: til almashishi o'rnatilgan komponentni `act` dan tashqarida qayta chizmasin.
    cleanup();
    clearLoginNotice();
    await i18n.changeLanguage("uz");
  });

  it("renders the mockup texts and the expiry time", () => {
    renderWithProviders(<SessionExpiredScreen expiredAt={todayAt1415()} onContinue={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Sessiya tugadi" })).toBeInTheDocument();
    expect(
      screen.getByText("Xavfsizlik uchun qayta kirishingiz kerak. Saqlangan ma'lumotlaringiz joyida qoladi."),
    ).toBeInTheDocument();
    expect(screen.getByText("Sessiya tugagan vaqt")).toBeInTheDocument();
    expect(screen.getByText("Bugun, 14:15")).toBeInTheDocument();
    expect(screen.getByText("Elchi CRM")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Elchi Pochta" })).toBeInTheDocument();
    // Footer (© 2026 Elchi Pochta) — ega qarori bilan chizilmaydi.
    expect(screen.queryByText(/©/)).not.toBeInTheDocument();
  });

  it("hides the time row when the expiry time is unknown", () => {
    renderWithProviders(<SessionExpiredScreen expiredAt={null} onContinue={vi.fn()} />);

    expect(screen.queryByText("Sessiya tugagan vaqt")).not.toBeInTheDocument();
  });

  it("«Qayta kirish» calls onContinue", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    renderWithProviders(<SessionExpiredScreen expiredAt={todayAt1415()} onContinue={onContinue} />);

    await user.click(screen.getByRole("button", { name: "Qayta kirish" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("russian texts", async () => {
    await i18n.changeLanguage("ru");
    renderWithProviders(<SessionExpiredScreen expiredAt={todayAt1415()} onContinue={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Сессия истекла" })).toBeInTheDocument();
    expect(screen.getByText("Сегодня, 14:15")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Войти снова" })).toBeInTheDocument();
  });
});

describe("/login — «Sessiya tugadi» oqimi", () => {
  afterEach(() => clearLoginNotice());

  it("after a session-expiry logout shows the screen once, then «Qayta kirish» opens the form (no reload)", async () => {
    const user = userEvent.setup();
    rememberLoginNotice("sessionExpired", { at: todayAt1415() });

    const first = renderWithProviders(<Login />, { route: "/login" });

    expect(screen.getByRole("heading", { level: 1, name: "Sessiya tugadi" })).toBeInTheDocument();
    expect(screen.getByText("Bugun, 14:15")).toBeInTheDocument();
    expect(screen.queryByLabelText("Telefon raqam")).not.toBeInTheDocument();
    // Bir martalik: o'qilgach o'chirildi.
    expect(peekLoginNotice()).toBeNull();

    await user.click(screen.getByRole("button", { name: "Qayta kirish" }));

    expect(screen.getByRole("heading", { level: 1, name: "Tizimga kirish" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Telefon raqam")).toHaveFocus());
    expect(screen.queryByText("Sessiya tugadi")).not.toBeInTheDocument();

    first.unmount();
    renderWithProviders(<Login />, { route: "/login" });
    expect(screen.getByRole("heading", { level: 1, name: "Tizimga kirish" })).toBeInTheDocument();
  });

  it("a plain logout (no notice) opens the form directly with the navy brand panel texts", () => {
    renderWithProviders(<Login />, { route: "/login" });

    expect(screen.getByRole("heading", { level: 1, name: "Tizimga kirish" })).toBeInTheDocument();
    expect(screen.queryByText("Sessiya tugadi")).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Elchi CRM" })).toHaveTextContent(
      "Buyurtmalarni kuzatish, pochta jo'natish va yetkazib berish — bitta joyda.",
    );
    expect(screen.queryByText(/©/)).not.toBeInTheDocument();
  });

  it("the passwordChanged notice keeps going to the form (not the session screen)", () => {
    rememberLoginNotice("passwordChanged");
    renderWithProviders(<Login />, { route: "/login" });

    expect(screen.queryByText("Sessiya tugadi")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Parol o'zgardi — qayta kiring");
  });

  it("a signed-in user is redirected away from /login", () => {
    renderWithProviders(<Login />, {
      route: "/login",
      preloadedState: {
        user: { isAuthenticated: true, isAppInitializing: false } as never,
      },
    });

    expect(screen.queryByRole("heading", { name: "Tizimga kirish" })).not.toBeInTheDocument();
  });
});
