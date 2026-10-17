import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import PartnersPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
    patch: vi.fn(),
  },
}));

const adminState = {
  role: { id: "admin-1", role: "superadmin", region: null, name: "Admin" },
} as never;

const partnersResponse = {
  data: {
    statusCode: 200,
    message: "partners",
    data: [{ id: "1", name: "BeePost", webhook_url: null, is_active: true, createdAt: "2026-09-10T00:00:00.000Z" }],
  },
};

const webhookRow = (id: string) => ({
  id,
  partner_id: "1",
  order_id: `o-${id}`,
  external_order_id: `BP-${id}`,
  event_type: "order.status_changed",
  new_status: "sold",
  status: "awaiting_config",
  attempts: 0,
  max_attempts: 8,
  last_error: "hamkorda webhook_url sozlanmagan",
  next_retry_at: null,
  delivered_at: null,
  created_at: "2026-09-15T10:00:00.000Z",
  payload: {},
});

const mockApi = (webhooks: () => Promise<unknown>) =>
  apiGetMock.mockImplementation((url: string) =>
    url === "admin/partners/webhooks" ? webhooks() : Promise.resolve(partnersResponse),
  );

describe("PartnersPage webhook journal", () => {
  beforeEach(() => apiGetMock.mockReset());

  it("lists the outbox rows the backend returned instead of 'Yozuv topilmadi'", async () => {
    mockApi(() =>
      Promise.resolve({
        data: {
          statusCode: 200,
          message: "partner webhooks",
          data: { data: [webhookRow("w1"), webhookRow("w2")], total: 2, page: 1, limit: 20, totalPages: 1 },
        },
      }),
    );

    renderWithProviders(<PartnersPage />, { preloadedState: adminState });

    expect(await screen.findByText("BP-w1")).toBeInTheDocument();
    expect(screen.getByText("BP-w2")).toBeInTheDocument();
    expect(screen.queryByText("Yozuv topilmadi")).not.toBeInTheDocument();
  });

  it("shows the pagination controls when the journal has more than one page", async () => {
    mockApi(() =>
      Promise.resolve({
        data: {
          statusCode: 200,
          message: "partner webhooks",
          data: { data: [webhookRow("w1")], total: 33, page: 1, limit: 20, totalPages: 2 },
        },
      }),
    );

    renderWithProviders(<PartnersPage />, { preloadedState: adminState });

    // v2 `Pagination`: «1–20 / 33 ta yozuv» + keyingi sahifa tugmasi.
    expect(await screen.findByText("1–20 / 33 ta yozuv")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keyingi sahifa" })).toBeEnabled();
  });

  it("shows an error state — not 'Yozuv topilmadi' — when the journal request fails", async () => {
    mockApi(() =>
      Promise.reject({ response: { status: 500, data: { statusCode: 500, message: "Integratsiya xizmati javob bermadi" } } }),
    );

    renderWithProviders(<PartnersPage />, { preloadedState: adminState });

    expect(await screen.findByText("Integratsiya xizmati javob bermadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Qayta urinish/ })).toBeInTheDocument();
    expect(screen.queryByText("Yozuv topilmadi")).not.toBeInTheDocument();
  });

  it("still shows 'Yozuv topilmadi' when the journal is genuinely empty", async () => {
    mockApi(() =>
      Promise.resolve({
        data: { statusCode: 200, message: "partner webhooks", data: { data: [], total: 0, page: 1, limit: 20, totalPages: 1 } },
      }),
    );

    renderWithProviders(<PartnersPage />, { preloadedState: adminState });

    expect(await screen.findByText("Yozuv topilmadi")).toBeInTheDocument();
  });
});

// Kirish huquqini o'zgartiradigan amallar — v2 tasdiqlash oynasi (`useConfirm`) orqali, brauzer `confirm()` emas.
describe("PartnersPage access-changing actions", () => {
  const emptyJournal = () =>
    Promise.resolve({
      data: { statusCode: 200, message: "partner webhooks", data: { data: [], total: 0, page: 1, limit: 20, totalPages: 1 } },
    });

  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    mockApi(emptyJournal);
    apiPostMock.mockResolvedValue({ data: { statusCode: 200, data: { id: "1", api_key: "elc_new" } } });
  });

  it("«Kalitni yangilash» asks for confirmation (maket matni) and rotates only after «Ha, yangilash»", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PartnersPage />, { preloadedState: adminState });

    // Maket `*-legacy-partners`: qatordagi ikonka tugma — «BeePost — kalitni yangilash».
    await user.click(await screen.findByRole("button", { name: "BeePost — kalitni yangilash" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Kalitni yangilash" });
    expect(dialog).toHaveTextContent("Eski kalit darhol ishlamay qoladi.");
    expect(dialog).toHaveTextContent("BeePost");

    await user.click(screen.getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiPostMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "BeePost — kalitni yangilash" }));
    await user.click(await screen.findByRole("button", { name: "Ha, yangilash" }));
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith("admin/partners/1/rotate-key"));
  });

  it("disabling a partner goes through a danger confirmation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PartnersPage />, { preloadedState: adminState });

    // Maket: faol hamkor qatorida «To'xtatish» (danger-soft); tasdiq oynasi matni o'sha.
    await user.click(await screen.findByRole("button", { name: "To'xtatish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Hamkorni o'chirish" });
    expect(dialog).toHaveTextContent("O'chirilgandan keyin hamkor so'rovlari darhol rad etiladi.");
    expect(apiPostMock).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "To'xtatish" }));
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith("admin/partners/1/status", { is_active: false }));
  });
});
