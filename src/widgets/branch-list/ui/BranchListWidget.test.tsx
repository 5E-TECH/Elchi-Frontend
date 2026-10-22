import { useState } from "react";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import BranchListWidget, { type BranchViewMode } from "./BranchListWidget";

/**
 * Filiallar ro'yxati (dizayn v2) — sahifalash backend `data.meta` dan (jadval 12, kartalar 8), daraxt
 * (100 tagacha bitta so'rov), qidiruv/holat filtrlari, o'chirish tasdig'i, holatlar.
 */
const api = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/instance", () => ({ api }));

// 13 ta filial: 12 ta viloyat filiali, 13-chisi — HQ Toshkent (jonli API tartibi).
const BRANCHES = [
  ...Array.from({ length: 12 }, (_, index) => ({
    id: String(index + 2),
    name: `Viloyat filiali ${index + 2}`,
    code: `BR-${index + 2}`,
    type: "REGIONAL",
    status: "active",
    level: 1,
    parent_id: "1",
    employees_count: index,
    region: { id: String(100 + (index % 3)), name: ["Andijon viloyati", "Buxoro viloyati", "Samarqand viloyati"][index % 3] },
    district: { id: String(100 + (index % 3)), name: ["Andijon viloyati", "Buxoro viloyati", "Samarqand viloyati"][index % 3] },
  })),
  { id: "1", name: "HQ Toshkent", code: "TSH-HQ", type: "HQ", status: "active", level: 0, parent_id: null, employees_count: 24 },
];

type Params = { page?: number; limit?: number; search?: string; status?: string };

const lastParams = (): Params => (api.get.mock.calls.at(-1)?.[1] as { params: Params }).params;

const pagesNav = () => screen.getByRole("navigation", { name: "Sahifalar" });

const Harness = ({ initial, onViewModeChange }: { initial: BranchViewMode; onViewModeChange?: (mode: BranchViewMode) => void }) => {
  const [mode, setMode] = useState<BranchViewMode>(initial);
  return (
    <BranchListWidget
      viewMode={mode}
      onViewModeChange={(next) => {
        onViewModeChange?.(next);
        setMode(next);
      }}
      onEdit={vi.fn()}
    />
  );
};

