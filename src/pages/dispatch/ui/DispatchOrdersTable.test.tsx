import { screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { DispatchOrder } from "../../../features/dispatch-basket/model/dispatchOrder";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import { DispatchOrdersTable } from "./DispatchOrdersTable";

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const row = (id: string, phone: string | null): DispatchOrder => ({
  id,
  token: `t${id}`,
  market: "Fresh Market",
  name: `Mijoz ${id}`,
  phone,
  district: "Yunusobod",
  region: "Toshkent",
  amount: 150000,
  deliveryKind: "home",
  createdAt: "2026-11-06T10:00:00.000Z",
  status: "received",
});

describe("DispatchOrdersTable — telefon (< 768)", () => {
  it("kartada mijoz telefoni ism ostida (jadvaldagidek); raqam yo'q — qator yo'q", () => {
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
    renderWithProviders(
      <DispatchOrdersTable
        rows={[row("1", "+998901234567"), row("2", null)]}
        selectedIds={new Set()}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByText("+998 90 123 45 67")).toHaveLength(1);
    expect(screen.getByText("Mijoz 2")).toBeInTheDocument();
  });
});
