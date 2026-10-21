import { useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { CustomerSegment } from "../model/segment";
import { CustomerSegmentFilters } from "./CustomerSegmentFilters";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../../../shared/api/api", () => ({ api }));

const DISTRICTS: Record<string, Array<{ id: number; name: string; region_id: number }>> = {
  "1": [
    { id: 12, name: "Chilonzor tumani", region_id: 1 },
    { id: 13, name: "Yunusobod tumani", region_id: 1 },
  ],
  "2": [{ id: 21, name: "Samarqand shahri", region_id: 2 }],
};

const Harness = ({ onChange }: { onChange: (next: CustomerSegment) => void }) => {
  const [value, setValue] = useState<CustomerSegment>({});
  return (
    <CustomerSegmentFilters
      value={value}
      today="2026-10-21"
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
};

describe("CustomerSegmentFilters (KM-1)", () => {
  beforeEach(() => {
    api.get.mockReset().mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === "region")
        return Promise.resolve({
          data: { data: [{ id: 1, name: "Toshkent sh." }, { id: 2, name: "Samarqand viloyati" }] },
        });
      if (url === "district")
        return Promise.resolve({ data: { data: DISTRICTS[String(config?.params?.region_id)] ?? [] } });
      if (url === "markets")
        return Promise.resolve({
          data: { data: { items: [{ id: 3, name: "Baraka Shop", phone_number: "+998901112233" }] } },
        });
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it("⭐ xom ID maydonlari yo'q: Viloyat / Tuman / Market — tanlov, «Buyurtmalar soni» — faqat minimum", async () => {
    renderWithProviders(<Harness onChange={() => undefined} />);
    expect(screen.getByRole("heading", { name: "Mijoz filtrlari" })).toBeInTheDocument();
    expect(screen.getByText("Faqat mijozlarga qo'llanadi")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Viloyat/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Market/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Oxirgi buyurtma/ })).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: "Buyurtmalar soni" })).toBeInTheDocument();
    expect(screen.queryByText(/ID$/)).toBeNull();
    expect(screen.queryByText(/gacha/i)).toBeNull();
    // Viloyatsiz tuman — o'chiq, izoh bilan.
    const district = screen.getByRole("combobox", { name: /^Tuman/ });
    expect(district).toBeDisabled();
    expect(district).toHaveTextContent("Avval viloyatni tanlang");
  });

  it("viloyat → tuman ro'yxati shu viloyatdan; viloyat almashsa tuman tozalanadi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: /^Viloyat/ }));
    await user.click(await screen.findByRole("option", { name: "Toshkent sh." }));
    expect(onChange).toHaveBeenLastCalledWith({ region_id: "1", district_id: undefined });

    const district = screen.getByRole("combobox", { name: /^Tuman/ });
    await waitFor(() => expect(district).toBeEnabled());
    await user.click(district);
    const listbox = await screen.findByRole("listbox");
    await waitFor(() => expect(within(listbox).getByRole("option", { name: "Chilonzor tumani" })).toBeInTheDocument());
    expect(within(listbox).queryByRole("option", { name: "Samarqand shahri" })).toBeNull();
    await user.click(within(listbox).getByRole("option", { name: "Chilonzor tumani" }));
    expect(onChange).toHaveBeenLastCalledWith({ region_id: "1", district_id: "12" });
    expect(api.get).toHaveBeenCalledWith("district", { params: { region_id: "1" } });

    await user.click(screen.getByRole("combobox", { name: /^Viloyat/ }));
    await user.click(await screen.findByRole("option", { name: "Samarqand viloyati" }));
    expect(onChange).toHaveBeenLastCalledWith({ region_id: "2", district_id: undefined });
  });

  it("market (qidiruv bilan) va minimum buyurtma soni", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: /^Market/ }));
    await user.click(await screen.findByRole("option", { name: "Baraka Shop" }));
    expect(onChange).toHaveBeenLastCalledWith({ market_id: "3" });
    expect(api.get).toHaveBeenCalledWith("markets", { params: { status: "active", limit: 1000 } });

    await user.type(screen.getByRole("textbox", { name: "Buyurtmalar soni" }), "2");
    expect(onChange).toHaveBeenLastCalledWith({ market_id: "3", min_orders: 2 });
    await user.clear(screen.getByRole("textbox", { name: "Buyurtmalar soni" }));
    expect(onChange).toHaveBeenLastCalledWith({ market_id: "3", min_orders: undefined });
  });

  it("ro'yxat yuklanmasa — maydon ostida xato izohi (xom backend matnisiz)", async () => {
    api.get.mockImplementation((url: string) =>
      url === "region"
        ? Promise.reject(Object.assign(new Error("boom"), { response: { status: 500, data: { message: "DB down" } } }))
        : Promise.resolve({ data: { data: [] } }),
    );
    renderWithProviders(<Harness onChange={() => undefined} />);
    expect(await screen.findByText("Ro'yxatni olib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Viloyat/ })).toHaveAccessibleDescription("Ro'yxatni olib bo'lmadi");
    expect(screen.queryByText("DB down")).toBeNull();
  });
});