describe("BranchListWidget — 13 ta filial, sahifalash", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.delete.mockReset();
    api.get.mockImplementation((_url: string, config?: { params?: Params }) => {
      const page = config?.params?.page ?? 1;
      const limit = config?.params?.limit ?? 10;
      const search = config?.params?.search ?? "";
      const status = config?.params?.status ?? "";
      const filtered = BRANCHES.filter(
        (branch) => (!search || branch.name.includes(search)) && (!status || branch.status === status),
      );
      return Promise.resolve({
        data: {
          statusCode: 200,
          message: "Branches list",
          data: {
            items: filtered.slice((page - 1) * limit, page * limit),
            meta: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
          },
        },
      });
    });
  });

  it("⭐ jadval (12/sahifa): «1–12 / 13 ta filial», 2 sahifa; 2-sahifada HQ ko'rinadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchListWidget viewMode="table" onViewModeChange={vi.fn()} onEdit={vi.fn()} />);

    expect(await screen.findByText("1–12 / 13 ta filial")).toBeInTheDocument();
    expect(screen.getByText("Jami 13 ta filial")).toBeInTheDocument();
    expect(within(pagesNav()).getAllByRole("button").map((button) => button.textContent)).toEqual(["", "1", "2", ""]);
    expect(screen.queryByText("HQ Toshkent")).not.toBeInTheDocument();
    expect(lastParams()).toMatchObject({ page: 1, limit: 12 });

    await user.click(within(pagesNav()).getByRole("button", { name: "2" }));
    expect(await screen.findByText("13–13 / 13 ta filial")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "HQ Toshkent" })).toHaveAttribute("href", "/branches/1");
    expect(api.get).toHaveBeenLastCalledWith("branches", { params: expect.objectContaining({ page: 2, limit: 12 }) });
  });

  it("⭐ karta (8/sahifa): 2 sahifa; 2-sahifada qolgan 5 ta, HQ bilan", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchListWidget viewMode="card" onViewModeChange={vi.fn()} onEdit={vi.fn()} />);

    expect(await screen.findByText("1–8 / 13 ta filial")).toBeInTheDocument();
    expect(lastParams()).toMatchObject({ page: 1, limit: 8 });

    await user.click(within(pagesNav()).getByRole("button", { name: "2" }));
    expect(await screen.findByText("9–13 / 13 ta filial")).toBeInTheDocument();
    const cards = screen.getByRole("list", { name: "Filiallar kartalari" });
    await waitFor(() => expect(within(cards).getByText("HQ Toshkent")).toBeInTheDocument());
    for (const id of [10, 11, 12, 13]) {
      expect(within(cards).getByText(`Viloyat filiali ${id}`), String(id)).toBeInTheDocument();
    }
    expect(within(cards).getByRole("link", { name: "Batafsil — HQ Toshkent" })).toHaveAttribute("href", "/branches/1");
  });

  it("ko'rinish almashsa sahifa 1 va sahifa hajmi (kartalar 8 → jadval 12)", async () => {
    const user = userEvent.setup();
    const onViewModeChange = vi.fn();
    renderWithProviders(<Harness initial="card" onViewModeChange={onViewModeChange} />);

    expect(await screen.findByText("1–8 / 13 ta filial")).toBeInTheDocument();
    await user.click(within(pagesNav()).getByRole("button", { name: "2" }));
    expect(await screen.findByText("9–13 / 13 ta filial")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Jadval" }));
    expect(onViewModeChange).toHaveBeenCalledWith("table");
    expect(await screen.findByText("1–12 / 13 ta filial")).toBeInTheDocument();
    expect(lastParams()).toMatchObject({ page: 1, limit: 12 });
  });
});

