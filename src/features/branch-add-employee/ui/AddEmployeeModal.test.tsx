import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import AddEmployeeModal from "./AddEmployeeModal";

/**
 * «Xodim qo'shish» oynasi (maket `superadmin-branches-add-employee-dialog`): faqat faol menejer / ro'yxatchi /
 * kuryer (`GET /users`), «ism» + «login · rol», `POST /branches/:id/users { user_id }`, tanlovsiz yuborilmaydi.
 */
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../shared/api/instance", () => ({ api }));

const USERS: Record<string, Array<Record<string, unknown>>> = {
  courier: [{ id: 31, name: "Dilshod Karimov", username: "dilshod.k", role: "courier", status: "active" }],
  registrator: [{ id: 32, name: "Kamola Yusupova", username: "kamola.y", role: "registrator", status: "active" }],
  manager: [{ id: 33, name: "Umid Haydarov", username: "umid.h", role: "manager", status: "active" }],
};

describe("AddEmployeeModal (v2)", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.get.mockImplementation((_url: string, config?: { params?: { role?: string } }) =>
      Promise.resolve({ data: { statusCode: 200, data: { items: USERS[config?.params?.role ?? ""] ?? [] } } }),
    );
  });

  it("izoh filial nomi bilan; ro'yxatda «login · rol»; faqat faol menejer/ro'yxatchi/kuryer so'raladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddEmployeeModal branchId="15" branchName="Urgut filiali" open onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    expect(dialog).toHaveAccessibleDescription("Urgut filialiga foydalanuvchini biriktiring.");
    expect(within(dialog).getByText("Faqat faol menejer, ro'yxatchi va kuryerlar ko'rsatiladi")).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
    for (const role of ["manager", "registrator", "courier"]) {
      expect(api.get).toHaveBeenCalledWith("users", {
        params: expect.objectContaining({ role, status: "active", page: 1, limit: 100 }),
      });
    }

    await user.click(within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ }));
    const option = await screen.findByRole("option", { name: /Dilshod Karimov/ });
    expect(option).toHaveTextContent("dilshod.k · Kuryer");
    expect(screen.getByRole("option", { name: /Umid Haydarov/ })).toHaveTextContent("umid.h · Menejer");
  });

  it("⭐ tanlangan foydalanuvchi — POST /branches/15/users { user_id }, xabar va yopiladi", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    api.post.mockResolvedValue({ data: { statusCode: 201 } });
    renderWithProviders(<AddEmployeeModal branchId="15" branchName="Urgut filiali" open onClose={onClose} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    await user.click(within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ }));
    await user.click(await screen.findByRole("option", { name: /Kamola Yusupova/ }));
    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("branches/15/users", { user_id: "32" }));
    expect(await screen.findByText("Xodim filialga qo'shildi")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("qidiruv ro'yxatni toraytiradi; ↓ + Enter tanlaydi (forma yuborilmaydi), «Qo'shish» yuboradi", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: { statusCode: 201 } });
    renderWithProviders(<AddEmployeeModal branchId="15" open onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    const list = within(dialog).getByRole("listbox", { name: "Foydalanuvchilar" });
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(3));

    await user.type(within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ }), "umid");
    expect(within(list).getAllByRole("option")).toHaveLength(1);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(within(list).getByRole("option", { name: /Umid Haydarov/ })).toHaveAttribute("aria-selected", "true");
    expect(api.post).not.toHaveBeenCalled();

    await user.clear(within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ }));
    await user.type(within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ }), "yo'q odam");
    expect(within(list).getByText("Foydalanuvchi topilmadi")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("branches/15/users", { user_id: "33" }));
  });

  it("tanlovsiz yuborilmaydi — «Foydalanuvchini tanlang» maydon ostida", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddEmployeeModal branchId="15" open onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    expect(dialog).toHaveAccessibleDescription("Filialga foydalanuvchini biriktiring.");
    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));

    await waitFor(() =>
      expect(within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ })).toHaveAccessibleErrorMessage(
        "Foydalanuvchini tanlang",
      ),
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it("backend rad etsa — oyna ochiq, sabab xabarda", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    api.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { statusCode: 409, message: "Foydalanuvchi boshqa filialga biriktirilgan" } },
    });
    renderWithProviders(<AddEmployeeModal branchId="15" open onClose={onClose} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    await user.click(within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ }));
    await user.click(await screen.findByRole("option", { name: /Dilshod Karimov/ }));
    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));

    expect(await screen.findByText("Foydalanuvchi boshqa filialga biriktirilgan")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Xodim qo'shish" })).toBeInTheDocument();
  });
});
