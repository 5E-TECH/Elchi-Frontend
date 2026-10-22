import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { vi } from "vitest";
import LoginForm from "./LoginForm";
import { renderWithProviders } from "../../../test/test-utils";

const navigateMock = vi.fn();
// Haqiqiy `useMutation` (holat — `isPending` — ilovadagidek), so'rov funksiyasi — soxta.
const loginFn = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../api/login", async () => {
  const { useMutation } = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    useLogin: () => ({
      signinUser: useMutation({ mutationFn: (payload: unknown) => loginFn(payload) }),
    }),
  };
});

const phoneInput = () => screen.getByLabelText("Telefon raqam") as HTMLInputElement;
const passwordInput = () => screen.getByLabelText("Parol") as HTMLInputElement;
const submitButton = () => screen.getByRole("button", { name: "Kirish" });

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>, phone = "90 123 45 67", password = "1234") => {
  await user.type(phoneInput(), phone);
  await user.type(passwordInput(), password);
  await user.click(submitButton());
};

describe("LoginForm (dizayn v2: common-login, common-login-error)", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    loginFn.mockReset();
  });

  it("renders the v2 form: heading, labelled phone (+998 prefix) and password fields, one «Kirish» button", () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByRole("heading", { level: 1, name: "Tizimga kirish" })).toBeInTheDocument();
    expect(screen.getByText("Hisobingizga kirish uchun ma'lumotlarni kiriting")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Tizimga kirish" })).toBeInTheDocument();

    // e2e (`ai-order.mobile.spec.ts`) shu nomlarga tayanadi.
    expect(phoneInput()).toHaveAttribute("name", "elchi-login-phone");
    expect(phoneInput()).toHaveAttribute("type", "tel");
    expect(phoneInput()).toHaveAttribute("placeholder", "90 123 45 67");
    expect(phoneInput()).toHaveAccessibleDescription("Raqam +998 bilan boshlanadi");
    expect(screen.getByText("+998")).toBeInTheDocument();
    expect(passwordInput()).toHaveAttribute("name", "password");
    expect(passwordInput()).toHaveAttribute("type", "password");
    expect(passwordInput()).toHaveAttribute("placeholder", "Parolni kiriting");

    expect(screen.getAllByRole("button", { name: "Kirish" })).toHaveLength(1);
    expect(submitButton()).toHaveAttribute("type", "submit");
  });

  it("shows required errors for an empty submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.click(submitButton());

    expect(await screen.findByText("Telefon raqam shart")).toBeInTheDocument();
    expect(await screen.findByText("Parol shart")).toBeInTheDocument();
    expect(phoneInput()).toHaveAttribute("aria-invalid", "true");
    expect(loginFn).not.toHaveBeenCalled();
  });

  it("XsoWhKP5 782227: empty submit — password input aria-invalid, described by the v2 Field error text", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    expect(passwordInput()).not.toHaveAttribute("aria-invalid");
    await user.click(submitButton());

    const passwordError = (await screen.findByText("Parol shart")).parentElement!;
    expect(passwordError.id).toBeTruthy();
    expect(passwordInput()).toHaveAttribute("aria-invalid", "true");
    expect(passwordInput().getAttribute("aria-describedby")?.split(" ")).toContain(passwordError.id);
    expect(passwordInput()).toHaveAttribute("aria-errormessage", passwordError.id);
    expect(passwordInput()).toHaveAccessibleDescription("Parol shart");
    // Telefon: xato birinchi o'qiladi, «+998» izohi saqlanadi.
    const phoneError = screen.getByText("Telefon raqam shart").parentElement!;
    expect(phoneInput().getAttribute("aria-describedby")?.split(" ")[0]).toBe(phoneError.id);
    expect(phoneInput()).toHaveAccessibleDescription("Telefon raqam shart Raqam +998 bilan boshlanadi");
  });

  it("XsoWhKP5 a4bfc3: empty submit moves focus to the first invalid field (phone); then to password once phone is valid", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.click(submitButton());
    await waitFor(() => expect(phoneInput()).toHaveFocus());

    await user.type(phoneInput(), "901234567");
    await user.click(submitButton());
    await waitFor(() => expect(passwordInput()).toHaveFocus());
    expect(passwordInput()).toHaveAttribute("aria-invalid", "true");
    expect(phoneInput()).not.toHaveAttribute("aria-invalid");
    expect(loginFn).not.toHaveBeenCalled();
  });

  it("XsoWhKP5 a4bfc3: the server error block is role=alert (announced), field errors are not alerts", async () => {
    const user = userEvent.setup();
    loginFn.mockRejectedValue({ response: { status: 401 } });
    renderWithProviders(<LoginForm />);

    await user.click(submitButton());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await fillAndSubmit(user);
    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent("Parol noto'g'ri yoki foydalanuvchi topilmadi");
  });

  it("shows phone format validation for an incomplete phone number", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await fillAndSubmit(user, "90123");

    expect(await screen.findByText("Format: +998 90 123 45 67")).toBeInTheDocument();
    expect(loginFn).not.toHaveBeenCalled();
  });

  it("submits a successful login with the +998XXXXXXXXX payload and navigates to the dashboard", async () => {
    const user = userEvent.setup();
    loginFn.mockResolvedValue({
      user: { id: "1", role: "admin", name: "Admin" },
      accessToken: "token",
    });

    renderWithProviders(<LoginForm />);

    await fillAndSubmit(user);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/"));
    expect(loginFn).toHaveBeenCalledTimes(1);
    expect(loginFn).toHaveBeenCalledWith({
      phone_number: "+998901234567",
      password: "1234",
    });
  });

  it("typing 9 bare digits (as the e2e does) sends +998 + those digits", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await fillAndSubmit(user, "900000001", "0990");

    expect(phoneInput()).toHaveValue("90 000 00 01");
    await waitFor(() => expect(loginFn).toHaveBeenCalledWith({ phone_number: "+998900000001", password: "0990" }));
  });

  it("401 → danger alert between heading and fields: mapped title + hint, form described by it", async () => {
    const user = userEvent.setup();
    loginFn.mockRejectedValue({
      response: {
        status: 401,
      },
    });

    renderWithProviders(<LoginForm />);

    await fillAndSubmit(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Parol noto'g'ri yoki foydalanuvchi topilmadi");
    expect(alert).toHaveTextContent("Telefon raqam va parolni tekshirib, qayta urinib ko'ring.");
    expect(screen.getByRole("form", { name: "Tizimga kirish" })).toHaveAttribute("aria-describedby", alert.id);
    // Tartib: sarlavha → xato → maydonlar.
    expect(screen.getByRole("heading", { level: 1 }).compareDocumentPosition(alert)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(alert.compareDocumentPosition(phoneInput())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("a network failure (no response) shows «Tarmoq xatoligi» without the credentials hint", async () => {
    const user = userEvent.setup();
    loginFn.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

    renderWithProviders(<LoginForm />);

    await fillAndSubmit(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Tarmoq xatoligi");
    expect(alert).not.toHaveTextContent("Network Error");
    expect(alert).not.toHaveTextContent("Telefon raqam va parolni tekshirib");
  });

  it("maps 500 to the server error text", async () => {
    const user = userEvent.setup();
    loginFn.mockRejectedValue({ response: { status: 500 } });

    renderWithProviders(<LoginForm />);

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Serverda xatolik yuz berdi");
  });

  it("while the request is pending the button shows «Kirilmoqda…» and a second submit sends nothing", async () => {
    const user = userEvent.setup();
    // Javob kelmaydi — so'rov kutilmoqda.
    loginFn.mockReturnValue(new Promise(() => undefined));

    renderWithProviders(<LoginForm />);

    await fillAndSubmit(user);

    const pending = await screen.findByRole("button", { name: "Kirilmoqda…" });
    expect(pending).toHaveAttribute("aria-busy", "true");
    expect(pending).toHaveAttribute("aria-disabled", "true");
    expect(phoneInput()).toHaveAttribute("readonly");

    await user.click(pending);
    await user.type(passwordInput(), "{Enter}");

    expect(loginFn).toHaveBeenCalledTimes(1);
  });

  it("the eye toggle shows/hides the password with aria-label, aria-pressed and aria-controls", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    const toggle = screen.getByRole("button", { name: "Parolni ko'rsatish" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("aria-controls", passwordInput().id);

    await user.click(toggle);

    expect(passwordInput()).toHaveAttribute("type", "text");
    const hide = screen.getByRole("button", { name: "Parolni yashirish" });
    expect(hide).toHaveAttribute("aria-pressed", "true");

    await user.click(hide);
    expect(passwordInput()).toHaveAttribute("type", "password");
  });
});
