import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import BranchFormModal from "./BranchFormModal";

/**
 * «Yangi filial» oynasi (dizayn v2, `BranchFormDialog`): maket matnlari, `POST /branches` tanasi
 * (`buildCreateBranchPayload`), yup xatolari maydon ostida va backend xatosi maydonga + xabar.
 */
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../shared/api/instance", () => ({ api }));

const REGIONS = [
  { id: 14, name: "Qashqadaryo viloyati", districts: [{ id: 141, name: "Qarshi sh." }, { id: 142, name: "Shahrisabz" }] },
  { id: 12, name: "Samarqand viloyati", districts: [{ id: 121, name: "Urgut tumani" }] },
];
const PARENTS = [
  { id: 1, name: "Toshkent HQ", code: "TSH-HQ", type: "HQ", level: 0, region: { id: 10, name: "Toshkent sh." } },
  { id: 7, name: "Samarqand filiali", code: "SMQ-01", type: "REGIONAL", level: 1 },
  { id: 9, name: "Chilonzor qabul punkti", code: "TSH-CHL", type: "PICKUP", level: 1 },
];

const renderModal = () => {
  const onClose = vi.fn();
  renderWithProviders(<BranchFormModal open onClose={onClose} />);
  return { onClose };
};

const pick = async (user: ReturnType<typeof userEvent.setup>, field: RegExp, option: string | RegExp) => {
  await user.click(screen.getByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
};

describe("BranchFormModal — «Yangi filial» (v2)", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.get.mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === "region"
            ? { statusCode: 200, data: REGIONS }
            : { statusCode: 200, data: { items: PARENTS, meta: { page: 1, limit: 200, total: PARENTS.length } } },
      }),
    );
  });

  it("maket matnlari: sarlavha, izoh, tur segmenti (HQ o'chiq, «Viloyat» sukut), ko'rsatmalar, tugmalar", async () => {
    renderModal();

    const dialog = await screen.findByRole("dialog", { name: "Yangi filial" });
    expect(dialog).toHaveAccessibleDescription("Filial ma'lumotlarini kiriting va uni tizimga qo'shing.");
    const type = within(dialog).getByRole("radiogroup", { name: "Filial turi" });
    expect(within(type).getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
      "HQ",
      "Qabul punkti",
      "Viloyat",
      "Aralash",
    ]);
    expect(within(type).getByRole("radio", { name: "HQ" })).toBeDisabled();
    expect(within(type).getByRole("radio", { name: "Viloyat" })).toBeChecked();
    expect(within(dialog).getByText("HQ allaqachon mavjud")).toBeInTheDocument();
    expect(within(dialog).getByText("Qabul punktlari yuqori filial bo'la olmaydi")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Qisqa nom/)).toHaveAttribute("placeholder", "Masalan: TSH-CHL");
    expect(within(dialog).getByRole("combobox", { name: /^Tuman/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Bekor qilish" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Saqlash" })).toHaveAttribute("type", "submit");
  });

  it("⭐ to'ldirilgan forma — POST /branches tanasi (tur katta harfda, kod trim, tanlangan yuqori filial), yopiladi", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: { statusCode: 201, data: { id: 99 } } });
    const { onClose } = renderModal();
    await screen.findByRole("dialog", { name: "Yangi filial" });

    await user.type(screen.getByLabelText(/^Filial nomi/), "Qarshi filiali");
    await user.click(screen.getByRole("radio", { name: "Aralash" }));
    await pick(user, /^Yuqori filial/, /^Toshkent HQ \(TSH-HQ\)/);
    await user.type(screen.getByLabelText(/^Qisqa nom/), "qsh-01");
    await user.type(screen.getByLabelText(/^Telefon raqami/), "752214040");
    await pick(user, /^Viloyat/, "Qashqadaryo viloyati");
    await pick(user, /^Tuman/, "Qarshi sh.");
    await user.type(screen.getByLabelText(/^Manzil/), "Mustaqillik ko'chasi, 1");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith("branches", {
      name: "Qarshi filiali",
      parent_id: "1",
      type: "HYBRID",
      code: "QSH-01",
      phone_number: "+998752214040",
      region_id: "14",
      district_id: "141",
      address: "Mustaqillik ko'chasi, 1",
    });
    expect(await screen.findByText("Filial yaratildi")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Qabul punktlari yuqori filial ro'yxatida yo'q", async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByRole("dialog", { name: "Yangi filial" });

    await user.click(screen.getByRole("combobox", { name: /^Yuqori filial/ }));
    expect(await screen.findByRole("option", { name: /^Toshkent HQ/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Samarqand filiali \(SMQ-01\) · Viloyat/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Chilonzor qabul punkti/ })).not.toBeInTheDocument();
  });

  it("bo'sh forma yuborilmaydi: xatolar maydon ostida, birinchi xato xabarda", async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByRole("dialog", { name: "Yangi filial" });

    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    // Sxema o'zgarmagan: bo'sh nomda birinchi bo'lib `min(2)` qoidasi ishlaydi.
    expect(await screen.findByLabelText(/^Filial nomi/)).toHaveAccessibleErrorMessage("Kamida 2 ta belgi");
    expect(screen.getByRole("combobox", { name: /^Yuqori filial/ })).toHaveAccessibleErrorMessage(
      "Yuqori filialni tanlang",
    );
    expect(screen.getByLabelText(/^Manzil/)).toHaveAccessibleErrorMessage("Manzilni kiriting");
    // Birinchi xato xabarda ham (maydon ostidagi bilan birga — 2 joyda).
    expect((await screen.findAllByText("Kamida 2 ta belgi")).length).toBeGreaterThan(1);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("viloyat almashsa tuman tozalanadi", async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByRole("dialog", { name: "Yangi filial" });

    await pick(user, /^Viloyat/, "Qashqadaryo viloyati");
    await pick(user, /^Tuman/, "Qarshi sh.");
    expect(screen.getByRole("combobox", { name: /^Tuman/ })).toHaveValue("Qarshi sh.");

    await pick(user, /^Viloyat/, "Samarqand viloyati");
    expect(screen.getByRole("combobox", { name: /^Tuman/ })).toHaveValue("");
  });

  it("backend «code already exists» — xato «Qisqa nom» maydoni ostida, oyna ochiq", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { statusCode: 409, message: "Branch code already exists" } },
    });
    const { onClose } = renderModal();
    await screen.findByRole("dialog", { name: "Yangi filial" });

    await user.type(screen.getByLabelText(/^Filial nomi/), "Qarshi filiali");
    await pick(user, /^Yuqori filial/, /^Toshkent HQ \(TSH-HQ\)/);
    await user.type(screen.getByLabelText(/^Qisqa nom/), "TSH-HQ");
    await user.type(screen.getByLabelText(/^Telefon raqami/), "752214040");
    await pick(user, /^Viloyat/, "Qashqadaryo viloyati");
    await pick(user, /^Tuman/, "Qarshi sh.");
    await user.type(screen.getByLabelText(/^Manzil/), "Manzil");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() =>
      expect(screen.getByLabelText(/^Qisqa nom/)).toHaveAccessibleErrorMessage("Bu code allaqachon mavjud"),
    );
    expect(await screen.findByText("Branch code already exists")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
