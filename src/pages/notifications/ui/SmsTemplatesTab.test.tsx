import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SmsTemplatesTab from "./SmsTemplatesTab";
import { renderWithProviders } from "../../../test/test-utils";

/** Shablonni o'chirish — buzuvchi amal, v2 tasdiqlash oynasi orqali (DESIGN_SYSTEM §8). */

const mocks = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn(), post: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({ api: { get: mocks.get, delete: mocks.del, post: mocks.post } }));

const TEMPLATE = {
  id: "t1",
  code: "order.delivered",
  message_class: "transactional",
  lang: "uz",
  text: "Buyurtma {{order_number}} yetkazildi",
  provider_template_id: "p-1",
};

describe("SmsTemplatesTab — o'chirish", () => {
  beforeEach(() => {
    mocks.get.mockImplementation((url: string) =>
      Promise.resolve({ data: url.endsWith("templates") ? { data: [TEMPLATE] } : { data: null } }),
    );
    mocks.del.mockResolvedValue({ data: {} });
  });

  it("«O'chirish» avval tasdiq so'raydi; «Bekor qilish» — so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SmsTemplatesTab />);

    await user.click(await screen.findByRole("button", { name: "O'chirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Shablonni o'chirishni tasdiqlang" });
    expect(dialog).toHaveTextContent("order.delivered · uz");

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it("tasdiqlangach shablon o'chiriladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SmsTemplatesTab />);

    await user.click(await screen.findByRole("button", { name: "O'chirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Shablonni o'chirishni tasdiqlang" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    await waitFor(() => expect(mocks.del).toHaveBeenCalledWith("notifications/sms/templates/t1"));
    expect(await screen.findByText("Shablon o'chirildi")).toBeInTheDocument();
  });
});
