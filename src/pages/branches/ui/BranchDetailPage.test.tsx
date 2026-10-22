import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import BranchDetailPage from "./BranchDetailPage";

/**
 * `/branches/:id` (dizayn v2, maket `superadmin-branches-detail`): sarlavha (holat, «kod · tur · Yuqori filial»),
 * ma'lumot kartasi, xodimlar, «Tahrirlash» va «Xodim qo'shish» oynalari; topilmadi / xato holatlari.
 * «Filial ko'rsatkichlari» bo'limi chizilmaydi (analytics `branch_id` ni qabul qilmaydi).
 */
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/instance", () => ({ api }));

const URGUT = {
  id: 15,
  name: "Urgut filiali",
  code: "SMQ-URG",
  type: "HYBRID",
  status: "active",
  level: 2,
  parent_id: 7,
  parent: { id: 7, name: "Samarqand filiali" },
  phone_number: "+998662345678",
  region: { id: 12, name: "Samarqand viloyati" },
  district: { id: 121, name: "Urgut tumani" },
  address: "Bozor ko'chasi, 14",
  employees_count: 2,
  created_at: "2025-07-09T12:00:00.000Z",
};

const EMPLOYEES = [
  { id: 1, user_id: 210, role: "REGISTRATOR", createdAt: "2025-07-10T12:00:00.000Z", user: { id: 210, name: "Madina Sobirova", phone_number: "+998937182045" } },
  { id: 2, user_id: 209, role: "COURIER", createdAt: "2025-07-12T12:00:00.000Z", user: { id: 209, name: "Bahodir Karimov", phone_number: "+998975142683" } },
];

const renderPage = (id = "15") =>
  renderWithProviders(
    <Routes>
      <Route path="/branches/:id" element={<BranchDetailPage />} />
    </Routes>,
    { route: `/branches/${id}`, preloadedState: { role: { id: "1", role: "superadmin", region: null, name: "SA" } } as never },
  );

