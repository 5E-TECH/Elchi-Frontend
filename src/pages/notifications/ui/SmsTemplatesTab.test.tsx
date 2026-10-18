import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SmsTemplatesTab from "./SmsTemplatesTab";
import { renderWithProviders } from "../../../test/test-utils";

/** Shablonlar (dizayn v2): o'chirish — tasdiq oynasi, saqlash va tasdiq id payloadlari. */

const mocks = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, delete: mocks.del, post: mocks.post, patch: mocks.patch },
}));

const TEMPLATE = {
  id: "t1",
  code: "order.delivered",
  message_class: "transactional",
  lang: "uz",
  text: "Buyurtma {{order_number}} yetkazildi",
  provider_template_id: "p-1",
  needs_provider_approval: false,
  encoding: "GSM-7",
  parts: 1,
};

const PENDING = {
  id: "t2",
  code: "promo.autumn",
  message_class: "promo",
  lang: "ru",
  text: "Скидка {{promo}}",
  provider_template_id: null,
  needs_provider_approval: true,
  encoding: "UCS-2",
  parts: 1,
};

describe("SmsTemplatesTab", () => {
  beforeEach(() => {
    mocks.get.mockImplementation((url: string) =>
      Promise.resolve({
        data: url.endsWith("templates") ? { data: [TEMPLATE, PENDING] } : { data: null },
      }),
    );
    mocks.del.mockResolvedValue({ data: {} });
    mocks.post.mockResolvedValue({ data: { data: TEMPLATE } });
    mocks.patch.mockResolvedValue({ data: {} });
  });

  it("table: code, language name, approval state; the UCS-2 template is marked", async () => {
    renderWithProviders(<SmsTemplatesTab />);
    const table = await screen.findByRole("table", { name: "SMS shablonlari" });
    expect(within(table).getByText("Tasdiqlangan: p-1")).toBeInTheDocument();
    expect(within(table).getByText("Operator tasdig'i kerak")).toBeInTheDocument();
    expect(within(table).getAllByText("Ruscha").length).toBeGreaterThan(0);
    expect(within(table).getByText("UCS-2")).toHaveClass("text-warning-fg");
    expect(screen.getByText("2 ta")).toBeInTheDocument();
  });

  it("«O'chirish» avval tasdiq so'raydi; «Bekor qilish» — so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SmsTemplatesTab />);

    await user.click(
      await screen.findByRole("button", { name: "order.delivered (O'zbekcha) — o'chirish" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Shablonni o'chirishni tasdiqlang",
    });
    expect(dialog).toHaveTextContent("order.delivered · uz");

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it("tasdiqlangach shablon o'chiriladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SmsTemplatesTab />);

    await user.click(
      await screen.findByRole("button", { name: "order.delivered (O'zbekcha) — o'chirish" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Shablonni o'chirishni tasdiqlang",
    });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    await waitFor(() => expect(mocks.del).toHaveBeenCalledWith("notifications/sms/templates/t1"));
    expect(await screen.findByText("Shablon o'chirildi")).toBeInTheDocument();
  });

  it("«Tahrirlash» fills the form; «Saqlash» POSTs code, class, lang and text", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SmsTemplatesTab />);

    await user.click(
      await screen.findByRole("button", { name: "order.delivered (O'zbekcha) — tahrirlash" }),
    );
    expect(screen.getByRole("textbox", { name: "Kod" })).toHaveValue("order.delivered");
    const text = screen.getByRole("textbox", { name: "Matn" });
    expect(text).toHaveValue("Buyurtma {{order_number}} yetkazildi");
    expect(
      screen.getByText("{{order_number}}", { selector: "span[class*='rounded']" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("notifications/sms/templates", {
        code: "order.delivered",
        message_class: "transactional",
        lang: "uz",
        text: "Buyurtma {{order_number}} yetkazildi",
      }),
    );
    expect(await screen.findByText("Shablon saqlandi")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Kod" })).toHaveValue("");
  });

  it("approval id is sent with PATCH …/approve", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SmsTemplatesTab />);

    const input = await screen.findByRole("textbox", { name: "promo.autumn uchun tasdiq id" });
    const approve = screen.getByRole("button", { name: "Tasdiqlash" });
    expect(approve).toBeDisabled();
    await user.type(input, " 10490 ");
    await user.click(approve);

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("notifications/sms/templates/t2/approve", {
        provider_template_id: "10490",
      }),
    );
    expect(await screen.findByText("Tasdiq id saqlandi")).toBeInTheDocument();
  });
});
