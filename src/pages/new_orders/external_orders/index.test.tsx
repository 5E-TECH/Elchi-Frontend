import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExternalOrdersPage from "./index";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * Eski «Tashqi manbalar» (/integrations/sources, dizayn v2 — spec §9 «o'chirish `useConfirm`»): o'chirish avval
 * tasdiq so'raydi, «Bekor qilish» — so'rov yo'q, tasdiqdan keyin `DELETE integrations/:id`; tahrirlash —
 * `PATCH integrations/:id` (nom, slug, market, faollik shu oynadan).
 */

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api }));

const adminState = { role: { id: "admin-1", role: "superadmin", region: null, name: "Admin" } } as never;

const SOURCE = {
  id: "5",
  name: "Uzum Market",
  slug: "uzum",
  type: "api",
  role: "source",
  category: "marketplace",
  base_url: "https://api.uzum.uz",
  auth_type: "none",
  credentials: {},
  market_id: "12",
  is_active: true,
  createdAt: "2026-09-10T00:00:00.000Z",
};

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    /* xotira yopiq */
  }
  api.get.mockReset().mockImplementation((url: string) => {
    if (url === "integrations") {
      return Promise.resolve({ data: { statusCode: 200, data: { items: [SOURCE], meta: { total: 1, page: 1, limit: 10 } } } });
    }
    if (url === "markets") return Promise.resolve({ data: { data: { items: [{ id: "12", name: "Baraka Shop" }] } } });
    return Promise.resolve({ data: {} });
  });
  api.delete.mockReset().mockResolvedValue({ data: { statusCode: 200 } });
  api.patch.mockReset().mockResolvedValue({ data: { statusCode: 200, data: SOURCE } });
});

const render = () =>
  renderWithProviders(<ExternalOrdersPage />, { route: "/integrations/sources", preloadedState: adminState });

describe("Tashqi manbalar — o'chirish va tahrirlash", () => {
  it("o'chirish avval tasdiq so'raydi; «Bekor qilish» — DELETE ketmaydi", async () => {
    const user = userEvent.setup();
    render();

    const [remove] = await screen.findAllByRole("button", { name: "Uzum Market — o'chirish" });
    await user.click(remove);
    const dialog = await screen.findByRole("alertdialog", { name: "Integratsiyani o'chirish" });
    expect(dialog).toHaveTextContent("\"Uzum Market\" integratsiyasi o'chiriladi. Davom etasizmi?");

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("tasdiqdan keyin DELETE integrations/:id va xabar", async () => {
    const user = userEvent.setup();
    render();

    const [remove] = await screen.findAllByRole("button", { name: "Uzum Market — o'chirish" });
    await user.click(remove);
    const dialog = await screen.findByRole("alertdialog", { name: "Integratsiyani o'chirish" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("integrations/5"));
    expect(await screen.findByText("Integratsiya o'chirildi")).toBeInTheDocument();
  });

  it("tahrirlash: oyna qatordan to'ladi, «Saqlash» — PATCH integrations/:id o'zgargan nom bilan", async () => {
    const user = userEvent.setup();
    render();

    const [edit] = await screen.findAllByRole("button", { name: "Uzum Market — tahrirlash" });
    await user.click(edit);
    const dialog = await screen.findByRole("dialog", { name: "Integratsiyani tahrirlash" });
    const name = within(dialog).getByRole("textbox", { name: "Integratsiya nomi" });
    expect(name).toHaveValue("Uzum Market");

    await user.clear(name);
    await user.type(name, "  Uzum Nasiya  ");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        "integrations/5",
        expect.objectContaining({
          name: "Uzum Nasiya",
          slug: "uzum",
          type: "api",
          role: "source",
          category: "marketplace",
          base_url: "https://api.uzum.uz",
          market_id: "12",
          is_active: true,
          status: "active",
        }),
      ),
    );
    // Eski `none` — backendda `api_key` (tokensiz); `credentials` butunlay almashtirilmaydi.
    const payload = api.patch.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.auth_type).toBe("api_key");
    expect(payload).not.toHaveProperty("credentials");
    expect(payload).not.toHaveProperty("api_key");
    expect(await screen.findByText("Integratsiya yangilandi")).toBeInTheDocument();
  });

  it("tahrirlash (login): maskalangan parol (`***`) qaytib yuborilmaydi, yangisi yozilsa — yuboriladi", async () => {
    const LOGIN_SOURCE = {
      ...SOURCE,
      auth_type: "login",
      auth_url: "https://api.uzum.uz/auth",
      username: "elchi_sync",
      credentials: { auth_url: "https://api.uzum.uz/auth", username: "elchi_sync", password: "***", auth_type: "login" },
    };
    api.get.mockImplementation((url: string) => {
      if (url === "integrations") {
        return Promise.resolve({ data: { statusCode: 200, data: { items: [LOGIN_SOURCE], meta: { total: 1, page: 1, limit: 10 } } } });
      }
      if (url === "markets") return Promise.resolve({ data: { data: { items: [{ id: "12", name: "Baraka Shop" }] } } });
      return Promise.resolve({ data: {} });
    });
    const user = userEvent.setup();
    render();

    expect((await screen.findAllByText("Login va parol")).length).toBeGreaterThan(0);
    const [edit] = await screen.findAllByRole("button", { name: "Uzum Market — tahrirlash" });
    await user.click(edit);
    const dialog = await screen.findByRole("dialog", { name: "Integratsiyani tahrirlash" });
    expect(within(dialog).getByRole("combobox", { name: "Avtorizatsiya turi" })).toHaveTextContent("Login va parol");
    const password = within(dialog).getByLabelText("Parol");
    expect(password).toHaveValue("");

    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    const first = api.patch.mock.calls[0][1] as Record<string, unknown>;
    expect(first).toMatchObject({ auth_type: "login", auth_url: "https://api.uzum.uz/auth", username: "elchi_sync" });
    expect(first).not.toHaveProperty("password");
    expect(first).not.toHaveProperty("credentials");

    const [again] = await screen.findAllByRole("button", { name: "Uzum Market — tahrirlash" });
    await user.click(again);
    const second = await screen.findByRole("dialog", { name: "Integratsiyani tahrirlash" });
    await user.type(within(second).getByLabelText("Parol"), "YangiParol1");
    await user.click(within(second).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    expect(api.patch.mock.calls[1][1]).toMatchObject({ auth_type: "login", password: "YangiParol1" });
  });
});
