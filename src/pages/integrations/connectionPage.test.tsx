import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import ConnectionPage from "./ConnectionPage";
import ConnectionsPage from "./ConnectionsPage";
import { connectionPath, legacyConnectionPath, uidFromParam } from "./connectionMeta";
import { renderWithProviders } from "../../test/test-utils";

/** Sayt ulanishi o'z sahifasida (ega qarori 2026-11-25). */
const apiGetMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiGetMock(...args),
    patch: (...args: unknown[]) => apiGetMock(...args),
  },
}));

const SITE = {
  id: "3",
  name: "Lidershop",
  slug: "lidershop",
  type: "api",
  role: "source",
  category: "marketplace",
  is_active: true,
  base_url: "https://api.lidershop.uz",
  auth_type: "login",
  market_id: "3949",
  imported_orders: { total: 49, today: 1, last_at: "2026-11-24T18:57:57.000Z" },
};

const open = (route: string, site: Record<string, unknown> = SITE) => {
  apiGetMock.mockImplementation((url: string) => {
    if (url === "integrations") {
      return Promise.resolve({ data: { data: { items: [site], meta: { total: 1 } } } });
    }
    if (url === "integrations/3") {
      return Promise.resolve({ data: { data: { ...site, market: { id: "3949", name: "Lidershop market" } } } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
  return renderWithProviders(
    <Routes>
      <Route path="/integrations/connections" element={<ConnectionsPage />} />
      <Route path="/integrations/connections/:connectionId" element={<ConnectionPage />} />
    </Routes>,
    { route },
  );
};

const tabLabels = () => Array.from(document.querySelectorAll('[role="tab"]')).map((el) => el.textContent);

describe("Sayt ulanishi sahifasi", () => {
  beforeEach(() => apiGetMock.mockReset());

  it("⭐ «Skanerlash» sayt skaniga olib boradi; keraksiz tablar yo'q; market nomi ko'rinadi", async () => {
    open("/integrations/connections/integration-3");

    await waitFor(() => expect(document.querySelector("h1")).toHaveTextContent("Lidershop"));
    expect(screen.getByText("Skanerlash").closest("a")).toHaveAttribute("href", "/new-orders/sites/3");
    expect(document.querySelector('a[href="/integrations/connections?scope=marketplace"]')).not.toBeNull();
    expect(tabLabels()).toEqual(["Umumiy holat", "Sozlamalar", "Hodisalar", "Ish rejimi", "Xavfsizlik"]);
    const block = await screen.findByTestId("ovw-imports");
    await waitFor(() => expect(within(block).getByText("Lidershop market")).toBeInTheDocument());
  });

  it("market biriktirilmagan yoki nofaol — «Skanerlash» yo'q, market majburiy deb ko'rsatiladi", async () => {
    open("/integrations/connections/integration-3", { ...SITE, market_id: null });

    const checklist = await screen.findByTestId("ovw-checklist");
    expect(within(checklist).getByText("Biriktirilmagan — buyurtma olib bo'lmaydi")).toBeInTheDocument();
    expect(within(checklist).getByText("Marketni biriktirish")).toBeInTheDocument();
    expect(screen.queryByText("Skanerlash")).toBeNull();
  });

  it("⭐ ro'yxatda «Olingan buyurtmalar» ustuni; noma'lum — «—»", async () => {
    const { unmount } = open("/integrations/connections?scope=marketplace");
    await waitFor(() => expect(screen.getByText("49 ta")).toBeInTheDocument());
    unmount();

    open("/integrations/connections?scope=marketplace", { ...SITE, imported_orders: null });
    await waitFor(() =>
      expect(document.querySelector('a[href="/integrations/connections/integration-3"]')).not.toBeNull(),
    );
    expect(screen.queryByText("49 ta")).toBeNull();
    expect(screen.queryByText("Oxirgi qabul")).toBeNull();
  });
});

describe("ulanish manzili", () => {
  it("uid ↔ manzil; noma'lum shakl rad etiladi", () => {
    expect(connectionPath("integration:3")).toBe("/integrations/connections/integration-3");
    expect(connectionPath("partner:7", "log")).toBe("/integrations/connections/partner-7?t=log");
    expect(uidFromParam("integration-3")).toBe("integration:3");
    expect(uidFromParam("carrier-3")).toBeNull();
    expect(uidFromParam(undefined)).toBeNull();
  });

  it("carrier akkaunti o'z konsolida qoladi (yo'naltirilmaydi)", () => {
    expect(legacyConnectionPath(new URLSearchParams("scope=carrier&c=carrier:9"))).toBeNull();
    expect(legacyConnectionPath(new URLSearchParams("scope=partner"))).toBeNull();
    expect(legacyConnectionPath(new URLSearchParams("c=integration:7&t=log"))).toBe(
      "/integrations/connections/integration-7?t=log",
    );
  });
});
