import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConnectionShipments from "./ConnectionShipments";
import { renderWithProviders } from "../../../test/test-utils";
import type { Connection } from "../useConnections";

/**
 * POSILKALAR JADVALI (tokhPLMP): mijoz/manzil/summa ustunlari, sanoqli
 * pillar, "Nomuvofiqlik" faqat status xaritasi bor ulanishda.
 */

const apiGetMock = vi.fn();
vi.mock("../../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiGetMock(...args),
  },
}));

const conn = {
  uid: "integration:7",
  kind: "integration",
  id: "7",
  name: "Kargo",
  role: "carrier",
  category: "cargo",
  is_active: true,
  subtitle: "",
  raw: { slug: "kargo" },
} as unknown as Connection;

const shipment = (over: Record<string, unknown> = {}) => ({
  id: "1",
  order_id: "1001",
  integration_id: "7",
  provider_slug: "kargo",
  external_ref: "X1",
  tracking_number: "TRK-1",
  provider_status: "DELIVERED",
  internal_status: "waiting",
  status_changed_at: null,
  send_attempts: 1,
  last_error: null,
  order: {
    id: "1001",
    order_number: "1001",
    total_price: 1250000,
    customer_name: "Aliyev Vali",
    customer_phone: "+998901234567",
    region_name: "Toshkent shahri",
    district_name: "Chilonzor",
  },
  ...over,
});

const pageOf = (items: unknown[], counts: Record<string, unknown> | undefined) => ({
  data: {
    statusCode: 200,
    data: { items, pagination: { total: items.length, page: 1, limit: 20 }, ...(counts ? { counts } : {}) },
  },
});

const counts = { all: 12, not_sent: 2, failed: 3, delivered: 5, mismatch: 1 };
const asRole = (role: string) => ({ role: { id: "1", role, region: null, name: "x" } }) as never;

const pill = (name: RegExp) => screen.getByRole("button", { name });

describe("Posilkalar jadvali (tokhPLMP)", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue(pageOf([shipment()], counts));
  });

  it("mijoz (ism + telefon), manzil (viloyat + tuman), summa va buyurtma havolasi", async () => {
    renderWithProviders(<ConnectionShipments connection={conn} />, { preloadedState: asRole("superadmin") });

    expect(await screen.findByText("Aliyev Vali")).toBeInTheDocument();
    expect(screen.getByText("+998901234567")).toBeInTheDocument();
    expect(screen.getByText("Toshkent shahri")).toBeInTheDocument();
    expect(screen.getByText("Chilonzor")).toBeInTheDocument();
    expect(screen.getByText("1 250 000")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#1001" })).toHaveAttribute("href", "/orders/edit/1001");
    // Elchi'ning ustunligi saqlanadi: ikki tomon statusi yonma-yon.
    expect(screen.getByText(/^biz:/)).toBeInTheDocument();
    expect(screen.getByText("ular: DELIVERED")).toBeInTheDocument();
  });

  it("har pillda backend sanog'i; bosilganda `filter=` ketadi va sahifa 1 ga qaytadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectionShipments connection={conn} />, { preloadedState: asRole("admin") });
    await screen.findByText("Aliyev Vali");

    expect(pill(/Hammasi\s*12/)).toBeInTheDocument();
    expect(pill(/Yuborilmagan\s*2/)).toBeInTheDocument();
    expect(pill(/Yiqilgan\s*3/)).toBeInTheDocument();
    expect(pill(/Yetkazilgan\s*5/)).toBeInTheDocument();
    expect(pill(/Nomuvofiqlik\s*1/)).toBeInTheDocument();

    await user.click(pill(/Nomuvofiqlik/));
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenLastCalledWith("integrations/7/shipments", {
        params: { filter: "mismatch", page: 1, limit: 20 },
      }),
    );
  });

  it("status xaritasi yo'q ulanishda (`mismatch: null`) Nomuvofiqlik pili KO'RINMAYDI", async () => {
    apiGetMock.mockResolvedValue(pageOf([shipment()], { ...counts, mismatch: null }));
    renderWithProviders(<ConnectionShipments connection={conn} />, { preloadedState: asRole("admin") });
    await screen.findByText("Aliyev Vali");
    expect(screen.queryByRole("button", { name: /Nomuvofiqlik/ })).not.toBeInTheDocument();
  });

  it("sanoq kelmasa (eski backend) pillda raqam chiqmaydi — 0 yozilmaydi", async () => {
    apiGetMock.mockResolvedValue(pageOf([shipment()], undefined));
    renderWithProviders(<ConnectionShipments connection={conn} />, { preloadedState: asRole("admin") });
    await screen.findByText("Aliyev Vali");
    expect(pill(/Yiqilgan/).textContent).toBe("Yiqilgan");
  });

  it("telefonni ko'rish huquqi yo'q rolda raqam maskalanadi", async () => {
    renderWithProviders(<ConnectionShipments connection={conn} />, { preloadedState: asRole("registrator") });
    await screen.findByText("Aliyev Vali");
    expect(screen.queryByText("+998901234567")).not.toBeInTheDocument();
    expect(screen.getByText("*** 4567")).toBeInTheDocument();
  });

  it("buyurtma xulosasi bo'lmasa (order-service javob bermadi) qator baribir chiqadi", async () => {
    apiGetMock.mockResolvedValue(pageOf([shipment({ order: null })], counts));
    renderWithProviders(<ConnectionShipments connection={conn} />, { preloadedState: asRole("admin") });
    const link = await screen.findByRole("link", { name: "#1001" });
    const row = link.closest("tr") as HTMLElement;
    expect(within(row).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("\"Amal\" ustuni o'ngda qotirilgan va gorizontal scroll yangi ustunlarga yetadi", async () => {
    apiGetMock.mockResolvedValue(pageOf([shipment({ last_error: "HTTP 500" })], counts));
    const { container } = renderWithProviders(<ConnectionShipments connection={conn} />, {
      preloadedState: asRole("admin"),
    });
    await screen.findByRole("button", { name: /Qayta jo'natish/ });
    // antd 6 mantiqiy nomlar: o'ng = "end", chap = "start".
    expect(container.querySelector(".ant-table-cell-fix-end")).not.toBeNull();
    expect(container.querySelector(".ant-table-cell-fix-start")).not.toBeNull();
    const table = container.querySelector(".ant-table-content table, .ant-table-body table") as HTMLElement;
    expect(table.style.width || table.style.minWidth).toMatch(/1380px/);
  });
});
