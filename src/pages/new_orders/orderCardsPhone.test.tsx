import { screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { renderWithProviders } from "../../test/test-utils";
import { MarketOrdersTable } from "./components/marketOrders/MarketOrdersTable";
import { CancelledOrdersTable } from "./cancelled/ui/CancelledOrdersTable";
import { MarketReturnsPanel } from "./cancelled/ui/MarketReturns";

/**
 * Telefon (< 768) kartalarida mijoz telefoni ism ostida — jadvaldagi «Mijoz» katagidagidek. Xodim raqamni ko'rish
 * uchun buyurtma tafsilotiga kirishga majbur bo'lmasin (yangi buyurtmalar, bekor qilinganlar, «Yo'lda» qaytarishlar).
 */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const mockPhone = () =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query.includes("max-width: 767px"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );

afterEach(() => {
  vi.restoreAllMocks();
});

const order = (id: string, phone: string | null = "+998901234567") => ({
  id,
  status: "new",
  where_deliver: "address",
  total_price: 150000,
  createdAt: "2026-11-06T10:00:00.000Z",
  updatedAt: "2026-11-06T10:00:00.000Z",
  customer: { id: `c${id}`, name: `Mijoz ${id}`, phone_number: phone },
  district: { id: "5", name: "Yunusobod" },
  market: { id: "7", name: "Fresh Market" },
  items: [],
});

const PHONE = "+998 90 123 45 67";

describe("telefon kartalarida mijoz telefoni", () => {
  it("market yangi buyurtmalari (xodim va market): ism ostida raqam; raqam yo'q — qator yo'q", () => {
    mockPhone();
    const props = {
      marketId: "7",
      sort: null,
      onSortChange: vi.fn(),
      onDelete: vi.fn(),
      label: "Yangi buyurtmalar",
    };
    const staff = renderWithProviders(
      <MarketOrdersTable {...props} variant="staff" rows={[order("11"), order("12", null)] as never} />,
    );
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByText(PHONE)).toHaveLength(1);
    expect(screen.getByText("Mijoz 12")).toBeInTheDocument();
    staff.unmount();

    renderWithProviders(<MarketOrdersTable {...props} variant="market" rows={[order("13")] as never} />);
    expect(screen.getByText(PHONE)).toBeInTheDocument();
  });

  it("bekor qilinganlar (ro'yxat va topshirish): ism ostida raqam", () => {
    mockPhone();
    const list = renderWithProviders(
      <CancelledOrdersTable
        variant="market"
        rows={[order("21"), order("22", "")] as never}
        label="Bekor qilinganlar"
        sort={null}
        onSortChange={vi.fn()}
      />,
    );
    expect(screen.getAllByText(PHONE)).toHaveLength(1);
    list.unmount();

    renderWithProviders(
      <CancelledOrdersTable
        variant="handover"
        rows={[order("23")] as never}
        label="Topshirish"
        isSelected={() => false}
        manualReasonOf={() => null}
        canManualSelect={false}
        onToggle={vi.fn()}
        onManualSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(PHONE)).toBeInTheDocument();
  });

  it("marketga qaytarishlar: «Yo'lda» kartasida raqam (jadvaldagidek), «Qabul qilingan» da yo'q", () => {
    mockPhone();
    const rows = [{ ...order("31"), status: "cancelled (sent)" }] as never;
    const query = { data: rows, isLoading: false };
    const transit = renderWithProviders(<MarketReturnsPanel view="transit" query={query} rows={rows} truncated={false} />);
    expect(screen.getByText(PHONE)).toBeInTheDocument();
    transit.unmount();

    renderWithProviders(<MarketReturnsPanel view="received" query={query} rows={rows} truncated={false} />);
    expect(screen.getByText("Mijoz 31")).toBeInTheDocument();
    expect(screen.queryByText(PHONE)).toBeNull();
  });
});