describe("BranchDetailPage (v2)", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.get.mockImplementation((url: string) => {
      if (url === "branches/15") return Promise.resolve({ data: { statusCode: 200, data: URGUT } });
      if (url === "branches/15/users") return Promise.resolve({ data: { statusCode: 200, data: EMPLOYEES } });
      if (url === "branches/404") return Promise.reject({ isAxiosError: true, response: { status: 404, data: { message: "Not found" } } });
      if (url === "branches/500") return Promise.reject({ isAxiosError: true, response: { status: 500, data: { message: "boom" } } });
      return Promise.resolve({ data: { statusCode: 200, data: [] } });
    });
  });

  it("sarlavha, ma'lumot kartasi va xodimlar — maket matnlari", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Urgut filiali" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Filiallar" })).toHaveAttribute("href", "/branches");
    expect(screen.getByText("Faol")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "SMQ-URG · Aralash · Yuqori filial: Samarqand filiali"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Samarqand filiali" })).toHaveAttribute("href", "/branches/7");

    const info = screen.getByRole("region", { name: "Filial ma'lumotlari" });
    expect(within(info).getByText("Urgut tumani")).toBeInTheDocument();
    expect(within(info).getByText("Samarqand viloyati, Bozor ko'chasi, 14")).toBeInTheDocument();
    expect(within(info).getByText("2 ta")).toBeInTheDocument();
    expect(within(info).getByText("filialga biriktirilgan")).toBeInTheDocument();
    expect(within(info).getByText("09.07.2025")).toBeInTheDocument();

    const employees = await screen.findByRole("table", { name: "Filial xodimlari" });
    expect(within(employees).getByText("Madina Sobirova")).toBeInTheDocument();
    expect(within(employees).getByText("+998 93 718 20 45")).toBeInTheDocument();
    expect(within(employees).getByRole("button", { name: "Madina Sobirovani filialdan olib tashlash" })).toBeInTheDocument();
    expect(within(employees).getByRole("button", { name: "Bahodir Karimovni boshqa filialga o'tkazish" })).toBeInTheDocument();

    // Analytics filial kesimini bermaydi — bo'lim yo'q.
    expect(screen.queryByText("Filial ko'rsatkichlari")).not.toBeInTheDocument();
  });

  it("«Xodim qo'shish» — oyna filial nomi bilan; «Tahrirlash» — filial tahriri oynasi", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Urgut filiali" });

    await user.click(screen.getByRole("button", { name: "Xodim qo'shish" }));
    const add = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    expect(add).toHaveAccessibleDescription("Urgut filialiga foydalanuvchini biriktiring.");
    await user.click(within(add).getByRole("button", { name: "Bekor qilish" }));

    await user.click(screen.getByRole("button", { name: "Tahrirlash" }));
    const edit = await screen.findByRole("dialog", { name: "Filialni tahrirlash" });
    expect(within(edit).getByLabelText(/^Filial nomi/)).toHaveValue("Urgut filiali");
    expect(within(edit).getByRole("radio", { name: "Aralash" })).toBeChecked();
  });

  it("topilmasa (404) — «Filial topilmadi» va «← Filiallar»", async () => {
    renderPage("404");

    expect(await screen.findByText("Filial topilmadi")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Filiallar" })).toHaveAttribute("href", "/branches");
    expect(screen.queryByRole("button", { name: "Qayta urinish" })).not.toBeInTheDocument();
  });

  it("server xatosi — «Filial ma'lumotini yuklab bo'lmadi» + «Qayta urinish»", async () => {
    renderPage("500");

    expect(await screen.findByText("Filial ma'lumotini yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
  });

  describe("sana va xodimlar soni soxta emas (cI5gqN90)", () => {
    // «Bugun» filial sanalaridan uzoq: normalizer bugungi kun bilan to'ldirsa, «22.10.2026» chiqadi.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-22T09:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const serve = (branch: Record<string, unknown>, employees: unknown[] = EMPLOYEES) =>
      api.get.mockImplementation((url: string) => {
        if (url === "branches/15") return Promise.resolve({ data: { statusCode: 200, data: branch } });
        if (url === "branches/15/users") return Promise.resolve({ data: { statusCode: 200, data: employees } });
        return Promise.resolve({ data: { statusCode: 200, data: [] } });
      });

    const createdValue = async () => {
      await screen.findByRole("heading", { level: 1, name: "Urgut filiali" });
      const info = screen.getByRole("region", { name: "Filial ma'lumotlari" });
      return within(info).getByText("Yaratilgan sana").nextElementSibling;
    };

    it("⭐ TC2: sana kelmasa «Yaratilgan sana» — «—», bugungi kun emas", async () => {
      serve({ ...URGUT, created_at: undefined });
      renderPage();

      expect(await createdValue()).toHaveTextContent(/^—$/);
      expect(screen.queryByText("22.10.2026")).not.toBeInTheDocument();
    });

    it("⭐ TC1: faqat createdAt kelsa — o'sha sana", async () => {
      const { created_at: createdAt, ...withoutDate } = URGUT;
      serve({ ...withoutDate, createdAt });
      renderPage();

      expect(await createdValue()).toHaveTextContent(/^09\.07\.2025$/);
    });

    it("TC4: XODIMLAR kartasidagi son — jadvaldagi qatorlar soni (4 = 4)", async () => {
      const staff = [
        ...EMPLOYEES,
        { id: 3, user_id: 211, role: "COURIER", createdAt: "2025-08-01T12:00:00.000Z", user: { id: 211, name: "Jasur Aliyev", phone_number: "+998901112233" } },
        { id: 4, user_id: 212, role: "REGISTRATOR", user: { id: 212, name: "Nodira Qodirova", phone_number: "+998901112244" } },
      ];
      serve({ ...URGUT, employees_count: 4 }, staff);
      renderPage();

      await screen.findByRole("heading", { level: 1, name: "Urgut filiali" });
      expect(within(screen.getByRole("region", { name: "Filial ma'lumotlari" })).getByText("4 ta")).toBeInTheDocument();
      const table = await screen.findByRole("table", { name: "Filial xodimlari" });
      const rows = within(table).getAllByRole("row").filter((row) => row.closest("tbody"));
      expect(rows).toHaveLength(4);
      // Qo'shilgan sanasi kelmagan xodim — «—», bugungi kun emas.
      const nodira = rows.find((row) => within(row).queryByText("Nodira Qodirova"));
      expect(nodira).toHaveTextContent("—");
      expect(within(table).queryByText("22.10.2026")).not.toBeInTheDocument();
    });
  });
});
