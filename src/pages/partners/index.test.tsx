import { screen } from "@testing-library/react";
import { vi } from "vitest";
import PartnersPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: vi.fn(),
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

    expect(await screen.findByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "›" })).toBeEnabled();
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
