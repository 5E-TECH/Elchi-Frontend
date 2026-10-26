import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import LoginForm from "./LoginForm";
import { renderWithProviders } from "../../../test/test-utils";

const navigateMock = vi.fn();
const loginFn = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../api/login", async () => {
  const { useMutation } = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    useLogin: () => ({ signinUser: useMutation({ mutationFn: (payload: unknown) => loginFn(payload) }) }),
  };
});

const submitButton = () => screen.getByRole("button", { name: "Kirish" });

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText("Telefon raqam"), "90 123 45 67");
  await user.type(screen.getByLabelText("Parol"), "notogri-parol");
  await user.click(submitButton());
};

const locked = (retryAfterSeconds: number) => ({
  response: {
    status: 429,
    headers: {},
    data: {
      statusCode: 429,
      code: "LOGIN_LOCKED",
      retry_after_seconds: retryAfterSeconds,
      message: "Juda ko'p noto'g'ri urinish — 4 daqiqadan keyin qayta urinib ko'ring",
    },
  },
});

describe("LoginForm — NDmZMzCP login qulfi (429 LOGIN_LOCKED)", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    loginFn.mockReset();
  });

  it("qulf xabari daqiqada (yuqoriga yaxlitlangan), «Kirish» qulf tugaguncha o'chiq", async () => {
    const user = userEvent.setup();
    loginFn.mockRejectedValue(locked(181));
    renderWithProviders(<LoginForm />);

    await fillAndSubmit(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Juda ko'p noto'g'ri urinish");
    expect(alert).toHaveTextContent("4 daqiqadan keyin qayta urinib ko'ring.");
    expect(submitButton()).toBeDisabled();
    await user.click(submitButton());
    expect(loginFn).toHaveBeenCalledTimes(1);
  });

  it("qulf vaqti o'tgach tugma yana ishlaydi; 1 daqiqadan kam qolganda ham «1 daqiqadan keyin»", async () => {
    const user = userEvent.setup();
    loginFn.mockRejectedValueOnce(locked(1)).mockResolvedValueOnce({ accessToken: "t", user: null });
    renderWithProviders(<LoginForm />);

    await fillAndSubmit(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("1 daqiqadan keyin qayta urinib ko'ring.");
    expect(submitButton()).toBeDisabled();

    await waitFor(() => expect(submitButton()).not.toBeDisabled(), { timeout: 2_500 });
    await user.click(submitButton());
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/"));
    expect(loginFn).toHaveBeenCalledTimes(2);
  });

  it("kodsiz 429 (gateway cheklovi) — avvalgi «Juda ko'p urinish» matni, tugma o'chirilmaydi", async () => {
    const user = userEvent.setup();
    loginFn.mockRejectedValue({ response: { status: 429, headers: {}, data: { message: "ThrottlerException" } } });
    renderWithProviders(<LoginForm />);

    await fillAndSubmit(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Juda ko'p urinish");
    expect(submitButton()).not.toBeDisabled();
  });

  it("review: qulf faqat o'sha raqamga — boshqa raqam yozilsa «Kirish» ishlaydi, qaytsa yana o'chiq", async () => {
    const user = userEvent.setup();
    loginFn.mockRejectedValueOnce(locked(240)).mockResolvedValueOnce({ accessToken: "t", user: null });
    renderWithProviders(<LoginForm />);

    await fillAndSubmit(user);
    await screen.findByRole("alert");
    expect(submitButton()).toBeDisabled();
    const lockedPhone = (loginFn.mock.calls[0][0] as { phone_number: string }).phone_number;

    const phone = screen.getByLabelText("Telefon raqam");
    await user.clear(phone);
    await user.type(phone, "91 765 43 21");
    expect(submitButton()).not.toBeDisabled();

    // Qulflangan raqamga qaytildi — yana o'chiq.
    await user.clear(phone);
    await user.type(phone, "90 123 45 67");
    expect(submitButton()).toBeDisabled();

    await user.clear(phone);
    await user.type(phone, "91 765 43 21");
    await user.click(submitButton());
    await waitFor(() => expect(loginFn).toHaveBeenCalledTimes(2));
    const second = (loginFn.mock.calls[1][0] as { phone_number: string }).phone_number;
    expect(second).not.toBe(lockedPhone);
    expect(second).toBe("+998917654321");
  });
});
