import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import BranchListWidget from "./BranchListWidget";

/**
 * Filiallar ro'yxati — sahifalash backend `data.meta` dan.
 * ⚠️ `getByRole` / userEvent ishlatilmaydi (antd CSS-in-JS jsdom selektor xatosi).
 */
const getMock = vi.hoisted(() => vi.fn());
vi.mock("../../../shared/api/instance", () => ({ api: { get: getMock } }));

// 13 ta filial: 12 ta viloyat filiali, 13-chisi — HQ Toshkent (jonli API tartibi).
const BRANCHES = [
  ...Array.from({ length: 12 }, (_, index) => ({
    id: String(index + 2),
    name: `Viloyat filiali ${index + 2}`,
    code: `BR-${index + 2}`,
    type: "REGIONAL",
    status: "active",
  })),
  { id: "1", name: "HQ Toshkent", code: "HQ", type: "HQ", status: "active" },
];

// Sahifa raqami tugmalari (sahifa hajmi tanlagichidagi "12"/"8" emas).
const pageNumberButtons = () =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("button.min-w-9, button.min-w-8")).filter((button) =>
    /^\d+$/.test(button.textContent?.trim() ?? ""),
  );
const pageButtons = () => pageNumberButtons().map((button) => button.textContent!.trim());

const clickPage = (label: string) =>
  fireEvent.click(pageNumberButtons().find((button) => button.textContent?.trim() === label)!);

describe("BranchListWidget — 13 ta filial, sahifalash", () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockImplementation((_url: string, config?: { params?: { page?: number; limit?: number } }) => {
      const page = config?.params?.page ?? 1;
      const limit = config?.params?.limit ?? 10;
      return Promise.resolve({
        data: {
          statusCode: 200,
          message: "Branches list",
          data: {
            items: BRANCHES.slice((page - 1) * limit, page * limit),
            meta: { page, limit, total: BRANCHES.length, totalPages: Math.ceil(BRANCHES.length / limit) },
          },
        },
      });
    });
  });

  it("⭐ render (jadval, 12/sahifa): pagination 2 sahifa; 2-sahifada HQ ko'rinadi", async () => {
    renderWithProviders(<BranchListWidget viewMode="table" onViewModeChange={vi.fn()} onEdit={vi.fn()} />);

    expect(await screen.findByText("1-12 dan 13 tasi ko'rsatilmoqda")).toBeInTheDocument();
    expect(pageButtons()).toEqual(["1", "2"]);
    expect(screen.queryByText("HQ Toshkent")).not.toBeInTheDocument();

    clickPage("2");
    expect(await screen.findByText("13-13 dan 13 tasi ko'rsatilmoqda")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("HQ Toshkent").length).toBeGreaterThan(0));
    expect(getMock).toHaveBeenLastCalledWith("branches", { params: expect.objectContaining({ page: 2, limit: 12 }) });
  });

  it("⭐ render (karta, 8/sahifa): 2 sahifa; 2-sahifada qolgan 5 ta, HQ bilan", async () => {
    renderWithProviders(<BranchListWidget viewMode="card" onViewModeChange={vi.fn()} onEdit={vi.fn()} />);

    expect(await screen.findByText("1-8 dan 13 tasi ko'rsatilmoqda")).toBeInTheDocument();
    expect(pageButtons()).toEqual(["1", "2"]);

    clickPage("2");
    expect(await screen.findByText("9-13 dan 13 tasi ko'rsatilmoqda")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("HQ Toshkent").length).toBeGreaterThan(0));
    for (const id of [10, 11, 12, 13]) {
      expect(screen.getAllByText(`Viloyat filiali ${id}`).length, String(id)).toBeGreaterThan(0);
    }
  });
});
