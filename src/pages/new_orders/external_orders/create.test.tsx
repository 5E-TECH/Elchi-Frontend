import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExternalIntegrationCreatePage from "./create";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * Eski manba yaratish (/integrations/sources/create): avtorizatsiya turi backend kontraktida (`login` | `api_key`),
 * token `credentials.api_key` da — backend kalitni faqat shu yerdan o'qiydi.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api }));

const adminState = {
  role: { id: "admin-1", role: "superadmin", region: null, name: "Admin" },
} as never;

beforeEach(() => {
  api.get.mockReset().mockImplementation((url: string) => {
    if (url === "markets")
      return Promise.resolve({ data: { data: { items: [{ id: "12", name: "Baraka Shop" }] } } });
    return Promise.resolve({ data: {} });
  });
  api.post.mockReset().mockResolvedValue({ data: { statusCode: 201, data: { id: "9" } } });
});

const render = () =>
  renderWithProviders(<ExternalIntegrationCreatePage />, {
    route: "/integrations/sources/create",
    preloadedState: adminState,
  });

type User = ReturnType<typeof userEvent.setup>;

const fillBasics = async (user: User) => {
  await user.type(screen.getByRole("textbox", { name: "Integratsiya nomi" }), "Baraka API");
  await user.click(screen.getByRole("combobox", { name: "Market" }));
  await user.click(await screen.findByRole("option", { name: "Baraka Shop" }));
  await user.type(
    screen.getByRole("textbox", { name: "API manzili" }),
    "https://api.baraka.uz/orders",
  );
};

describe("Eski manba yaratish — avtorizatsiya", () => {
  it("sukut «Login va parol» → `auth_type: login`, login/parol `credentials` da", async () => {
    const user = userEvent.setup();
    render();
    await fillBasics(user);

    const authType = screen.getByRole("combobox", { name: "Avtorizatsiya turi" });
    expect(authType).toHaveTextContent("Login va parol");
    await user.click(authType);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Login va parol",
      "Token",
    ]);
    await user.keyboard("{Escape}");

    await user.type(screen.getByRole("textbox", { name: "Login" }), "elchi_sync");
    await user.type(screen.getByLabelText("Parol"), "Parol123");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][0]).toBe("integrations");
    expect(api.post.mock.calls[0][1]).toMatchObject({
      name: "Baraka API",
      slug: "baraka-api",
      type: "api",
      base_url: "https://api.baraka.uz/orders",
      market_id: "12",
      auth_type: "login",
      credentials: { username: "elchi_sync", password: "Parol123" },
    });
  });

  it("«Token» → `auth_type: api_key`, token `credentials.api_key` da (`token` emas)", async () => {
    const user = userEvent.setup();
    render();
    await fillBasics(user);

    await user.click(screen.getByRole("combobox", { name: "Avtorizatsiya turi" }));
    await user.click(await screen.findByRole("option", { name: "Token" }));
    expect(screen.queryByRole("textbox", { name: "Login" })).not.toBeInTheDocument();
    expect(screen.getByText("Bo'sh qoldirilsa, so'rovlar tokensiz yuboriladi")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Token"), "tok_123");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const payload = api.post.mock.calls[0][1] as {
      auth_type: string;
      credentials: Record<string, string>;
    };
    expect(payload.auth_type).toBe("api_key");
    expect(payload.credentials).toEqual({ api_key: "tok_123" });
  });
});