describe("BranchListWidget — daraxt", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockResolvedValue({
      data: { statusCode: 200, data: { items: BRANCHES, meta: { page: 1, limit: 100, total: BRANCHES.length } } },
    });
  });

  it("bitta so'rov (limit 100), sahifalashsiz; HQ ochiq, viloyat guruhi chevron bilan ochiladi/yopiladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchListWidget viewMode="tree" onViewModeChange={vi.fn()} onEdit={vi.fn()} />);

    const tree = await screen.findByRole("table", { name: "Filiallar daraxti" });
    expect(lastParams()).toMatchObject({ page: 1, limit: 100 });
    expect(screen.queryByRole("navigation", { name: "Sahifalar" })).not.toBeInTheDocument();
    expect(within(tree).getByRole("link", { name: "HQ Toshkent" })).toBeInTheDocument();
    expect(within(tree).getByText("TSH-HQ · 0-daraja · 12 ta ichki filial")).toBeInTheDocument();
    expect(within(tree).getAllByText("Viloyat · 4 ta filial")).toHaveLength(3);
    expect(within(tree).queryByRole("link", { name: "Viloyat filiali 2" })).not.toBeInTheDocument();

    const toggle = within(tree).getByRole("button", { name: "Andijon viloyati: ichki filiallarni ochish" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(within(tree).getByRole("link", { name: "Viloyat filiali 2" })).toHaveAttribute("href", "/branches/2");
    const collapse = within(tree).getByRole("button", { name: "Andijon viloyati: ichki filiallarni yopish" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");

    // Klaviatura: Enter bilan yopiladi.
    collapse.focus();
    await user.keyboard("{Enter}");
    expect(within(tree).queryByRole("link", { name: "Viloyat filiali 2" })).not.toBeInTheDocument();

    // HQ ham yopiladi.
    await user.click(within(tree).getByRole("button", { name: "HQ Toshkent: ichki filiallarni yopish" }));
    expect(within(tree).queryByText("Andijon viloyati")).not.toBeInTheDocument();
  });
});

describe("BranchListWidget — filtrlar, o'chirish, holatlar", () => {
  beforeEach(() => {
    vi.useRealTimers();
    api.get.mockReset();
    api.delete.mockReset();
    api.get.mockImplementation((_url: string, config?: { params?: Params }) => {
      const search = config?.params?.search ?? "";
      const status = config?.params?.status ?? "";
      const filtered = BRANCHES.filter(
        (branch) => (!search || branch.name.includes(search)) && (!status || branch.status === status),
      );
      return Promise.resolve({
        data: { statusCode: 200, data: { items: filtered.slice(0, 12), meta: { page: 1, limit: 12, total: filtered.length } } },
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("qidiruv 0,4 s dan keyin so'raladi va sahifa 1 ga qaytadi", async () => {
    renderWithProviders(<BranchListWidget viewMode="table" onViewModeChange={vi.fn()} onEdit={vi.fn()} />);
    await screen.findByText("1–12 / 13 ta filial");
    const before = api.get.mock.calls.length;

    vi.useFakeTimers();
    fireEvent.change(screen.getByRole("searchbox", { name: "Filiallarni qidirish" }), { target: { value: "filiali 1" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(api.get.mock.calls.length).toBe(before);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    vi.useRealTimers();

    await waitFor(() => expect(lastParams()).toMatchObject({ search: "filiali 1", page: 1, limit: 12 }));
  });

  it("holat filtri — status=inactive, natija bo'lmasa «Mos filial topilmadi» + tozalash", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchListWidget viewMode="table" onViewModeChange={vi.fn()} onEdit={vi.fn()} />);
    await screen.findByText("1–12 / 13 ta filial");

    await user.click(screen.getByRole("combobox", { name: "Holat" }));
    await user.click(await screen.findByRole("option", { name: "Nofaol" }));

    await waitFor(() => expect(lastParams()).toMatchObject({ status: "inactive", page: 1 }));
    expect(await screen.findByText("Mos filial topilmadi")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ status: "", search: "" }));
    expect(await screen.findByText("1–12 / 13 ta filial")).toBeInTheDocument();
  });

  it("⭐ o'chirish — menyu → tasdiq oynasi (maket matni) → DELETE va xabar; bekor qilinsa so'rov yo'q", async () => {
    const user = userEvent.setup();
    api.delete.mockResolvedValue({ data: { statusCode: 200 } });
    renderWithProviders(<BranchListWidget viewMode="table" onViewModeChange={vi.fn()} onEdit={vi.fn()} />);
    await screen.findByText("1–12 / 13 ta filial");

    await user.click(screen.getByRole("button", { name: "Viloyat filiali 3 amallari" }));
    await user.click(await screen.findByRole("menuitem", { name: "O'chirish" }));
    let dialog = await screen.findByRole("alertdialog", { name: "Filialni o'chirmoqchimisiz?" });
    expect(dialog).toHaveAccessibleDescription("Viloyat filiali 3 filiallar ro'yxatidan o'chiriladi.");
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(api.delete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Viloyat filiali 3 amallari" }));
    await user.click(await screen.findByRole("menuitem", { name: "O'chirish" }));
    dialog = await screen.findByRole("alertdialog", { name: "Filialni o'chirmoqchimisiz?" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("branches/3"));
    expect(await screen.findByText("Filial o'chirildi")).toBeInTheDocument();
  });

  const rejectDelete = async (error: unknown) => {
    const user = userEvent.setup();
    api.delete.mockRejectedValue(error);
    renderWithProviders(<BranchListWidget viewMode="table" onViewModeChange={vi.fn()} onEdit={vi.fn()} />);
    await screen.findByText("1–12 / 13 ta filial");

    await user.click(screen.getByRole("button", { name: "Viloyat filiali 3 amallari" }));
    await user.click(await screen.findByRole("menuitem", { name: "O'chirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Filialni o'chirmoqchimisiz?" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    return screen.findByText("Filialni o'chirishda xatolik yuz berdi");
  };
  const httpError = (status: number, message: string) =>
    Object.assign(new Error(`Request failed with status code ${status}`), {
      response: { status, data: { statusCode: status, message } },
    });

  it("o'chirish rad etilsa (javobsiz xato) — «Filialni o'chirishda xatolik yuz berdi», izohsiz", async () => {
    const title = await rejectDelete(new Error("Network Error"));
    expect(title).toBeInTheDocument();
    expect(screen.queryByText("Hozir tekshirib bo'lmadi. Keyinroq qayta urinib ko'ring.")).not.toBeInTheDocument();
  });

  it("⭐ 400 — xabar izohida backend sababi va summasi (5QHWbBCA)", async () => {
    const reason = "Filialni o'chirib bo'lmaydi: filialning HQ'ga 1 250 000 so'm qarzi bor";
    expect(await rejectDelete(httpError(400, reason))).toBeInTheDocument();
    expect(await screen.findByText(reason)).toBeInTheDocument();
  });

  it("⭐ 503 — «Hozir tekshirib bo'lmadi. Keyinroq qayta urinib ko'ring.» (5QHWbBCA)", async () => {
    expect(await rejectDelete(httpError(503, "Service Unavailable"))).toBeInTheDocument();
    expect(await screen.findByText("Hozir tekshirib bo'lmadi. Keyinroq qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.queryByText("Service Unavailable")).not.toBeInTheDocument();
  });

  it("menyu «Tahrirlash» — onEdit shu filial bilan", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderWithProviders(<BranchListWidget viewMode="table" onViewModeChange={vi.fn()} onEdit={onEdit} />);
    await screen.findByText("1–12 / 13 ta filial");

    await user.click(screen.getByRole("button", { name: "Viloyat filiali 4 amallari" }));
    await user.click(await screen.findByRole("menuitem", { name: "Tahrirlash" }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "4", name: "Viloyat filiali 4" }));
  });

  it("xato — «Filiallarni yuklab bo'lmadi» + «Qayta urinish» qayta so'raydi", async () => {
    const user = userEvent.setup();
    api.get.mockRejectedValueOnce(new Error("boom"));
    renderWithProviders(<BranchListWidget viewMode="table" onViewModeChange={vi.fn()} onEdit={vi.fn()} />);

    expect(await screen.findByText("Filiallarni yuklab bo'lmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByText("1–12 / 13 ta filial")).toBeInTheDocument();
  });
});

describe("BranchListWidget — «Sana» ustuni (cI5gqN90)", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockResolvedValue({
      data: {
        statusCode: 200,
        data: {
          items: [
            { id: "3", name: "QA Filial", code: "QA", type: "REGIONAL", status: "active", level: 1, createdAt: "2026-06-02T07:15:00.000Z" },
            { id: "4", name: "Sanasiz filial", code: "SZ", type: "REGIONAL", status: "active", level: 1 },
          ],
          meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
        },
      },
    });
  });

  it("`createdAt` — o'sha sana; sana yo'q — «—» (bugungi sana EMAS)", async () => {
    renderWithProviders(<BranchListWidget viewMode="table" onViewModeChange={vi.fn()} onEdit={vi.fn()} />);
    const withDate = (await screen.findByText("QA Filial")).closest("tr") as HTMLElement;
    expect(withDate).toHaveTextContent("02.06.2026");
    const today = new Date();
    const todayText = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;
    const noDate = screen.getByText("Sanasiz filial").closest("tr") as HTMLElement;
    expect(noDate).toHaveTextContent("—");
    expect(noDate).not.toHaveTextContent(todayText);
  });
});
